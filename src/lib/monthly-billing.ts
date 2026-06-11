import type { SupabaseClient } from '@supabase/supabase-js'
import { previewRestaurantMonthlyBill } from '@/lib/commission-billing'
import { createCustomer, createCharge, type AsaasBillingType } from '@/lib/asaas'

export type SaasBillingType = Extract<AsaasBillingType, 'PIX' | 'BOLETO'>

type BillingRestaurant = {
  id: string; name: string; legal_name: string | null; document_number: string | null
  contact_email: string | null; phone: string | null; asaas_billing_customer_id: string | null
}

export type GenerateInvoiceResult = {
  ok: boolean
  invoiceId?: string
  amount?: number
  charged?: boolean
  reason?: string
}

function pad(n: number) { return String(n).padStart(2, '0') }

/** Garante que o restaurante exista como CLIENTE da conta master no Asaas. */
async function ensureBillingCustomer(
  admin: SupabaseClient,
  restaurant: BillingRestaurant,
): Promise<string | null> {
  if (restaurant.asaas_billing_customer_id) return restaurant.asaas_billing_customer_id
  const cpfCnpj = (restaurant.document_number ?? '').replace(/\D/g, '')
  if (!cpfCnpj) return null

  try {
    const customer = await createCustomer({
      name: restaurant.legal_name ?? restaurant.name,
      cpfCnpj,
      email: restaurant.contact_email ?? undefined,
      mobilePhone: restaurant.phone ? restaurant.phone.replace(/\D/g, '') : undefined,
      externalReference: `saas:${restaurant.id}`,
    })
    await admin.from('restaurants').update({ asaas_billing_customer_id: customer.id }).eq('id', restaurant.id)
    return customer.id
  } catch (err) {
    console.error('[ensureBillingCustomer]', err)
    return null
  }
}

/**
 * Gera a fatura mensal (mensalidade + comissão) do restaurante e, se charge=true,
 * cria a cobrança PIX na conta master do Asaas. Idempotente por período (mês).
 */
export async function generateMonthlyInvoice(
  admin: SupabaseClient,
  restaurantId: string,
  opts: { year: number; month: number; charge?: boolean; billingType?: SaasBillingType },
): Promise<GenerateInvoiceResult> {
  try {
    const { year, month, charge = true, billingType = 'PIX' } = opts
    const periodStart = `${year}-${pad(month)}-01`
    const periodEnd = new Date(year, month, 0).toISOString().slice(0, 10)
    // Vencimento: dia 10 do mês da fatura
    const dueDate = `${year}-${pad(month)}-10`

    // Idempotência por período
    const { data: existing } = await admin
      .from('billing_invoices')
      .select('id, amount, asaas_payment_id, status')
      .eq('restaurant_id', restaurantId)
      .eq('period_start', periodStart)
      .maybeSingle()
    if (existing) {
      return { ok: true, invoiceId: existing.id, amount: Number(existing.amount), charged: Boolean(existing.asaas_payment_id), reason: 'already_exists' }
    }

    // Cálculo (mensalidade + comissão sobre GMV digital do mês)
    const preview = await previewRestaurantMonthlyBill(admin, restaurantId, year, month)
    const amount = preview.totalDue
    if (amount <= 0) return { ok: false, reason: 'zero_amount' }

    const { data: r } = await admin
      .from('restaurants')
      .select('id, name, legal_name, document_number, contact_email, phone, asaas_billing_customer_id, subscription:restaurant_subscriptions(id)')
      .eq('id', restaurantId)
      .single()
    if (!r) return { ok: false, reason: 'restaurant_not_found' }
    const subRaw = Array.isArray(r.subscription) ? r.subscription[0] : r.subscription
    const subscriptionId = (subRaw as { id?: string } | null)?.id ?? null

    const { data: invoice, error: insErr } = await admin
      .from('billing_invoices')
      .insert({
        restaurant_id: restaurantId,
        subscription_id: subscriptionId,
        period_start: periodStart,
        period_end: periodEnd,
        period_year: year,
        period_month: month,
        amount,
        status: 'sent',
        due_date: dueDate,
        notes: `Mensalidade ${preview.monthlyFee.toFixed(2)} + comissão ${preview.commissionTotal.toFixed(2)} (GMV digital R$ ${preview.gmvDigital.toFixed(2)})`,
      })
      .select('id')
      .single()

    if (insErr || !invoice) {
      // corrida: outra execução criou a fatura no mesmo período
      if (insErr?.code === '23505') return { ok: true, reason: 'race_already_exists' }
      console.error('[generateMonthlyInvoice] insert', insErr)
      return { ok: false, reason: 'db_insert_failed' }
    }

    let charged = false
    if (charge) {
      const customerId = await ensureBillingCustomer(admin, {
        id: r.id, name: r.name, legal_name: r.legal_name, document_number: r.document_number,
        contact_email: r.contact_email, phone: r.phone, asaas_billing_customer_id: r.asaas_billing_customer_id,
      })
      if (customerId) {
        try {
          const pay = await createCharge({
            customerId,
            value: amount,
            billingType,
            description: `KiComanda — Mensalidade ${pad(month)}/${year}`,
            dueDate,
            externalReference: `inv:${invoice.id}`,
          })
          await admin.from('billing_invoices').update({
            asaas_payment_id: pay.id,
            charge_method: billingType.toLowerCase(),
            invoice_url: pay.bankSlipUrl ?? pay.invoiceUrl ?? null,
          }).eq('id', invoice.id)
          charged = true
        } catch (err) {
          console.error('[generateMonthlyInvoice] charge', err)
          // fatura fica registrada (sent) sem cobrança; pode reprocessar depois
        }
      }
    }

    return { ok: true, invoiceId: invoice.id, amount, charged }
  } catch (err) {
    console.error('[generateMonthlyInvoice]', err)
    return { ok: false, reason: 'exception' }
  }
}

