import type { SupabaseClient } from '@supabase/supabase-js'

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
  } catch (err) {
    console.error('[waitlist] notifyWaitlistOnTableFree', err)
  }
}

export type WaitlistEntryStatus = {
  id: string
  featureId: string
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
      const { count } = await admin
        .from('table_waitlist')
        .select('id', { count: 'exact', head: true })
        .eq('feature_id', e.feature_id as string)
        .eq('status', 'waiting')
        .lt('created_at', e.created_at as string)
      position = (count ?? 0) + 1
    }
    const feat = Array.isArray(e.feature) ? e.feature[0] : e.feature
    const tbl = Array.isArray(e.table) ? e.table[0] : e.table
    result.push({
      id: e.id as string,
      featureId: e.feature_id as string,
      featureName: (feat as { name?: string })?.name ?? 'Mesa',
      featureEmoji: (feat as { emoji?: string | null })?.emoji ?? null,
      status: e.status as WaitlistEntryStatus['status'],
      position,
      notifiedTableNumber: (tbl as { number?: string } | null)?.number ?? null,
      expiresAt: (e.expires_at as string) ?? null,
    })
  }
  return result
}
