import type { SupabaseClient } from '@supabase/supabase-js'

/** Próximo número de pedido do balcão (por restaurante, reinicia ao incrementar seq). */
export async function nextCounterDisplayNumber(
  admin: SupabaseClient,
  restaurantId: string,
): Promise<number> {
  const { data: row } = await admin
    .from('restaurants')
    .select('counter_order_seq')
    .eq('id', restaurantId)
    .single()

  const next = (row?.counter_order_seq ?? 0) + 1

  await admin
    .from('restaurants')
    .update({ counter_order_seq: next })
    .eq('id', restaurantId)

  return next
}

export function formatCounterOrderLabel(displayNumber: number | null | undefined): string {
  if (!displayNumber) return '—'
  return `#${displayNumber}`
}

export function isCounterTableNumber(tableNumber: string | null | undefined): boolean {
  return tableNumber?.toUpperCase() === 'BALCAO'
}

/** Rótulo de localização para home/checkout (mesa N ou Balcão). */
export function formatServiceLocationLabel(
  tableNumber: string | null | undefined,
  serviceMode?: string | null,
): string {
  if (serviceMode === 'counter' || isCounterTableNumber(tableNumber)) return 'Balcão'
  if (!tableNumber) return 'Mesa'
  return `Mesa ${tableNumber}`
}
