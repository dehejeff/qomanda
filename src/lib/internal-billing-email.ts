import type { SupabaseClient } from '@supabase/supabase-js'
import { sendTransactionalEmail } from '@/lib/send-email'
import { brToday, startOfBrDay } from '@/lib/date-tz'

function brl(n: number): string {
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}
function fmtDate(d: string | null): string {
  if (!d) return '—'
  return new Date(d + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

type BillingRestaurant = { id: string; name: string; owner_id: string; contact_email: string | null }

/** Resolve o e-mail do responsável: e-mail da conta (auth) ou contato comercial. */
async function resolveBillingEmail(
  admin: SupabaseClient,
  restaurant: BillingRestaurant,
): Promise<{ email: string; name: string } | null> {
  let authEmail: string | undefined
  let metaName: string | undefined
  try {
    const { data } = await admin.auth.admin.getUserById(restaurant.owner_id)
    authEmail = data.user?.email ?? undefined
    metaName = (data.user?.user_metadata as { name?: string } | undefined)?.name
  } catch { /* ignora */ }
  const email = authEmail ?? restaurant.contact_email?.trim()
  if (!email) return null
  return { email, name: metaName?.split(' ')[0] ?? restaurant.name }
}

type ChargeEmailInput = {
  restaurantName: string
  amount: number
  dueDate: string | null
  invoiceUrl: string | null
  overdue: boolean
  daysOverdue: number
}

function buildChargeEmail(p: ChargeEmailInput): { subject: string; html: string; text: string } {
  const subject = p.overdue
    ? `Cobrança em atraso (${p.daysOverdue} ${p.daysOverdue === 1 ? 'dia' : 'dias'}) — KiComanda`
    : `Sua cobrança KiComanda — vencimento ${fmtDate(p.dueDate)}`

  const cta = p.invoiceUrl
    ? `<p style="margin:20px 0"><a href="${p.invoiceUrl}" style="background:#f97316;color:#582200;font-weight:700;padding:12px 20px;border-radius:10px;text-decoration:none">Pagar agora</a></p><p style="font-size:12px;color:#888">Ou copie o link: ${p.invoiceUrl}</p>`
    : `<p>Em breve enviaremos o link de pagamento.</p>`

  const intro = p.overdue
    ? `<p>Identificamos que a mensalidade da <strong>${p.restaurantName}</strong> está <strong style="color:#dc2626">em atraso há ${p.daysOverdue} ${p.daysOverdue === 1 ? 'dia' : 'dias'}</strong>.</p>`
    : `<p>Sua mensalidade da <strong>${p.restaurantName}</strong> está disponível para pagamento.</p>`

  const html = `
    <div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;color:#1a1a1a">
      <h2 style="color:#f97316">Cobrança KiComanda</h2>
      ${intro}
      <p><strong>Valor:</strong> ${brl(p.amount)}<br/><strong>Vencimento:</strong> ${fmtDate(p.dueDate)}</p>
      ${cta}
      <p style="font-size:12px;color:#888;margin-top:24px">Já pagou? Desconsidere este aviso. Dúvidas: responda este e-mail.</p>
    </div>`

  const text = `${p.overdue ? `Cobrança em atraso há ${p.daysOverdue} dia(s)` : 'Cobrança KiComanda'}\n\n`
    + `${p.restaurantName}\nValor: ${brl(p.amount)}\nVencimento: ${fmtDate(p.dueDate)}\n`
    + (p.invoiceUrl ? `Pagar: ${p.invoiceUrl}\n` : '')

  return { subject, html, text }
}

/** Envia o e-mail de cobrança de uma fatura (nova ou de atraso). Best-effort. */
export async function sendBillingChargeEmail(
  admin: SupabaseClient,
  invoiceId: string,
  opts: { overdue?: boolean } = {},
): Promise<{ ok: boolean; reason?: string }> {
  try {
    const { data: invoice } = await admin
      .from('billing_invoices')
      .select('id, restaurant_id, amount, due_date, invoice_url, status')
      .eq('id', invoiceId)
      .maybeSingle()
    if (!invoice || invoice.status === 'paid' || invoice.status === 'cancelled') {
      return { ok: false, reason: 'invoice_not_billable' }
    }

    const { data: r } = await admin
      .from('restaurants')
      .select('id, name, owner_id, contact_email')
      .eq('id', invoice.restaurant_id)
      .single()
    if (!r) return { ok: false, reason: 'restaurant_not_found' }

    const recipient = await resolveBillingEmail(admin, r as BillingRestaurant)
    if (!recipient) return { ok: false, reason: 'email_not_found' }

    const today = brToday()
    const daysOverdue = invoice.due_date
      ? Math.max(0, Math.round((new Date(today + 'T00:00:00-03:00').getTime() - new Date(invoice.due_date + 'T00:00:00-03:00').getTime()) / 86_400_000))
      : 0
    const overdue = Boolean(opts.overdue && daysOverdue > 0)

    const mail = buildChargeEmail({
      restaurantName: r.name,
      amount: Number(invoice.amount),
      dueDate: invoice.due_date,
      invoiceUrl: invoice.invoice_url,
      overdue,
      daysOverdue,
    })
    const sent = await sendTransactionalEmail({ to: recipient.email, ...mail })
    return { ok: sent.ok, reason: sent.ok ? undefined : 'send_failed' }
  } catch (err) {
    console.error('[sendBillingChargeEmail]', err)
    return { ok: false, reason: 'exception' }
  }
}

export type BillingRemindersResult = { overdue: number; sent: number; failed: number; skipped: number }

/**
 * Lembrete de atraso: e-mail para faturas vencidas (não pagas) ainda não
 * lembradas hoje. Throttle por last_reminder_at (no máx. 1 por dia por fatura).
 */
export async function runBillingReminders(admin: SupabaseClient): Promise<BillingRemindersResult> {
  const today = brToday()
  const startOfTodayIso = startOfBrDay(0).toISOString()

  const { data: overdueInvoices } = await admin
    .from('billing_invoices')
    .select('id, last_reminder_at')
    .in('status', ['sent', 'overdue', 'draft'])
    .lt('due_date', today)

  const result: BillingRemindersResult = { overdue: (overdueInvoices ?? []).length, sent: 0, failed: 0, skipped: 0 }

  for (const inv of overdueInvoices ?? []) {
    if (inv.last_reminder_at && inv.last_reminder_at >= startOfTodayIso) { result.skipped++; continue }
    const r = await sendBillingChargeEmail(admin, inv.id, { overdue: true })
    if (r.ok) {
      result.sent++
      await admin.from('billing_invoices').update({ last_reminder_at: new Date().toISOString(), status: 'overdue' }).eq('id', inv.id)
    } else {
      result.failed++
    }
  }

  return result
}
