import type { SupabaseClient } from '@supabase/supabase-js'
import { FocusNfeAdapter } from '@/lib/nfe/focus-nfe'
import { getQomandaFiscalConfig } from '@/lib/nfe/qomanda-fiscal'
import type { NfeEmitResult } from '@/lib/nfe/types'
import { sendTransactionalEmail } from '@/lib/send-email'

export type EmitServiceNfeOutcome = {
  emitted: boolean
  serviceInvoiceId?: string
  status?: string
  reason?: string
}

const focus = new FocusNfeAdapter()

/**
 * Emite a NF-e de serviço (NFS-e) da Qomanda para o CNPJ do restaurante,
 * referente a uma fatura de mensalidade (billing_invoices). Idempotente por fatura.
 *
 * Degradável: sem credenciais fiscais da Qomanda, grava 'simulated' (fluxo testável)
 * em vez de chamar a prefeitura/provedor. Nunca lança — sempre retorna outcome.
 *
 * @param opts.requirePaid quando true (gatilho automático), só emite se a fatura
 *        estiver paga. No disparo manual pelo portal, passa false.
 */
export async function emitServiceNfeForInvoice(
  admin: SupabaseClient,
  billingInvoiceId: string,
  opts: { requirePaid?: boolean } = {},
): Promise<EmitServiceNfeOutcome> {
  try {
    const { data: invoice } = await admin
      .from('billing_invoices')
      .select('id, restaurant_id, amount, status, notes, period_start, period_end')
      .eq('id', billingInvoiceId)
      .maybeSingle()

    if (!invoice) return { emitted: false, reason: 'invoice_not_found' }
    if (opts.requirePaid && invoice.status !== 'paid') {
      return { emitted: false, reason: 'invoice_not_paid' }
    }

    const amount = Number(invoice.amount)
    if (!(amount > 0)) return { emitted: false, reason: 'zero_amount' }

    // Idempotência: 1 nota válida/em curso por fatura.
    const { data: existing } = await admin
      .from('service_nfe_invoices')
      .select('id, status')
      .eq('billing_invoice_id', billingInvoiceId)
      .in('status', ['issued', 'processing', 'simulated'])
      .maybeSingle()
    if (existing) {
      return { emitted: false, serviceInvoiceId: existing.id, status: existing.status, reason: 'already_emitted' }
    }

    // Tomador = restaurante
    const { data: r } = await admin
      .from('restaurants')
      .select('id, name, legal_name, document_number, contact_email')
      .eq('id', invoice.restaurant_id)
      .maybeSingle()
    if (!r) return { emitted: false, reason: 'restaurant_not_found' }

    const tomadorDoc = (r.document_number ?? '').replace(/\D/g, '')
    if (!tomadorDoc) return { emitted: false, reason: 'tomador_document_missing' }

    const config = getQomandaFiscalConfig()
    const description = invoice.notes?.trim() || config.serviceDescription

    let result: NfeEmitResult
    if (!config.hasCredentials) {
      // Modo simulado — Qomanda ainda sem credenciais fiscais reais.
      result = { status: 'simulated' }
    } else {
      result = await focus.emit({
        noteType: 'nfse',
        environment: config.environment,
        ref: `svc:${billingInvoiceId}`,
        amount,
        items: [{ description, quantity: 1, unitPrice: amount }],
        customer: { name: r.legal_name ?? r.name, document: tomadorDoc },
        restaurant: { token: config.token, cnpj: config.cnpj, cnae: config.cnae },
      })
    }

    const { data: serviceInvoice, error: insErr } = await admin
      .from('service_nfe_invoices')
      .insert({
        billing_invoice_id: billingInvoiceId,
        restaurant_id: r.id,
        status: result.status,
        provider: config.hasCredentials ? config.provider : 'simulado',
        provider_ref: result.providerRef ?? `svc:${billingInvoiceId}`,
        environment: config.environment,
        number: result.number ?? null,
        amount,
        danfe_url: result.danfeUrl ?? null,
        xml_url: result.xmlUrl ?? null,
        access_key: result.accessKey ?? null,
        error_message: result.error ?? null,
      })
      .select('id, status, danfe_url')
      .single()

    if (insErr || !serviceInvoice) {
      // corrida: outra execução criou a nota da mesma fatura
      if (insErr?.code === '23505') return { emitted: false, reason: 'race_already_exists' }
      console.error('[emitServiceNfeForInvoice] insert', insErr)
      return { emitted: false, reason: 'db_insert_failed' }
    }

    // E-mail ao restaurante (link do PDF, ou aviso de emissão em curso)
    const deliverable = ['issued', 'processing', 'simulated'].includes(result.status)
    if (deliverable && r.contact_email) {
      const sent = await sendTransactionalEmail({
        to: r.contact_email,
        subject: `[Qomanda] Nota fiscal de serviço — ${formatPeriod(invoice.period_start, invoice.period_end)}`,
        html: buildServiceNfeEmailHtml({
          restaurantName: r.legal_name ?? r.name,
          amount,
          status: result.status,
          danfeUrl: serviceInvoice.danfe_url,
          description,
        }),
        text: buildServiceNfeEmailText({
          restaurantName: r.legal_name ?? r.name,
          amount,
          status: result.status,
          danfeUrl: serviceInvoice.danfe_url,
        }),
      })
      if (sent.ok) {
        await admin.from('service_nfe_invoices').update({ emailed_at: new Date().toISOString() }).eq('id', serviceInvoice.id)
      }
    }

    return { emitted: result.status !== 'error', serviceInvoiceId: serviceInvoice.id, status: result.status }
  } catch (err) {
    console.error('[emitServiceNfeForInvoice]', err)
    return { emitted: false, reason: 'exception' }
  }
}

function brl(value: number) {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function formatPeriod(start: string, end: string): string {
  const fmt = (d: string) => new Date(d + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
  return `${fmt(start)} a ${fmt(end)}`
}

function buildServiceNfeEmailHtml(p: {
  restaurantName: string
  amount: number
  status: string
  danfeUrl: string | null
  description: string
}): string {
  const linkBlock = p.status === 'issued' && p.danfeUrl
    ? `<p><a href="${p.danfeUrl}" style="color:#f97316;font-weight:600">📄 Baixar nota fiscal (PDF)</a></p>`
    : `<p>Sua nota está sendo emitida e o PDF chegará por aqui em instantes.</p>`
  return `
    <div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;color:#1a1a1a">
      <h2 style="color:#f97316">Nota fiscal de serviço — Qomanda</h2>
      <p>Olá, <strong>${p.restaurantName}</strong>.</p>
      <p>Referente a: ${p.description}.</p>
      <p><strong>Valor:</strong> ${brl(p.amount)}</p>
      ${linkBlock}
      <p style="font-size:12px;color:#888;margin-top:24px">Qomanda — plataforma de gestão para restaurantes.</p>
    </div>`
}

function buildServiceNfeEmailText(p: {
  restaurantName: string
  amount: number
  status: string
  danfeUrl: string | null
}): string {
  const link = p.status === 'issued' && p.danfeUrl
    ? `Baixar PDF: ${p.danfeUrl}`
    : 'Sua nota está sendo emitida e o PDF chegará em instantes.'
  return `Nota fiscal de serviço — Qomanda\n\nOlá, ${p.restaurantName}.\nValor: ${brl(p.amount)}\n${link}\n\nQomanda`
}
