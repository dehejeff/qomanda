import type { SupabaseClient } from '@supabase/supabase-js'
import { decryptSecret } from '@/lib/secret-crypto'
import { FocusNfeAdapter } from '@/lib/nfe/focus-nfe'
import type { NfeNoteType, NfeEmitResult } from '@/lib/nfe/types'

export type EmitNfeOutcome = {
  emitted: boolean
  invoiceId?: string
  status?: string
  reason?: string
}

const PROVIDERS = { focusnfe: new FocusNfeAdapter() }

/**
 * Emite a NF-e do pagamento (auto após confirmação, ou manual pelo painel) e,
 * se configurado, envia o link ao cliente por WhatsApp.
 *
 * Degradável: sem token do provedor, grava registro 'simulated' (fluxo testável
 * ponta a ponta) em vez de chamar a SEFAZ. Nunca lança — sempre retorna outcome.
 */
export async function emitNfeForPayment(
  supabase: SupabaseClient,
  paymentId: string,
  opts: { manual?: boolean } = {},
): Promise<EmitNfeOutcome> {
  try {
    const { data: payment } = await supabase
      .from('payments')
      .select('id, restaurant_id, customer_id, session_id, amount, status, method')
      .eq('id', paymentId)
      .maybeSingle()

    if (!payment) return { emitted: false, reason: 'payment_not_found' }
    if (payment.status !== 'paid') return { emitted: false, reason: 'payment_not_paid' }
    // Dinheiro/oferta podem não gerar nota fiscal automática — mas permitimos manual.
    if (payment.method === 'offer') return { emitted: false, reason: 'offer_no_invoice' }

    const { data: r } = await supabase
      .from('restaurants')
      .select(`
        id, name, slug, document_number, whatsapp_nfe_enabled,
        nfe_enabled, nfe_status, nfe_provider, nfe_environment, nfe_note_type,
        nfe_provider_token_encrypted, nfe_invoice_series, nfe_cnae, nfe_provider_company_id
      `)
      .eq('id', payment.restaurant_id)
      .maybeSingle()

    if (!r) return { emitted: false, reason: 'restaurant_not_found' }
    if (!r.nfe_enabled || r.nfe_status !== 'active') {
      return { emitted: false, reason: 'nfe_not_active' }
    }
    const noteType = (r.nfe_note_type as NfeNoteType | null)
    if (!noteType) return { emitted: false, reason: 'note_type_not_set' }

    // Idempotência: não reemite se já há nota válida/em curso para o pagamento.
    const { data: existing } = await supabase
      .from('nfe_invoices')
      .select('id, status')
      .eq('payment_id', paymentId)
      .in('status', ['issued', 'processing', 'simulated'])
      .maybeSingle()
    if (existing) return { emitted: false, invoiceId: existing.id, status: existing.status, reason: 'already_emitted' }

    // Cliente — nome/whatsapp sempre; CPF best-effort (coluna pode não existir em bases antigas)
    let customer: { name?: string; document?: string | null; whatsapp?: string | null } = {}
    if (payment.customer_id) {
      const { data: c } = await supabase
        .from('customers')
        .select('first_name, last_name, whatsapp')
        .eq('id', payment.customer_id)
        .maybeSingle()
      if (c) {
        let document: string | null = null
        try {
          const { data: cpfRow } = await supabase
            .from('customers')
            .select('cpf_encrypted')
            .eq('id', payment.customer_id)
            .maybeSingle()
          const enc = (cpfRow as { cpf_encrypted?: string | null } | null)?.cpf_encrypted
          if (enc) document = decryptSecret(enc)
        } catch { document = null }
        customer = {
          name: `${c.first_name ?? ''} ${c.last_name ?? ''}`.trim() || 'Consumidor',
          document,
          whatsapp: c.whatsapp ?? null,
        }
      }
    }

    const environment = (r.nfe_environment as 'homologacao' | 'producao') ?? 'homologacao'
    const amount = Number(payment.amount)

    // Token do provedor
    let token: string | null = null
    if (r.nfe_provider_token_encrypted) {
      try { token = decryptSecret(r.nfe_provider_token_encrypted) } catch { token = null }
    }

    let result: NfeEmitResult
    if (!token || r.nfe_provider !== 'focusnfe') {
      // Modo simulado — sem credenciais reais. Registra para o fluxo ser testável.
      result = { status: 'simulated' }
    } else {
      result = await PROVIDERS.focusnfe.emit({
        noteType,
        environment,
        ref: payment.id,
        amount,
        items: [{ description: 'Consumo no local', quantity: 1, unitPrice: amount }],
        customer: { name: customer.name, document: customer.document },
        restaurant: {
          token,
          cnpj: r.document_number ?? null,
          companyId: r.nfe_provider_company_id ?? null,
          series: r.nfe_invoice_series ?? null,
          cnae: r.nfe_cnae ?? null,
        },
      })
    }

    const { data: invoice, error: insErr } = await supabase
      .from('nfe_invoices')
      .insert({
        restaurant_id: r.id,
        payment_id: payment.id,
        customer_id: payment.customer_id,
        session_id: payment.session_id,
        note_type: noteType,
        status: result.status,
        provider: token ? r.nfe_provider : 'simulado',
        provider_ref: result.providerRef ?? payment.id,
        environment,
        number: result.number ?? null,
        series: r.nfe_invoice_series ?? null,
        amount,
        danfe_url: result.danfeUrl ?? null,
        xml_url: result.xmlUrl ?? null,
        access_key: result.accessKey ?? null,
        error_message: result.error ?? null,
      })
      .select('id, status, danfe_url')
      .single()

    if (insErr || !invoice) {
      console.error('[emitNfeForPayment] insert', insErr)
      return { emitted: false, reason: 'db_insert_failed' }
    }

    // WhatsApp (se ligado e cliente tem número) — ENFILEIRADO: não bloqueia a
    // emissão, tem retry próprio e throttle por restaurante (limites Meta).
    const deliverable = ['issued', 'processing', 'simulated'].includes(result.status)
    if (deliverable && r.whatsapp_nfe_enabled && customer.whatsapp) {
      const msg = buildNfeWhatsAppMessage({
        restaurantName: r.name,
        customerName: customer.name ?? 'Cliente',
        danfeUrl: invoice.danfe_url,
        status: result.status,
        noteType,
      })
      const { enqueueWhatsApp } = await import('@/lib/job-queue')
      await enqueueWhatsApp(supabase, { restaurantId: r.id, to: customer.whatsapp, message: msg, invoiceId: invoice.id })
    }

    return { emitted: result.status !== 'error', invoiceId: invoice.id, status: result.status }
  } catch (err) {
    console.error('[emitNfeForPayment]', err)
    return { emitted: false, reason: 'exception' }
  }
}

function buildNfeWhatsAppMessage(p: {
  restaurantName: string
  customerName: string
  danfeUrl: string | null
  status: string
  noteType: NfeNoteType
}): string {
  const tipo = p.noteType === 'nfce' ? 'Nota Fiscal (NFC-e)' : 'Nota Fiscal de Serviço (NFS-e)'
  const first = p.customerName.split(' ')[0] || 'Olá'
  if (p.status === 'issued' && p.danfeUrl) {
    return `Olá, ${first}! Sua ${tipo} de *${p.restaurantName}* está pronta.\n\n📄 ${p.danfeUrl}\n\nObrigado pela visita!`
  }
  if (p.status === 'processing') {
    return `Olá, ${first}! Recebemos seu pagamento em *${p.restaurantName}*. Sua ${tipo} está sendo emitida e o link chegará aqui em instantes.`
  }
  // simulated
  return `Olá, ${first}! Recebemos seu pagamento em *${p.restaurantName}*. Sua ${tipo} será emitida e enviada por aqui.`
}
