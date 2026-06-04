import type { NfeProviderAdapter, NfeEmitInput, NfeEmitResult } from '@/lib/nfe/types'

function baseUrl(env: 'homologacao' | 'producao'): string {
  return env === 'producao'
    ? 'https://api.focusnfe.com.br'
    : 'https://homologacao.focusnfe.com.br'
}

/**
 * Adapter Focus NFe (NFC-e modelo 65 e NFS-e).
 * Doc: https://focusnfe.com.br/doc/
 *
 * Autenticação: HTTP Basic com o token como usuário (senha vazia).
 * Emissão é assíncrona no Focus: POST cria a ref; o status final chega por
 * webhook ou consulta. Aqui tratamos a resposta inicial; 'processing' fica
 * pendente de atualização posterior.
 */
export class FocusNfeAdapter implements NfeProviderAdapter {
  readonly id = 'focusnfe'

  async emit(input: NfeEmitInput): Promise<NfeEmitResult> {
    const token = input.restaurant.token
    if (!token) {
      return { status: 'error', error: 'Token Focus NFe ausente.' }
    }

    const path = input.noteType === 'nfce'
      ? `/v2/nfce?ref=${encodeURIComponent(input.ref)}`
      : `/v2/nfse?ref=${encodeURIComponent(input.ref)}`

    const auth = Buffer.from(`${token}:`).toString('base64')

    // Payload mínimo. Campos fiscais completos (NCM, CFOP, impostos) dependem do
    // cadastro do restaurante no Focus; aqui enviamos o essencial e deixamos o
    // provedor aplicar a tributação configurada na empresa.
    const body = buildFocusPayload(input)

    try {
      const res = await fetch(`${baseUrl(input.environment)}${path}`, {
        method: 'POST',
        headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json().catch(() => ({}))

      // Focus retorna 'autorizado', 'processando_autorizacao', 'erro_autorizacao', etc.
      const status = String(data?.status ?? '')
      if (res.ok && (status === 'autorizado')) {
        return {
          status: 'issued',
          providerRef: input.ref,
          number: data?.numero ?? undefined,
          accessKey: data?.chave_nfe ?? data?.chave_nfse ?? undefined,
          danfeUrl: absoluteFocusUrl(input.environment, data?.caminho_danfe ?? data?.url_danfe),
          xmlUrl: absoluteFocusUrl(input.environment, data?.caminho_xml_nota_fiscal ?? data?.caminho_xml),
        }
      }
      if (status === 'processando_autorizacao' || res.status === 202) {
        return { status: 'processing', providerRef: input.ref }
      }
      const errMsg = data?.mensagem ?? data?.erros?.[0]?.mensagem ?? `Focus NFe retornou ${res.status}.`
      return { status: 'error', providerRef: input.ref, error: errMsg }
    } catch (err) {
      return { status: 'error', error: err instanceof Error ? err.message : 'Falha ao conectar ao Focus NFe.' }
    }
  }
}

function absoluteFocusUrl(env: 'homologacao' | 'producao', path?: string | null): string | undefined {
  if (!path) return undefined
  if (path.startsWith('http')) return path
  return `${baseUrl(env)}${path}`
}

function buildFocusPayload(input: NfeEmitInput): Record<string, unknown> {
  const doc = input.customer?.document?.replace(/\D/g, '') || undefined
  if (input.noteType === 'nfce') {
    return {
      cnpj_emitente: input.restaurant.cnpj?.replace(/\D/g, ''),
      data_emissao: new Date().toISOString(),
      presenca_comprador: '1',
      modalidade_frete: '9',
      ...(doc ? { cpf_destinatario: doc } : {}),
      ...(input.customer?.name ? { nome_destinatario: input.customer.name } : {}),
      valor_total: round2(input.amount),
      items: input.items.map((it, i) => ({
        numero_item: i + 1,
        descricao: it.description,
        quantidade_comercial: it.quantity,
        valor_unitario_comercial: round2(it.unitPrice),
        valor_bruto: round2(it.quantity * it.unitPrice),
      })),
    }
  }
  // NFS-e (serviço) — estrutura simplificada. Tomador pode ser CPF (consumidor)
  // ou CNPJ (restaurante, na NF-e de serviço Qomanda→restaurante).
  const tomadorDoc = doc
    ? (doc.length > 11 ? { cnpj: doc } : { cpf: doc })
    : null
  return {
    data_emissao: new Date().toISOString().slice(0, 10),
    prestador: { cnpj: input.restaurant.cnpj?.replace(/\D/g, '') },
    ...(tomadorDoc ? { tomador: { ...tomadorDoc, razao_social: input.customer?.name ?? 'Consumidor' } } : {}),
    servico: {
      discriminacao: input.items.map(i => `${i.quantity}x ${i.description}`).join(' · ') || 'Serviço de alimentação',
      valor_servicos: round2(input.amount),
    },
  }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}
