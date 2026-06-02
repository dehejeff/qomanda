import type { SupabaseClient } from '@supabase/supabase-js'
import { generateConfirmationCode } from '@/lib/utils'
import { syncCloseRequestOnPayment } from '@/lib/sync-payment-close-request'
import { closeSessionIfSettled } from '@/lib/close-session-if-settled'
import { notifyPaymentCoverage } from '@/lib/notify-payment-coverage'
import { grantEarnedLoyaltyOffers } from '@/lib/grant-loyalty-offers'
import { applyCommissionToPayment } from '@/lib/payment-commission'
import { emitNfeForPayment } from '@/lib/nfe/emit-nfe'

export type PaymentConfirmRow = {
  id: string
  session_id: string
  customer_id: string | null
  restaurant_id: string
  amount: number
  service_fee_included: boolean | null
  status: string
  method: string
}

export type ConfirmPaymentResult = {
  confirmationCode: string
  sessionClosed: boolean
}

/** Marca pagamento como pago e dispara efeitos colaterais (mesa, close request, fidelidade). */
export async function confirmPaymentRecord(
  supabase: SupabaseClient,
  payment: PaymentConfirmRow,
): Promise<ConfirmPaymentResult> {
  if (payment.status === 'paid') {
    return { confirmationCode: '', sessionClosed: false }
  }

  const confirmationCode = generateConfirmationCode()
  const paidAt = new Date().toISOString()

  const { error } = await supabase
    .from('payments')
    .update({
      status: 'paid',
      confirmation_code: confirmationCode,
      paid_at: paidAt,
    })
    .eq('id', payment.id)
    .in('status', ['pending', 'processing'])

  if (error) {
    throw new Error(error.message)
  }

  const { data: restaurant } = await supabase
    .from('restaurants')
    .select('plan_id')
    .eq('id', payment.restaurant_id)
    .maybeSingle()

  await applyCommissionToPayment(
    supabase,
    payment.id,
    payment.restaurant_id,
    restaurant?.plan_id ?? null,
    Number(payment.amount),
    payment.method,
    new Date(paidAt),
  )

  await syncCloseRequestOnPayment(
    supabase,
    payment.session_id,
    payment.customer_id,
    payment.id,
    Number(payment.amount),
  )

  await notifyPaymentCoverage(
    supabase,
    payment.session_id,
    payment.customer_id,
    {
      customer_id: payment.customer_id,
      amount: Number(payment.amount),
      service_fee_included: payment.service_fee_included,
      paid_at: paidAt,
    },
    payment.id,
  )

  const settlement = await closeSessionIfSettled(supabase, payment.session_id)

  if (payment.customer_id) {
    await grantEarnedLoyaltyOffers(supabase, payment.customer_id, payment.restaurant_id)
  }

  // NF-e automática (best-effort, não bloqueia a confirmação). Só age se o
  // restaurante tiver nfe_enabled + nfe_auto_emit + tipo de nota definido.
  try {
    const { data: r } = await supabase
      .from('restaurants')
      .select('nfe_enabled, nfe_auto_emit, nfe_status')
      .eq('id', payment.restaurant_id)
      .maybeSingle()
    if (r?.nfe_enabled && r?.nfe_auto_emit && r?.nfe_status === 'active') {
      await emitNfeForPayment(supabase, payment.id)
    }
  } catch (err) {
    console.error('[confirmPaymentRecord] nfe auto-emit', err)
  }

  return { confirmationCode, sessionClosed: settlement.closed }
}
