import type { SupabaseClient } from '@supabase/supabase-js'
import { fetchCustomerRestaurantLifetimeTotals } from '@/lib/restaurant-monthly-stats'

export type ReceiptNfe = {
  status: string
  noteType: 'nfce' | 'nfse'
  danfeUrl: string | null
}

export type ReceiptRow = {
  id: string
  amount: number
  method: string
  split_type: 'food' | 'alcohol' | 'combined'
  service_fee_included?: boolean | null
  confirmation_code: string | null
  paid_at: string | null
  created_at: string
  restaurantName: string
  restaurantSlug: string
  restaurantId: string
  logoUrl: string | null
  tableNumber: string
  sessionId: string
  nfe: ReceiptNfe | null
}

export type ReceiptRestaurantSummary = {
  restaurantId: string
  slug: string
  name: string
  logoUrl: string | null
  receiptCount: number
  totalAmount: number
  /** Total histórico (inclui recibos já purgados) */
  lifetimeTotal: number
  lifetimePaymentCount: number
  lastReceiptAt: string
}

export type ReceiptDayGroup = {
  date: string
  totalAmount: number
  receipts: ReceiptRow[]
}

function receiptDateKey(paidAt: string | null, createdAt: string): string {
  const raw = paidAt ?? createdAt
  const d = new Date(raw)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export async function fetchCustomerReceipts(
  supabase: SupabaseClient,
  customerId: string,
): Promise<ReceiptRow[]> {
  const { data: payments } = await supabase
    .from('payments')
    .select(`
      id, amount, method, split_type, service_fee_included,
      confirmation_code, paid_at, created_at, session_id, restaurant_id,
      session:sessions(
        id,
        table:tables(number),
        restaurant:restaurants(id, name, slug, logo_url)
      ),
      snapshot:payment_receipt_snapshots(
        restaurant_name, restaurant_slug, logo_url, table_number,
        restaurant_id, confirmation_code, paid_at, amount, method, split_type, service_fee_included
      )
    `)
    .eq('customer_id', customerId)
    .eq('status', 'paid')
    .order('paid_at', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false })

  // Notas fiscais por pagamento (mais recente vence)
  const paymentIds = (payments ?? []).map(p => p.id)
  const nfeByPayment = new Map<string, ReceiptNfe>()
  if (paymentIds.length > 0) {
    const { data: notes } = await supabase
      .from('nfe_invoices')
      .select('payment_id, status, note_type, danfe_url, created_at')
      .in('payment_id', paymentIds)
      .order('created_at', { ascending: false })
    for (const n of notes ?? []) {
      if (!n.payment_id || nfeByPayment.has(n.payment_id)) continue
      nfeByPayment.set(n.payment_id, {
        status: n.status,
        noteType: n.note_type,
        danfeUrl: n.danfe_url ?? null,
      })
    }
  }

  return (payments ?? []).map(p => {
    type Sess = {
      id: string
      table: { number: string } | { number: string }[] | null
      restaurant: { id: string; name: string; slug: string; logo_url: string | null } | { id: string; name: string; slug: string; logo_url: string | null }[] | null
    }
    type Snap = {
      restaurant_name: string
      restaurant_slug: string
      logo_url: string | null
      table_number: string
      restaurant_id: string
      confirmation_code: string | null
      paid_at: string
      amount: number
      method: string
      split_type: string
      service_fee_included: boolean
    }
    const snapRaw = p.snapshot as Snap | Snap[] | null
    const snap = Array.isArray(snapRaw) ? snapRaw[0] : snapRaw
    const sessRaw = p.session as Sess | Sess[] | null
    const sess = Array.isArray(sessRaw) ? sessRaw[0] : sessRaw
    const tableRaw = sess?.table
    const table = Array.isArray(tableRaw) ? tableRaw[0] : tableRaw
    const restRaw = sess?.restaurant
    const rest = Array.isArray(restRaw) ? restRaw[0] : restRaw

    return {
      id: p.id,
      amount: snap ? Number(snap.amount) : Number(p.amount),
      method: snap?.method ?? p.method,
      split_type: (snap?.split_type ?? p.split_type) as ReceiptRow['split_type'],
      service_fee_included: snap?.service_fee_included ?? p.service_fee_included,
      confirmation_code: snap?.confirmation_code ?? p.confirmation_code,
      paid_at: snap?.paid_at ?? p.paid_at,
      created_at: p.created_at,
      restaurantName: snap?.restaurant_name ?? rest?.name ?? 'Restaurante',
      restaurantSlug: snap?.restaurant_slug ?? rest?.slug ?? '',
      restaurantId: snap?.restaurant_id ?? rest?.id ?? p.restaurant_id ?? '',
      logoUrl: snap?.logo_url ?? rest?.logo_url ?? null,
      tableNumber: snap?.table_number ?? table?.number ?? '—',
      sessionId: p.session_id,
      nfe: nfeByPayment.get(p.id) ?? null,
    }
  })
}

