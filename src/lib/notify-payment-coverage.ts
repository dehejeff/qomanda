import type { SupabaseClient } from '@supabase/supabase-js'
import { formatCurrency } from '@/lib/utils'
import { coverageFromPayment, type PaymentRow } from '@/lib/session-billing'
import type { Order } from '@/types'

function toE164(phone: string): string {
  const digits = phone.replace(/\D/g, '')
  if (digits.startsWith('55') && digits.length >= 12) return digits
  if (digits.length === 11 || digits.length === 10) return `55${digits}`
  return digits
}

function buildCoverageMessage(
  restaurantName: string,
  tableNumber: string,
  payerName: string,
  amount: number,
) {
  return (
    `🎉 *${restaurantName}*\n` +
    `Mesa ${tableNumber}\n\n` +
    `Sua conta de *${formatCurrency(amount)}* foi paga por *${payerName}*.\n\n` +
    `Você não precisa fazer nenhum pagamento. Obrigado!`
  )
}

async function sendWhatsApp(
  restaurant: { whatsapp_phone_id?: string | null; whatsapp_access_token?: string | null },
  to: string,
  message: string,
) {
  if (!restaurant.whatsapp_phone_id || !restaurant.whatsapp_access_token) {
    if (process.env.NODE_ENV === 'development') {
      console.log('\n📱 [WhatsApp Mock — cobertura] Para:', toE164(to))
      console.log('📨', message)
      return
    }
    return
  }

  const phoneNumber = toE164(to)
  const url = `https://graph.facebook.com/v18.0/${restaurant.whatsapp_phone_id}/messages`

  await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${restaurant.whatsapp_access_token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: phoneNumber,
      type: 'text',
      text: { body: message, preview_url: false },
    }),
  })
}

/** Notifica participantes quando um pagamento cobre a conta de outra pessoa. */
export async function notifyPaymentCoverage(
  supabase: SupabaseClient,
  sessionId: string,
  payerCustomerId: string | null,
  newPayment: PaymentRow,
  excludePaymentId?: string,
) {
  if (!payerCustomerId) return

  const [sessionRes, ordersRes, paymentsRes, participantsRes] = await Promise.all([
    supabase
      .from('sessions')
      .select('restaurant_id, table:tables(number), restaurant:restaurants(name, whatsapp_phone_id, whatsapp_access_token)')
      .eq('id', sessionId)
      .single(),
    supabase
      .from('orders')
      .select('customer_id, status, created_at, items:order_items(unit_price, quantity)')
      .eq('session_id', sessionId),
    supabase
      .from('payments')
      .select('id, customer_id, amount, service_fee_included, paid_at, created_at')
      .eq('session_id', sessionId)
      .eq('status', 'paid'),
    supabase
      .from('session_participants')
      .select('customer_id')
      .eq('session_id', sessionId),
  ])

  const session = sessionRes.data
  if (!session) return

  const orders = (ordersRes.data ?? []) as Order[]
  const allPayments = (paymentsRes.data ?? []) as (PaymentRow & { id?: string })[]
  const paymentsBefore = excludePaymentId
    ? allPayments.filter(p => p.id !== excludePaymentId)
    : allPayments
  const participantIds = (participantsRes.data ?? []).map(p => p.customer_id)

  const coverage = coverageFromPayment(orders, paymentsBefore, participantIds, newPayment)
  if (coverage.length === 0) return

  const restaurant = session.restaurant as {
    name?: string
    whatsapp_phone_id?: string | null
    whatsapp_access_token?: string | null
  } | null
  const tableNumber = (session.table as { number?: string } | null)?.number ?? '—'
  const restaurantName = restaurant?.name ?? 'Restaurante'

  const customerIds = [payerCustomerId, ...coverage.map(c => c.beneficiaryId)]
  const { data: customers } = await supabase
    .from('customers')
    .select('id, first_name, last_name, whatsapp')
    .in('id', customerIds)

  const payer = customers?.find(c => c.id === payerCustomerId)
  const payerName = payer
    ? [payer.first_name, payer.last_name].filter(Boolean).join(' ')
    : 'Outro cliente'

  for (const { beneficiaryId, amount } of coverage) {
    const beneficiary = customers?.find(c => c.id === beneficiaryId)
    if (!beneficiary?.whatsapp) continue

    const message = buildCoverageMessage(restaurantName, tableNumber, payerName, amount)
    await sendWhatsApp(restaurant ?? {}, beneficiary.whatsapp, message)
  }
}
