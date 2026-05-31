import type { SupabaseClient } from '@supabase/supabase-js'

/** Atualiza close_request_participants quando um pagamento é confirmado (modo mesa toda). */
export async function syncCloseRequestOnPayment(
  supabase: SupabaseClient,
  sessionId: string,
  customerId: string | null | undefined,
  paymentId: string,
  amount: number,
) {
  if (!customerId) return

  const { data: closeReq } = await supabase
    .from('close_requests')
    .select('id')
    .eq('session_id', sessionId)
    .eq('status', 'pending')
    .maybeSingle()

  if (!closeReq) return

  const { data: participant } = await supabase
    .from('close_request_participants')
    .select('id, amount_owed, amount_paid, status')
    .eq('request_id', closeReq.id)
    .eq('customer_id', customerId)
    .maybeSingle()

  if (!participant) return

  const newPaid = Number(participant.amount_paid ?? 0) + amount
  const owed = Number(participant.amount_owed ?? 0)
  const fullyPaid = newPaid >= owed - 0.02

  await supabase
    .from('close_request_participants')
    .update({
      amount_paid: newPaid,
      payment_id: paymentId,
      status: fullyPaid ? 'paid' : participant.status === 'pending' ? 'confirmed' : participant.status,
      paid_at: fullyPaid ? new Date().toISOString() : null,
    })
    .eq('id', participant.id)
}