export type ChargeInvoiceResult = {
  ok: boolean
  charged?: boolean
  invoiceUrl?: string | null
  reason?: string
}

/**
 * Emite (ou re-emite) a cobrança Asaas de uma fatura existente — boleto ou PIX.
 * Idempotente: se já houver cobrança, retorna a URL atual sem duplicar.
 */
export async function chargeInvoice(
  admin: SupabaseClient,
  invoiceId: string,
  billingType: SaasBillingType = 'BOLETO',
): Promise<ChargeInvoiceResult> {
  try {
    const { data: invoice } = await admin
      .from('billing_invoices')
      .select('id, restaurant_id, amount, status, due_date, asaas_payment_id, invoice_url, period_month, period_year')
      .eq('id', invoiceId)
      .maybeSingle()
    if (!invoice) return { ok: false, reason: 'invoice_not_found' }
    if (invoice.status === 'paid') return { ok: false, reason: 'already_paid' }
    if (invoice.asaas_payment_id) {
      return { ok: true, charged: false, invoiceUrl: invoice.invoice_url, reason: 'already_charged' }
    }

    const { data: r } = await admin
      .from('restaurants')
      .select('id, name, legal_name, document_number, contact_email, phone, asaas_billing_customer_id')
      .eq('id', invoice.restaurant_id)
      .single()
    if (!r) return { ok: false, reason: 'restaurant_not_found' }

    const customerId = await ensureBillingCustomer(admin, r as BillingRestaurant)
    if (!customerId) return { ok: false, reason: 'billing_customer_failed' }

    const dueDate = invoice.due_date ?? new Date().toISOString().slice(0, 10)
    const pay = await createCharge({
      customerId,
      value: Number(invoice.amount),
      billingType,
      description: `KiComanda — Mensalidade ${pad(invoice.period_month ?? 0)}/${invoice.period_year ?? ''}`.trim(),
      dueDate,
      externalReference: `inv:${invoice.id}`,
    })
    const invoiceUrl = pay.bankSlipUrl ?? pay.invoiceUrl ?? null
    await admin.from('billing_invoices').update({
      asaas_payment_id: pay.id,
      charge_method: billingType.toLowerCase(),
      invoice_url: invoiceUrl,
      status: invoice.status === 'draft' ? 'sent' : invoice.status,
    }).eq('id', invoice.id)

    return { ok: true, charged: true, invoiceUrl }
  } catch (err) {
    console.error('[chargeInvoice]', err)
    return { ok: false, reason: 'exception' }
  }
}

/** Restaurantes que devem ser cobrados: assinatura ativa/inadimplente ou trial vencido. */
export async function restaurantsDueForBilling(admin: SupabaseClient): Promise<string[]> {
  const nowIso = new Date().toISOString()
  const { data } = await admin
    .from('restaurant_subscriptions')
    .select('restaurant_id, status, trial_ends_at')

  return (data ?? [])
    .filter(s => {
      if (s.status === 'active' || s.status === 'past_due') return true
      if (s.status === 'trialing' && s.trial_ends_at && s.trial_ends_at < nowIso) return true
      return false
    })
    .map(s => s.restaurant_id)
}