export function groupReceiptsByRestaurant(
  receipts: ReceiptRow[],
  lifetimeByRestaurant?: Map<string, { totalSpent: number; paymentCount: number; lastPaymentAt: string | null }>,
): ReceiptRestaurantSummary[] {
  const map = new Map<string, ReceiptRestaurantSummary>()

  for (const r of receipts) {
    const key = r.restaurantId || r.restaurantSlug
    if (!key) continue
    const at = r.paid_at ?? r.created_at
    const lifetime = lifetimeByRestaurant?.get(r.restaurantId)
    const existing = map.get(key)
    if (!existing) {
      map.set(key, {
        restaurantId: r.restaurantId,
        slug: r.restaurantSlug,
        name: r.restaurantName,
        logoUrl: r.logoUrl,
        receiptCount: 1,
        totalAmount: r.amount,
        lifetimeTotal: lifetime?.totalSpent ?? r.amount,
        lifetimePaymentCount: lifetime?.paymentCount ?? 1,
        lastReceiptAt: at,
      })
    } else {
      existing.receiptCount += 1
      existing.totalAmount += r.amount
      if (new Date(at) > new Date(existing.lastReceiptAt)) {
        existing.lastReceiptAt = at
      }
    }
  }

  // Restaurantes só no histórico agregado (recibos detalhados expirados)
  if (lifetimeByRestaurant) {
    for (const [restaurantId, totals] of lifetimeByRestaurant) {
      if (map.has(restaurantId)) continue
      const sample = receipts.find(r => r.restaurantId === restaurantId)
      if (sample) continue
      // Sem recibo recente — omitir da lista principal (só totais no perfil futuro)
    }
  }

  return [...map.values()].sort(
    (a, b) => new Date(b.lastReceiptAt).getTime() - new Date(a.lastReceiptAt).getTime(),
  )
}

export async function groupReceiptsByRestaurantWithLifetime(
  supabase: SupabaseClient,
  customerId: string,
  receipts: ReceiptRow[],
): Promise<ReceiptRestaurantSummary[]> {
  const lifetime = await fetchCustomerRestaurantLifetimeTotals(supabase, customerId)
  const grouped = groupReceiptsByRestaurant(receipts, lifetime)

  for (const row of grouped) {
    const lt = lifetime.get(row.restaurantId)
    if (lt) {
      row.lifetimeTotal = lt.totalSpent
      row.lifetimePaymentCount = lt.paymentCount
    }
  }

  return grouped
}

export function groupReceiptsByDay(receipts: ReceiptRow[], slug: string, dateFilter?: string): {
  restaurant: { slug: string; name: string; logoUrl: string | null }
  days: ReceiptDayGroup[]
} | null {
  const filtered = receipts.filter(r => r.restaurantSlug === slug)
  if (filtered.length === 0) return null

  const sample = filtered[0]
  const dayMap = new Map<string, ReceiptRow[]>()

  for (const r of filtered) {
    const key = receiptDateKey(r.paid_at, r.created_at)
    if (dateFilter && key !== dateFilter) continue
    const list = dayMap.get(key) ?? []
    list.push(r)
    dayMap.set(key, list)
  }

  const days = [...dayMap.entries()]
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([date, dayReceipts]) => ({
      date,
      totalAmount: dayReceipts.reduce((s, x) => s + x.amount, 0),
      receipts: dayReceipts,
    }))

  return {
    restaurant: { slug: sample.restaurantSlug, name: sample.restaurantName, logoUrl: sample.logoUrl },
    days,
  }
}
