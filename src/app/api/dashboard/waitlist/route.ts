import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireRestaurantAccess, RestaurantAuthError } from '@/lib/restaurant-auth'
import { expireStaleNotified, callNextForFeature } from '@/lib/waitlist'

const STAFF = ['owner', 'manager', 'waiter', 'recepcionista'] as const

/** GET — fila ativa + mesas livres por característica + tolerância. */
export async function GET() {
  try {
    const access = await requireRestaurantAccess([...STAFF])
    const admin = createAdminClient()
    await expireStaleNotified(admin, access.restaurantId)

    const [featuresRes, queueRes, restaurantRes, allTablesRes] = await Promise.all([
      admin.from('table_features').select('id, name, emoji').eq('restaurant_id', access.restaurantId).order('created_at'),
      admin.from('table_waitlist')
        .select('id, feature_id, name, whatsapp, party_size, status, source, notified_table_id, expires_at, created_at, table:tables!notified_table_id(number)')
        .eq('restaurant_id', access.restaurantId)
        .in('status', ['waiting', 'notified'])
        .order('created_at', { ascending: true }),
      admin.from('restaurants').select('waitlist_tolerance_minutes').eq('id', access.restaurantId).single(),
      admin.from('tables')
        .select('id, number, status, capacity, map:table_feature_map(feature_id)')
        .eq('restaurant_id', access.restaurantId)
        .is('archived_at', null),
    ])

    const freeByFeature: Record<string, { id: string; number: string; capacity: number | null }[]> = {}
    // Maior capacidade de UMA mesa por característica (p/ detectar grupo grande).
    // Se alguma mesa da tag não tem capacidade definida (null), tratamos como
    // "ilimitada" → null (não há grupo grande demais para ela).
    const featureMaxCapacity: Record<string, number | null> = {}
    const featureHasUnlimited: Record<string, boolean> = {}
    for (const t of (allTablesRes.data ?? []) as Record<string, unknown>[]) {
      const cap = (t.capacity as number | null) ?? null
      for (const m of (t.map ?? []) as { feature_id: string }[]) {
        const fid = m.feature_id
        if (t.status === 'free') {
          ;(freeByFeature[fid] ??= []).push({
            id: t.id as string,
            number: t.number as string,
            capacity: cap,
          })
        }
        if (cap == null) featureHasUnlimited[fid] = true
        else featureMaxCapacity[fid] = Math.max(featureMaxCapacity[fid] ?? 0, cap)
      }
    }
    // Resolve: tag com mesa ilimitada → null.
    for (const fid of Object.keys(featureHasUnlimited)) featureMaxCapacity[fid] = null

    const queue = (queueRes.data ?? []).map((e: Record<string, unknown>) => {
      const tbl = Array.isArray(e.table) ? e.table[0] : e.table
      return {
        id: e.id, featureId: e.feature_id, name: e.name, whatsapp: e.whatsapp,
        partySize: e.party_size, status: e.status, source: e.source,
        expiresAt: e.expires_at, createdAt: e.created_at,
        notifiedTableNumber: (tbl as { number?: string } | null)?.number ?? null,
      }
    })

    return NextResponse.json({
      features: featuresRes.data ?? [],
      queue,
      freeByFeature,
      featureMaxCapacity,
      toleranceMinutes: Number(restaurantRes.data?.waitlist_tolerance_minutes ?? 10),
    })
  } catch (err) {
    if (err instanceof RestaurantAuthError) return NextResponse.json({ error: err.message }, { status: err.status })
    console.error('[dashboard waitlist GET]', err)
    return NextResponse.json({ error: 'Erro ao carregar a fila.' }, { status: 500 })
  }
}

/** POST — ações da equipe { action, ... }. */
export async function POST(req: NextRequest) {
  try {
    const access = await requireRestaurantAccess([...STAFF])
    const admin = createAdminClient()
    const body = await req.json() as {
      action?: string; entryId?: string; featureId?: string; tableId?: string
      name?: string; partySize?: number; whatsapp?: string
    }

    const { data: r } = await admin.from('restaurants').select('waitlist_tolerance_minutes').eq('id', access.restaurantId).single()
    const tolerance = Number(r?.waitlist_tolerance_minutes ?? 10)

    switch (body.action) {
      case 'callNext': {
        if (!body.featureId || !body.tableId) return NextResponse.json({ error: 'Parâmetros inválidos.' }, { status: 400 })
        const { data: tbl } = await admin
          .from('tables').select('capacity').eq('id', body.tableId).eq('restaurant_id', access.restaurantId).maybeSingle()
        const capacity = (tbl as { capacity?: number | null } | null)?.capacity ?? null
        const ok = await callNextForFeature(admin, access.restaurantId, body.featureId, body.tableId, tolerance, capacity)
        return NextResponse.json(
          ok ? { ok: true } : { error: capacity != null ? `Ninguém na fila cabe nessa mesa (até ${capacity} pessoas).` : 'Ninguém na fila dessa característica.' },
          { status: ok ? 200 : 400 },
        )
      }
      case 'seat': {
        if (!body.entryId) return NextResponse.json({ error: 'Entrada inválida.' }, { status: 400 })
        await admin.from('table_waitlist').update({ status: 'seated' }).eq('id', body.entryId).eq('restaurant_id', access.restaurantId)
        return NextResponse.json({ ok: true })
      }
      case 'noShow': {
        if (!body.entryId) return NextResponse.json({ error: 'Entrada inválida.' }, { status: 400 })
        await admin.from('table_waitlist').update({ status: 'expired' }).eq('id', body.entryId).eq('restaurant_id', access.restaurantId)
        return NextResponse.json({ ok: true })
      }
      case 'cancel': {
        if (!body.entryId) return NextResponse.json({ error: 'Entrada inválida.' }, { status: 400 })
        await admin.from('table_waitlist').update({ status: 'cancelled' }).eq('id', body.entryId).eq('restaurant_id', access.restaurantId)
        return NextResponse.json({ ok: true })
      }
      case 'addWalkIn': {
        if (!body.featureId || !body.name?.trim()) return NextResponse.json({ error: 'Informe nome e característica.' }, { status: 400 })
        await admin.from('table_waitlist').insert({
          restaurant_id: access.restaurantId,
          feature_id: body.featureId,
          name: body.name.trim(),
          whatsapp: body.whatsapp?.replace(/\D/g, '') || null,
          party_size: Math.max(1, Math.min(50, Math.round(Number(body.partySize) || 2))),
          source: 'staff',
        })
        return NextResponse.json({ ok: true })
      }
      default:
        return NextResponse.json({ error: 'Ação inválida.' }, { status: 400 })
    }
  } catch (err) {
    if (err instanceof RestaurantAuthError) return NextResponse.json({ error: err.message }, { status: err.status })
    console.error('[dashboard waitlist POST]', err)
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 })
  }
}
