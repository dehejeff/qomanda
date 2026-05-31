const ALCOHOL_KEYWORDS =
  /cerveja|vinho|chop|chopp|drink|caipirinha|whisky|whiskey|vodka|gin|champagne|espumante|licor|cachaça|cachaca|corote|heineken|budweiser|stella|malte|\bipa\b|aperol|spritz|mojito|margarita|tequila|rum|absolut|redbull\s*\+|long\s*neck/i

type OrderLineItem = {
  unit_price: number
  quantity: number
  menu_item?: {
    name?: string
    contains_alcohol?: boolean
    category?: { name?: string } | null
  } | null
}

export function isAlcoholicItem(item: OrderLineItem): boolean {
  if (item.menu_item?.contains_alcohol) return true
  const name = item.menu_item?.name ?? ''
  const category = item.menu_item?.category?.name ?? ''
  return ALCOHOL_KEYWORDS.test(name) || ALCOHOL_KEYWORDS.test(category)
}

export function splitConsumptionByAlcohol(items: OrderLineItem[], serviceFeeMultiplier = 1.1) {
  const foodItems = items.filter(i => !isAlcoholicItem(i))
  const alcItems = items.filter(i => isAlcoholicItem(i))
  const foodSub = foodItems.reduce((s, i) => s + i.unit_price * i.quantity, 0)
  const alcSub = alcItems.reduce((s, i) => s + i.unit_price * i.quantity, 0)
  return {
    food: foodSub * serviceFeeMultiplier,
    alcohol: alcSub * serviceFeeMultiplier,
    hasAlcohol: alcItems.length > 0,
  }
}

/** Divide o valor a pagar entre alimentação e álcool (2 recibos). */
export function splitPaymentAmounts(
  payTotal: number,
  foodBase: number,
  alcoholBase: number,
  extra = 0,
) {
  const billable = Math.round(Math.max(0, payTotal) * 100) / 100
  if (billable <= 0) return { food: 0, alcohol: 0 }

  if (alcoholBase <= 0) return { food: billable, alcohol: 0 }
  if (foodBase <= 0) return { food: 0, alcohol: billable }

  const extraAmt = Math.max(0, extra)
  const splittable = Math.max(0, billable - extraAmt)
  const ratio = foodBase / (foodBase + alcoholBase)
  const food = Math.round((splittable * ratio + extraAmt) * 100) / 100
  const alcohol = Math.round((billable - food) * 100) / 100

  return { food, alcohol }
}
