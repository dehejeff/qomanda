import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireRestaurantAccess, RestaurantAuthError } from '@/lib/restaurant-auth'
import { expireStaleNotified, callNextForFeature } from '@/lib/waitlist'
import { parseWaitlistContacts } from '@/lib/waitlist-contact'

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
        .select('id, feature_id, name, whatsapp, secondary_name, whatsapp_secondary, party_size, status, source, notified_table_id, expires_at, created_at, table:tables!notified_table_id(number)')
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

    // Mesas reservadas (alocadas) por entrada da fila — grupo grande em várias mesas.
    const entryIds = (queueRes.data ?? []).map((e: Record<string, unknown>) => e.id as string)
    const reservedByEntry: Record<string, { id: string; number: string; capacity: number | null }[]> = {}
    if (entryIds.length > 0) {
      const { data: allocs } = await admin
        .from('table_waitlist_allocations')
        .select('waitlist_id, table:tables(id, number, capacity)')
        .in('waitlist_id', entryIds)
      for (const a of (allocs ?? []) as Record<string, unknown>[]) {
        const t = Array.isArray(a.table) ? a.table[0] : a.table
        if (t) (reservedByEntry[a.waitlist_id as string] ??= []).push({
          id: (t as { id: string }).id,
          number: (t as { number: string }).number,
          capacity: (t as { capacity?: number | null }).capacity ?? null,
        })
      }
    }

    const queue = (queueRes.data ?? []).map((e: Record<string, unknown>) => {
      const tbl = Array.isArray(e.table) ? e.table[0] : e.table
      return {
        id: e.id, featureId: e.feature_id, name: e.name, whatsapp: e.whatsapp,
        secondaryName: e.secondary_name ?? null, whatsappSecondary: e.whatsapp_secondary ?? null,
        partySize: e.party_size, status: e.status, source: e.source,
        expiresAt: e.expires_at, createdAt: e.created_at,
        notifiedTableNumber: (tbl as { number?: string } | null)?.number ?? null,
        reservedTables: reservedByEntry[e.id as string] ?? [],
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
      secondaryName?: string | null; secondaryWhatsapp?: string | null
      tableIds?: string[]
    }

    const { data: r } = await admin.from('restaurants').select('waitlist_tolerance_minutes').eq('id', access.restaurantId).single()
    const tolerance = Number(r?.waitlist_tolerance_minutes ?? 10)

    // Libera as mesas reservadas de uma entrada (reserved -> free) e remove as alocações.
    async function freeAllocatedTables(entryId: string): Promise<string[]> {
      const { data: allocs } = await admin.from('table_waitlist_allocations').select('table_id').eq('waitlist_id', entryId)
      const ids = (allocs ?? []).map((a: { table_id: string }) => a.table_id)
      if (ids.length > 0) {
        await admin.from('tables').update({ status: 'free' }).in('id', ids).eq('status', 'reserved').eq('restaurant_id', access.restaurantId)
        await admin.from('table_waitlist_allocations').delete().eq('waitlist_id', entryId)
      }
      return ids
    }

    /** Entrada ativa (waiting/notified) que reservou esta mesa via alocação (Flow A/B). */
    async function resolveEntryByTable(tableId: string): Promise<string | null> {
      const { data: allocs } = await admin
        .from('table_waitlist_allocations')
        .select('waitlist_id')
        .eq('table_id', tableId)
      const entryIds = [...new Set((allocs ?? []).map((a: { waitlist_id: string }) => a.waitlist_id))]
      if (entryIds.length === 0) return null
      const { data: entry } = await admin
        .from('table_waitlist')
        .select('id')
        .in('id', entryIds)
        .eq('restaurant_id', access.restaurantId)
        .in('status', ['waiting', 'notified'])
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      return entry?.id ?? null
    }

    switch (body.action) {
      case 'callNext': {
        if (!body.featureId || !body.tableId) return NextResponse.json({ error: 'Parâmetros inválidos.' }, { status: 400 })
        const { data: tbl } = await admin
          .from('tables').select('capacity').eq('id', body.tableId).eq('restaurant_id', access.restaurantId).maybeSingle()
        const capacity = (tbl as { capacity?: number | null } | null)?.capacity ?? null
        const ok = await callNextForFeature(admin, access.restaurantId, body.featureId, body.tableId, tolerance, capacity)
        return NextResponse.json(
          ok ? { ok: true } : { error: capacity != null ? `Ninguém na fila cabe nessa mesa (até ${capacity} pessoas).` : 'Ninguém na fila dessa seção.' },
          { status: ok ? 200 : 400 },
        )
      }
      case 'seat': {
        if (!body.entryId) return NextResponse.json({ error: 'Entrada inválida.' }, { status: 400 })
        const freed = await freeAllocatedTables(body.entryId)
        await admin.from('table_waitlist').update({ status: 'seated' }).eq('id', body.entryId).eq('restaurant_id', access.restaurantId)
        return NextResponse.json({ ok: true, freedTableIds: freed })
      }
      case 'seatByTable': {
        if (!body.tableId) return NextResponse.json({ error: 'Mesa inválida.' }, { status: 400 })
        const entryId = await resolveEntryByTable(body.tableId)
        if (!entryId) return NextResponse.json({ error: 'Nenhuma reserva ativa para esta mesa.' }, { status: 404 })
        const freed = await freeAllocatedTables(entryId)
        await admin.from('table_waitlist').update({ status: 'seated' }).eq('id', entryId).eq('restaurant_id', access.restaurantId)
        return NextResponse.json({ ok: true, freedTableIds: freed })
      }
      case 'noShow': {
        if (!body.entryId) return NextResponse.json({ error: 'Entrada inválida.' }, { status: 400 })
        const freed = await freeAllocatedTables(body.entryId)
        await admin.from('table_waitlist').update({ status: 'expired' }).eq('id', body.entryId).eq('restaurant_id', access.restaurantId)
        return NextResponse.json({ ok: true, freedTableIds: freed })
      }
      case 'cancel': {
        if (!body.entryId) return NextResponse.json({ error: 'Entrada inválida.' }, { status: 400 })
        const freed = await freeAllocatedTables(body.entryId)
        await admin.from('table_waitlist').update({ status: 'cancelled' }).eq('id', body.entryId).eq('restaurant_id', access.restaurantId)
        return NextResponse.json({ ok: true, freedTableIds: freed })
      }
      case 'cancelByTable': {
        if (!body.tableId) return NextResponse.json({ error: 'Mesa inválida.' }, { status: 400 })
        const entryId = await resolveEntryByTable(body.tableId)
        if (entryId) {
          const freed = await freeAllocatedTables(entryId)
          await admin.from('table_waitlist').update({ status: 'cancelled' }).eq('id', entryId).eq('restaurant_id', access.restaurantId)
          return NextResponse.json({ ok: true, freedTableIds: freed })
        }
        const { data: tbl } = await admin.from('tables').select('id, status')
          .eq('id', body.tableId).eq('restaurant_id', access.restaurantId).maybeSingle()
        if (!tbl || tbl.status !== 'reserved') {
          return NextResponse.json({ error: 'Mesa não está reservada.' }, { status: 409 })
        }
        await admin.from('tables').update({ status: 'free' }).eq('id', body.tableId).eq('restaurant_id', access.restaurantId)
        return NextResponse.json({ ok: true, freedTableIds: [body.tableId] })
      }
      case 'addWalkIn': {
        if (!body.featureId || !body.name?.trim()) return NextResponse.json({ error: 'Informe nome e seção.' }, { status: 400 })
        const contacts = parseWaitlistContacts(body)
        if ('error' in contacts) return NextResponse.json({ error: contacts.error }, { status: 400 })
        const { data: created } = await admin.from('table_waitlist').insert({
          restaurant_id: access.restaurantId,
          feature_id: body.featureId,
          name: body.name.trim(),
          whatsapp: contacts.whatsapp,
          secondary_name: contacts.secondaryName,
          whatsapp_secondary: contacts.whatsappSecondary,
          party_size: Math.max(1, Math.min(50, Math.round(Number(body.partySize) || 2))),
          source: 'staff',
        }).select('id').single()
        return NextResponse.json({ ok: true, entryId: created?.id ?? null })
      }
      case 'reserveTables': {
        // Reserva direta pelo grid: cria uma entrada sem característica e aloca as mesas.
        if (!body.name?.trim() || !Array.isArray(body.tableIds) || body.tableIds.length === 0) {
          return NextResponse.json({ error: 'Informe o nome do grupo e ao menos uma mesa.' }, { status: 400 })
        }
        const { data: tbls } = await admin.from('tables')
          .select('id, status').in('id', body.tableIds).eq('restaurant_id', access.restaurantId).is('archived_at', null)
        const freeIds = (tbls ?? []).filter(t => t.status === 'free').map(t => t.id)
        if (freeIds.length === 0) {
          return NextResponse.json({ error: 'As mesas escolhidas não estão livres.' }, { status: 409 })
        }
        const contacts = parseWaitlistContacts(body)
        if ('error' in contacts) return NextResponse.json({ error: contacts.error }, { status: 400 })
        const { data: entry } = await admin.from('table_waitlist').insert({
          restaurant_id: access.restaurantId,
          feature_id: null,
          name: body.name.trim(),
          whatsapp: contacts.whatsapp,
          secondary_name: contacts.secondaryName,
          whatsapp_secondary: contacts.whatsappSecondary,
          party_size: Math.max(1, Math.min(50, Math.round(Number(body.partySize) || freeIds.length))),
          source: 'staff',
        }).select('id').single()
        if (!entry) return NextResponse.json({ error: 'Erro ao criar reserva.' }, { status: 400 })
        await admin.from('table_waitlist_allocations')
          .insert(freeIds.map(tid => ({ waitlist_id: entry.id, table_id: tid })))
        await admin.from('tables').update({ status: 'reserved' }).in('id', freeIds).eq('restaurant_id', access.restaurantId)
        return NextResponse.json({ ok: true, reserved: freeIds.length, entryId: entry.id })
      }
      case 'allocate': {
        // Reserva mesas para um grupo (grupo grande em várias mesas próximas).
        if (!body.entryId || !Array.isArray(body.tableIds) || body.tableIds.length === 0) {
          return NextResponse.json({ error: 'Informe a entrada e ao menos uma mesa.' }, { status: 400 })
        }
        // Entrada pertence ao restaurante e está ativa?
        const { data: entry } = await admin.from('table_waitlist')
          .select('id, status').eq('id', body.entryId).eq('restaurant_id', access.restaurantId).maybeSingle()
        if (!entry || !['waiting', 'notified'].includes(entry.status as string)) {
          return NextResponse.json({ error: 'Entrada da fila inválida.' }, { status: 404 })
        }
        // Mesas livres e do restaurante?
        const { data: tbls } = await admin.from('tables')
          .select('id, status').in('id', body.tableIds).eq('restaurant_id', access.restaurantId).is('archived_at', null)
        const freeIds = (tbls ?? []).filter(t => t.status === 'free').map(t => t.id)
        if (freeIds.length === 0) {
          return NextResponse.json({ error: 'As mesas escolhidas não estão livres.' }, { status: 409 })
        }
        await admin.from('table_waitlist_allocations')
          .upsert(freeIds.map(tid => ({ waitlist_id: body.entryId, table_id: tid })), { onConflict: 'waitlist_id,table_id' })
        await admin.from('tables').update({ status: 'reserved' }).in('id', freeIds).eq('restaurant_id', access.restaurantId)
        return NextResponse.json({ ok: true, reserved: freeIds.length })
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
