import type { MenuItem } from '@/types'

/** Preço cobrado no pedido (promo quando válido). */
export function menuItemEffectivePrice(item: Pick<MenuItem, 'price' | 'promo_price'>): number {
  const promo = item.promo_price
  if (promo != null && promo > 0 && promo < item.price) return promo
  return item.price
}

export function menuItemHasPromo(item: Pick<MenuItem, 'price' | 'promo_price'>): boolean {
  const promo = item.promo_price
  return promo != null && promo > 0 && promo < item.price
}
