import type { SupabaseClient } from '@supabase/supabase-js'
import { brWeekday, brTimeHHMM } from '@/lib/date-tz'

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

type ArtisticoCfg = {
  couvert_artistico_enabled?: boolean
  couvert_artistico_price?: number | null
  couvert_artistico_label?: string | null
  couvert_artistico_days?: number[] | null
  couvert_artistico_start_time?: string | null
  couvert_artistico_end_time?: string | null
}

/** Sessão está dentro da janela do couvert artístico AGORA (dias + horário, fuso BR)? */
export function isWithinArtisticoWindow(cfg: ArtisticoCfg, now = new Date()): boolean {
  if (!cfg.couvert_artistico_enabled) return false
  if (!(Number(cfg.couvert_artistico_price) > 0)) return false
  const days = Array.isArray(cfg.couvert_artistico_days) ? cfg.couvert_artistico_days : []
  const start = cfg.couvert_artistico_start_time ?? null
  if (days.length === 0 || !start) return false
  if (!days.includes(brWeekday(now))) return false

  const nowHHMM = brTimeHHMM(now)
  if (nowHHMM < start.slice(0, 5)) return false
  const end = cfg.couvert_artistico_end_time ?? null
  if (end && nowHHMM > end.slice(0, 5)) return false
  return true
}

/**
 * Materializa 1 couvert artístico por participante quando a sessão está na
 * janela do show (dias + horário, fuso BR). Idempotente. Chamada de forma
 * preguiçosa (na home/checkout) — sem depender de cron.
 */
export async function materializeArtisticoForSession(
  admin: SupabaseClient,
  sessionId: string,
): Promise<{ created: number }> {
  const { data: session } = await admin
    .from('sessions')
    .select('id, restaurant_id, status, restaurant:restaurants(couvert_artistico_enabled, couvert_artistico_price, couvert_artistico_label, couvert_artistico_days, couvert_artistico_start_time, couvert_artistico_end_time)')
    .eq('id', sessionId)
    .maybeSingle()

  if (!session || session.status === 'closed') return { created: 0 }

  const raw = (session as { restaurant?: ArtisticoCfg | ArtisticoCfg[] }).restaurant
  const cfg = (Array.isArray(raw) ? raw[0] : raw) ?? {}
  if (!isWithinArtisticoWindow(cfg)) return { created: 0 }

  const price = Number(cfg.couvert_artistico_price)
  const { data: parts } = await admin
    .from('session_participants')
    .select('customer_id')
    .eq('session_id', sessionId)

  let created = 0
  for (const p of parts ?? []) {
    if (!p.customer_id) continue
    const res = await addCouvertForCustomer(admin, {
      sessionId, restaurantId: session.restaurant_id, customerId: p.customer_id,
      kind: 'artistico', price, label: cfg.couvert_artistico_label,
    })
    if (res.ok && !res.alreadyExists) created++
  }
  return { created }
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

  // Cancela (não exclui): reflete no painel via realtime UPDATE e sai do
  // faturamento (isBillableOrder ignora 'cancelled'). Mais confiável que DELETE.
  const { error } = await admin
    .from('orders')
    .update({ status: 'cancelled', updated_at: new Date().toISOString() })
    .eq('id', orderId)
  if (error) return { ok: false, error: 'Erro ao remover o couvert.' }
  return { ok: true }
}
