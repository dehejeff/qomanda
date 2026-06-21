import type { SupabaseClient } from '@supabase/supabase-js'
import { whatsappForStorage } from '@/lib/customer-lookup'

/**
 * Fila de espera por característica de mesa. Matching e expiração rodam de forma
 * preguiçosa (sem cron): quando uma mesa libera, quando a equipe abre a fila, ou
 * num poll leve. Detalhes: docs/modulos/FILA-ESPERA.md
 */

const DEFAULT_TOLERANCE_MIN = 10

/** Expira entradas 'notified' cuja tolerância passou (volta a vaga para o próximo). */
export async function expireStaleNotified(admin: SupabaseClient, restaurantId?: string): Promise<void> {
  let q = admin
    .from('table_waitlist')
    .update({ status: 'expired' })
    .eq('status', 'notified')
    .lt('expires_at', new Date().toISOString())
  if (restaurantId) q = q.eq('restaurant_id', restaurantId)
  await q
}

/** Chama o próximo 'waiting' de uma característica, se não houver ninguém ativo notificado. */
async function notifyNextForFeature(
  admin: SupabaseClient,
  restaurantId: string,
  featureId: string,
  tableId: string,
  toleranceMin: number,
  capacity?: number | null,
): Promise<boolean> {
  const nowIso = new Date().toISOString()

  // Já tem alguém notificado (dentro da tolerância) para essa característica? Não chama outro.
  const { data: active } = await admin
    .from('table_waitlist')
    .select('id')
    .eq('restaurant_id', restaurantId)
    .eq('feature_id', featureId)
    .eq('status', 'notified')
    .gte('expires_at', nowIso)
    .limit(1)
    .maybeSingle()
  if (active) return false

  // Só chama quem cabe na mesa (party_size <= capacidade). Capacidade null = sem limite.
  let nextQ = admin
    .from('table_waitlist')
    .select('id')
    .eq('restaurant_id', restaurantId)
    .eq('feature_id', featureId)
    .eq('status', 'waiting')
    .order('created_at', { ascending: true })
    .limit(1)
  if (capacity != null) nextQ = nextQ.lte('party_size', capacity)
  const { data: next } = await nextQ.maybeSingle()
  if (!next) return false

  const expiresAt = new Date(Date.now() + toleranceMin * 60_000).toISOString()
  const { error } = await admin
    .from('table_waitlist')
    .update({ status: 'notified', notified_table_id: tableId, notified_at: nowIso, expires_at: expiresAt })
    .eq('id', next.id)
    .eq('status', 'waiting') // evita corrida
  if (!error) {
    const { enqueueWaitlistReadyNotifications } = await import('@/lib/waitlist-notify')
    await enqueueWaitlistReadyNotifications(admin, next.id)
  }
  return !error
}

/** Chama o próximo 'waiting' de uma característica para uma mesa específica (uso manual pela equipe). */
export async function callNextForFeature(
  admin: SupabaseClient,
  restaurantId: string,
  featureId: string,
  tableId: string,
  toleranceMin = DEFAULT_TOLERANCE_MIN,
  capacity?: number | null,
): Promise<boolean> {
  const nowIso = new Date().toISOString()
  let nextQ = admin
    .from('table_waitlist')
    .select('id')
    .eq('restaurant_id', restaurantId)
    .eq('feature_id', featureId)
    .eq('status', 'waiting')
    .order('created_at', { ascending: true })
    .limit(1)
  if (capacity != null) nextQ = nextQ.lte('party_size', capacity)
  const { data: next } = await nextQ.maybeSingle()
  if (!next) return false
  const expiresAt = new Date(Date.now() + toleranceMin * 60_000).toISOString()
  const { error } = await admin
    .from('table_waitlist')
    .update({ status: 'notified', notified_table_id: tableId, notified_at: nowIso, expires_at: expiresAt })
    .eq('id', next.id)
    .eq('status', 'waiting')
  if (!error) {
    const { enqueueWaitlistReadyNotifications } = await import('@/lib/waitlist-notify')
    await enqueueWaitlistReadyNotifications(admin, next.id)
  }
  return !error
}

/** Notifica o próximo 'waiting' sem seção específica (feature_id IS NULL). */
export async function callNextForAnySection(
  admin: SupabaseClient,
  restaurantId: string,
  tableId: string,
  toleranceMin: number,
  capacity?: number | null,
): Promise<boolean> {
  const nowIso = new Date().toISOString()
  const { data: active } = await admin
    .from('table_waitlist')
    .select('id')
    .eq('restaurant_id', restaurantId)
    .is('feature_id', null)
    .eq('status', 'notified')
    .gte('expires_at', nowIso)
    .limit(1)
    .maybeSingle()
  if (active) return false

  let nextQ = admin
    .from('table_waitlist')
    .select('id')
    .eq('restaurant_id', restaurantId)
    .is('feature_id', null)
    .eq('status', 'waiting')
    .order('created_at', { ascending: true })
    .limit(1)
  if (capacity != null) nextQ = nextQ.lte('party_size', capacity)
  const { data: next } = await nextQ.maybeSingle()
  if (!next) return false

  const expiresAt = new Date(Date.now() + toleranceMin * 60_000).toISOString()
  const { error } = await admin
    .from('table_waitlist')
    .update({ status: 'notified', notified_table_id: tableId, notified_at: nowIso, expires_at: expiresAt })
    .eq('id', next.id)
    .eq('status', 'waiting')
  if (!error) {
    const { enqueueWaitlistReadyNotifications } = await import('@/lib/waitlist-notify')
    await enqueueWaitlistReadyNotifications(admin, next.id)
  }
  return !error
}

