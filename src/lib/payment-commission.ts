import type { SupabaseClient } from '@supabase/supabase-js'
import { commissionOnPayment, isCommissionExemptMethod } from '@/lib/commission-tiers'
import { digitalGmvMonthToDate } from '@/lib/commission-billing'

export async function applyCommissionToPayment(
  admin: SupabaseClient,
  paymentId: string,
  restaurantId: string,
  planId: string | null,
  amount: number,
  method: string,
  paidAt: Date = new Date(),
): Promise<void> {
  if (isCommissionExemptMethod(method)) {
    await admin.from('payments').update({
      commission_exempt: true,
      commission_rate: 0,
      commission_amount: 0,
    }).eq('id', paymentId)
    return
  }

  const gmvBefore = await digitalGmvMonthToDate(admin, restaurantId, paidAt)
  const { ratePercent, commissionAmount } = commissionOnPayment(amount, planId, gmvBefore)

  await admin.from('payments').update({
    commission_exempt: false,
    commission_rate: ratePercent,
    commission_amount: commissionAmount,
  }).eq('id', paymentId)
}
