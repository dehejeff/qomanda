import type { SupabaseClient } from '@supabase/supabase-js'
import { menuItemEffectivePrice } from '@/lib/menu-item-pricing'

export type WaiterOrderParticipant = { customerId: string; name: string }

export type WaiterOrderMenuItem = {
  id: string
  name: string
  description: string | null
  price: number
  promoPrice: number | null
  effectivePrice: number
  imageUrl: string | null
  containsAlcohol: boolean
}

export type WaiterOrderMenuCategory = {
  id: string
  name: string
  items: WaiterOrderMenuItem[]
}

export type WaiterOrderContext = {
  session: { id: string; status: string; tableNumber: string | null }
  participants: WaiterOrderParticipant[]
  menu: WaiterOrderMenuCategory[]
}

function joinName(c: { first_name?: string | null; last_name?: string | null } | null): string {
  if (!c) return 'Cliente'
  const name = `${c.first_name ?? ''} ${c.last_name ?? ''}`.trim()
  return name || 'Cliente'
}

/** Resolve a sessão aberta a partir de sessionId OU tableId (a mesa pode ter sessão ativa). */
async function resolveSession(
  admin: SupabaseClient,
  restaurantId: string,
  opts: { sessionId?: string; tableId?: string },
): Promise<{ id: string; status: string; tableNumber: string | null } | null> {
  if (opts.sessionId) {
    const { data } = await admin
      .from('sessions')
      .select('id, status, restaurant_id, table:tables ( number )')
      .eq('id', opts.sessionId)
      .maybeSingle()
    if (!data || data.restaurant_id !== restaurantId) return null
    const tRaw = (data as { table?: { number?: string } | { number?: string }[] }).table
    const t = Array.isArray(tRaw) ? tRaw[0] : tRaw
    return { id: data.id, status: data.status, tableNumber: t?.number ?? null }
  }
  if (opts.tableId) {
    const { data: table } = await admin
      .from('tables')
      .select('id, number, restaurant_id')
      .eq('id', opts.tableId)
      .maybeSingle()
    if (!table || table.restaurant_id !== restaurantId) return null
    const { data: session } = await admin
      .from('sessions')
      .select('id, status')
      .eq('table_id', opts.tableId)
      .neq('status', 'closed')
      .order('started_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (!session) return null
    return { id: session.id, status: session.status, tableNumber: table.number ?? null }
  }
  return null
}

/** Contexto para o garçom montar um pedido: sessão + pessoas na mesa + cardápio disponível. */
export async function fetchWaiterOrderContext(
  admin: SupabaseClient,
  restaurantId: string,
  opts: { sessionId?: string; tableId?: string },
): Promise<WaiterOrderContext | null> {
  const session = await resolveSession(admin, restaurantId, opts)
  if (!session) return null

  const [participantsRes, menuRes] = await Promise.all([
    admin
      .from('session_participants')
      .select('customer_id, customer:customers ( first_name, last_name )')
      .eq('session_id', session.id),
    admin
      .from('menu_categories')
      .select('id, name, display_order, items:menu_items(*)')
      .eq('restaurant_id', restaurantId)
      .order('display_order'),
  ])

  const participants: WaiterOrderParticipant[] = (participantsRes.data ?? []).map(p => {
    const cRaw = (p as { customer?: { first_name?: string; last_name?: string } | { first_name?: string; last_name?: string }[] }).customer
    const c = Array.isArray(cRaw) ? cRaw[0] : cRaw
    return { customerId: p.customer_id, name: joinName(c ?? null) }
  })

  const menu: WaiterOrderMenuCategory[] = (menuRes.data ?? [])
    .map(cat => {
      const itemsRaw = (cat.items ?? []) as Array<{
        id: string; name: string; description: string | null; price: number
        promo_price?: number | null; available: boolean; image_url: string | null; contains_alcohol?: boolean
      }>
      const items = itemsRaw
        .filter(i => i.available)
        .map(i => ({
          id: i.id,
          name: i.name,
          description: i.description ?? null,
          price: Number(i.price),
          promoPrice: i.promo_price != null ? Number(i.promo_price) : null,
          effectivePrice: menuItemEffectivePrice({ price: Number(i.price), promo_price: i.promo_price ?? null }),
          imageUrl: i.image_url ?? null,
          containsAlcohol: Boolean(i.contains_alcohol),
        }))
      return { id: cat.id as string, name: cat.name as string, items }
    })
    .filter(cat => cat.items.length > 0)

  return { session, participants, menu }
}

export type CreateWaiterOrderInput = {
  sessionId: string
  customerId?: string | null
  items: { menuItemId: string; quantity: number; notes?: string | null }[]
}

export type CreateWaiterOrderResult =
  | { ok: true; orderId: string; total: number }
  | { ok: false; error: string }

/**
 * Cria um pedido em nome de uma pessoa da mesa. Preços são lidos do banco
 * (nunca confiamos no cliente). Valida sessão aberta + itens disponíveis.
 */
export async function createWaiterOrder(
  admin: SupabaseClient,
  restaurantId: string,
  input: CreateWaiterOrderInput,
): Promise<CreateWaiterOrderResult> {
  const session = await resolveSession(admin, restaurantId, { sessionId: input.sessionId })
  if (!session) return { ok: false, error: 'Sessão não encontrada.' }
  if (session.status === 'closed') return { ok: false, error: 'Esta mesa já foi encerrada.' }

  const items = (input.items ?? []).filter(i => i.menuItemId && i.quantity > 0)
  if (items.length === 0) return { ok: false, error: 'Selecione ao menos um item.' }

  // Valida o participante (se informado) pertence à sessão.
  if (input.customerId) {
    const { data: part } = await admin
      .from('session_participants')
      .select('customer_id')
      .eq('session_id', session.id)
      .eq('customer_id', input.customerId)
      .maybeSingle()
    if (!part) return { ok: false, error: 'Pessoa não está nesta mesa.' }
  }

  // Preços do banco (escopo do restaurante + disponível).
  const ids = [...new Set(items.map(i => i.menuItemId))]
  const { data: menuItems } = await admin
    .from('menu_items')
    .select('id, price, promo_price, available, restaurant_id')
    .in('id', ids)
    .eq('restaurant_id', restaurantId)

  const priceMap = new Map<string, number>()
  for (const mi of menuItems ?? []) {
    if (!mi.available) continue
    priceMap.set(mi.id, menuItemEffectivePrice({ price: Number(mi.price), promo_price: mi.promo_price ?? null }))
  }
  const invalid = items.find(i => !priceMap.has(i.menuItemId))
  if (invalid) return { ok: false, error: 'Item indisponível no cardápio.' }

  const { data: order, error: orderErr } = await admin
    .from('orders')
    .insert({
      session_id: session.id,
      restaurant_id: restaurantId,
      customer_id: input.customerId ?? null,
      status: 'pending',
    })
    .select('id')
    .single()
  if (orderErr || !order) return { ok: false, error: 'Erro ao criar pedido.' }

  const rows = items.map(i => ({
    order_id: order.id,
    menu_item_id: i.menuItemId,
    quantity: i.quantity,
    unit_price: priceMap.get(i.menuItemId) as number,
    notes: i.notes?.trim() || null,
  }))
  const { error: itemsErr } = await admin.from('order_items').insert(rows)
  if (itemsErr) {
    await admin.from('orders').delete().eq('id', order.id)
    return { ok: false, error: 'Erro ao gravar itens do pedido.' }
  }

  const total = rows.reduce((s, r) => s + r.unit_price * r.quantity, 0)
  return { ok: true, orderId: order.id, total }
}