/** Mesa ficou livre → chama o próximo da fila para cada característica da mesa. */
export async function notifyWaitlistOnTableFree(admin: SupabaseClient, tableId?: string | null): Promise<void> {
  if (!tableId) return
  try {
    const { data: table } = await admin
      .from('tables')
      .select('id, restaurant_id, capacity, restaurant:restaurants(waitlist_tolerance_minutes)')
      .eq('id', tableId)
      .maybeSingle()
    if (!table) return

    const restaurantId = table.restaurant_id as string
    const capacity = (table as { capacity?: number | null }).capacity ?? null
    const raw = (table as { restaurant?: { waitlist_tolerance_minutes?: number } | { waitlist_tolerance_minutes?: number }[] }).restaurant
    const cfg = Array.isArray(raw) ? raw[0] : raw
    const tolerance = Number(cfg?.waitlist_tolerance_minutes ?? DEFAULT_TOLERANCE_MIN)

    await expireStaleNotified(admin, restaurantId)

    const { data: feats } = await admin
      .from('table_feature_map')
      .select('feature_id')
      .eq('table_id', tableId)

    for (const f of feats ?? []) {
      await notifyNextForFeature(admin, restaurantId, (f as { feature_id: string }).feature_id, tableId, tolerance, capacity)
    }

    // Mesa sem seção atribuída → notifica entradas com feature_id IS NULL.
    if ((feats ?? []).length === 0) {
      await callNextForAnySection(admin, restaurantId, tableId, tolerance, capacity)
    }
  } catch (err) {
    console.error('[waitlist] notifyWaitlistOnTableFree', err)
  }
}

export type WaitlistEntryStatus = {
  id: string
  featureId: string | null
  featureName: string
  featureEmoji: string | null
  status: 'waiting' | 'notified' | 'seated' | 'expired' | 'cancelled'
  position: number | null
  notifiedTableNumber: string | null
  expiresAt: string | null
}

/** Status (poll) das entradas do cliente, com posição na fila. */
export async function getWaitlistStatus(
  admin: SupabaseClient,
  ids: string[],
): Promise<WaitlistEntryStatus[]> {
  if (ids.length === 0) return []
  await expireStaleNotified(admin)

  const { data: entries } = await admin
    .from('table_waitlist')
    .select('id, feature_id, status, created_at, notified_table_id, expires_at, feature:table_features(name, emoji), table:tables!notified_table_id(number)')
    .in('id', ids)
  if (!entries) return []

  const result: WaitlistEntryStatus[] = []
  for (const e of entries as Record<string, unknown>[]) {
    let position: number | null = null
    if (e.status === 'waiting') {
      let posQ = admin
        .from('table_waitlist')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'waiting')
        .lt('created_at', e.created_at as string)
      posQ = e.feature_id ? posQ.eq('feature_id', e.feature_id as string) : posQ.is('feature_id', null)
      const { count } = await posQ
      position = (count ?? 0) + 1
    }
    const feat = Array.isArray(e.feature) ? e.feature[0] : e.feature
    const tbl = Array.isArray(e.table) ? e.table[0] : e.table
    result.push({
      id: e.id as string,
      featureId: (e.feature_id as string | null) ?? null,
      featureName: (feat as { name?: string })?.name ?? 'Qualquer seção',
      featureEmoji: (feat as { emoji?: string | null })?.emoji ?? '🪑',
      status: e.status as WaitlistEntryStatus['status'],
      position,
      notifiedTableNumber: (tbl as { number?: string } | null)?.number ?? null,
      expiresAt: (e.expires_at as string) ?? null,
    })
  }
  return result
}

/** Libera mesas reservadas (grupo) vinculadas a uma entrada da fila. */
async function freeAllocatedTablesForEntry(
  admin: SupabaseClient,
  restaurantId: string,
  entryId: string,
): Promise<void> {
  const { data: allocs } = await admin
    .from('table_waitlist_allocations')
    .select('table_id')
    .eq('waitlist_id', entryId)
  const ids = (allocs ?? []).map(a => a.table_id as string)
  if (ids.length === 0) return
  await admin
    .from('tables')
    .update({ status: 'free' })
    .in('id', ids)
    .eq('status', 'reserved')
    .eq('restaurant_id', restaurantId)
  await admin.from('table_waitlist_allocations').delete().eq('waitlist_id', entryId)
}

/**
 * Check-in via QR da mesa notificada → marca a entrada como sentada.
 * Casa por customer_id ou WhatsApp (principal/secundário) e exige mesa correta.
 */
export async function markWaitlistSeatedOnCheckIn(
  admin: SupabaseClient,
  opts: {
    restaurantId: string
    tableId: string
    customerId: string
    whatsapp: string | null
    sessionId: string
  },
): Promise<void> {
  const whatsappNorm = opts.whatsapp ? whatsappForStorage(opts.whatsapp) : null

  const { data: entries } = await admin
    .from('table_waitlist')
    .select('id, customer_id, whatsapp, whatsapp_secondary')
    .eq('restaurant_id', opts.restaurantId)
    .eq('status', 'notified')
    .eq('notified_table_id', opts.tableId)

  const matchingIds = (entries ?? [])
    .filter(e =>
      e.customer_id === opts.customerId
      || (whatsappNorm && (e.whatsapp === whatsappNorm || e.whatsapp_secondary === whatsappNorm)),
    )
    .map(e => e.id as string)

  if (matchingIds.length === 0) return

  for (const entryId of matchingIds) {
    await freeAllocatedTablesForEntry(admin, opts.restaurantId, entryId)
  }

  await admin
    .from('table_waitlist')
    .update({ status: 'seated', seated_session_id: opts.sessionId, customer_id: opts.customerId })
    .in('id', matchingIds)
}
