import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Helpers de couvert (entrada) e couvert artístico.
 *
 * Couvert é modelado como um item de cardápio "de sistema" (available=false,
 * couvert_kind != 'none') referenciado por um pedido próprio com status
 * 'delivered' (não passa pela cozinha). Assim reaproveita todo o pipeline de
 * billing / divisão / comissão / NF-e, ficando apenas fora da taxa de serviço.
 */

export type CouvertKind = 'couvert' | 'artistico'

const DEFAULT_LABEL: Record<CouvertKind, string> = {
  couvert: 'Couvert',
  artistico: 'Couvert artístico',
}

/** Garante o item de cardápio de sistema do couvert (cria se faltar) e sincroniza nome/preço. */
export async function ensureCouvertMenuItem(
  admin: SupabaseClient,
  restaurantId: string,
  kind: CouvertKind,
  price: number,
  label?: string | null,
): Promise<string | null> {
  const name = (label && label.trim()) || DEFAULT_LABEL[kind]

  const { data: existing } = await admin
    .from('menu_items')
    .select('id')
    .eq('restaurant_id', restaurantId)
    .eq('couvert_kind', kind)
    .limit(1)
    .maybeSingle()

  if (existing) {
    await admin.from('menu_items').update({ name, price }).eq('id', existing.id)
    return existing.id
  }

  // Item precisa de uma categoria (category_id NOT NULL). Reusa a primeira ou cria "Couvert".
  let categoryId: string | null = null
  const { data: cat } = await admin
    .from('menu_categories')
    .select('id')
    .eq('restaurant_id', restaurantId)
    .order('display_order', { ascending: true })
    .limit(1)
    .maybeSingle()
  categoryId = cat?.id ?? null

  if (!categoryId) {
    const { data: createdCat } = await admin
      .from('menu_categories')
      .insert({ restaurant_id: restaurantId, name: 'Couvert', display_order: 999 })
      .select('id')
      .single()
    categoryId = createdCat?.id ?? null
  }
  if (!categoryId) return null

  const { data: item } = await admin
    .from('menu_items')
    .insert({
      restaurant_id: restaurantId,
      category_id: categoryId,
      name,
      price,
      available: false, // não aparece no cardápio normal
      couvert_kind: kind,
    })
    .select('id')
    .single()

  return item?.id ?? null
}

/** Retorna o id do pedido de couvert (deste item) do cliente na sessão, se existir e não cancelado. */
export async function findCouvertOrderId(
  admin: SupabaseClient,
  sessionId: string,
  customerId: string,
  couvertItemId: string,
): Promise<string | null> {
  const { data: orders } = await admin
    .from('orders')
    .select('id, status, items:order_items(menu_item_id)')
    .eq('session_id', sessionId)
    .eq('customer_id', customerId)
    .neq('status', 'cancelled')

  for (const o of orders ?? []) {
    const items = (o.items ?? []) as { menu_item_id: string }[]
    if (items.some(it => it.menu_item_id === couvertItemId)) return o.id
  }
  return null
}

/** Adiciona 1 couvert (por pessoa) para o cliente, idempotente. Não passa pela cozinha. */
export async function addCouvertForCustomer(
  admin: SupabaseClient,
  params: {
    sessionId: string
    restaurantId: string
    customerId: string
    kind: CouvertKind
    price: number
    label?: string | null
  },
): Promise<{ ok: boolean; alreadyExists?: boolean; error?: string }> {
  const { sessionId, restaurantId, customerId, kind, price, label } = params
  if (!(price > 0)) return { ok: false, error: 'Preço de couvert inválido.' }

  const itemId = await ensureCouvertMenuItem(admin, restaurantId, kind, price, label)
  if (!itemId) return { ok: false, error: 'Não foi possível preparar o item de couvert.' }

  const existing = await findCouvertOrderId(admin, sessionId, customerId, itemId)
  if (existing) return { ok: true, alreadyExists: true }

  const { data: order, error: orderErr } = await admin
    .from('orders')
    // status 'delivered' = não entra na fila da cozinha; couvert não é preparo.
    .insert({ session_id: sessionId, restaurant_id: restaurantId, customer_id: customerId, status: 'delivered' })
    .select('id')
    .single()
  if (orderErr || !order) return { ok: false, error: 'Erro ao adicionar couvert.' }

  const { error: itemErr } = await admin
    .from('order_items')
    .insert({ order_id: order.id, menu_item_id: itemId, quantity: 1, unit_price: price })
  if (itemErr) {
    await admin.from('orders').delete().eq('id', order.id)
    return { ok: false, error: 'Erro ao adicionar couvert.' }
  }

  return { ok: true }
}

/** Remove o couvert (deste kind) do cliente, se ele ainda não pagou nada na sessão. */
export async function removeCouvertForCustomer(
  admin: SupabaseClient,
  params: { sessionId: string; restaurantId: string; customerId: string; kind: CouvertKind },
): Promise<{ ok: boolean; error?: string }> {
  const { sessionId, restaurantId, customerId, kind } = params

  const { data: item } = await admin
    .from('menu_items')
    .select('id')
    .eq('restaurant_id', restaurantId)
    .eq('couvert_kind', kind)
    .limit(1)
    .maybeSingle()
  if (!item) return { ok: true } // nada a remover

  const orderId = await findCouvertOrderId(admin, sessionId, customerId, item.id)
  if (!orderId) return { ok: true }

  // Bloqueia remoção se o cliente já pagou algo (a conta já considerou o couvert).
  const { data: paid } = await admin
    .from('payments')
    .select('id')
    .eq('session_id', sessionId)
    .eq('customer_id', customerId)
    .eq('status', 'paid')
    .limit(1)
    .maybeSingle()
  if (paid) return { ok: false, error: 'Você já efetuou um pagamento — não é possível remover o couvert.' }

  await admin.from('orders').delete().eq('id', orderId) // cascade remove order_items
  return { ok: true }
}
