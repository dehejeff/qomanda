import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireOwnerAccess, RestaurantAuthError } from '@/lib/restaurant-auth'
import {
  DEFAULT_WAITLIST_READY_TEMPLATE,
  DEFAULT_WAITLIST_RESERVE_TEMPLATE,
  normalizeWaitlistTemplateInput,
} from '@/lib/waitlist-messages'

export type TableFeature = { id: string; name: string; emoji: string | null }
export type TableFeatureAssignment = { table_id: string; feature_id: string }

/** GET — características, atribuições e tolerância do restaurante. */
export async function GET() {
  try {
    const access = await requireOwnerAccess()
    const admin = createAdminClient()

    const [featuresRes, mapRes, restaurantRes] = await Promise.all([
      admin.from('table_features').select('id, name, emoji').eq('restaurant_id', access.restaurantId).order('created_at'),
      admin.from('table_feature_map').select('table_id, feature_id, feature:table_features!inner(restaurant_id)')
        .eq('feature.restaurant_id', access.restaurantId),
      admin.from('restaurants').select(
        'waitlist_tolerance_minutes, waitlist_ready_whatsapp_template, waitlist_reserve_whatsapp_template',
      ).eq('id', access.restaurantId).single(),
    ])

    const r = restaurantRes.data
    return NextResponse.json({
      features: (featuresRes.data ?? []) as TableFeature[],
      assignments: (mapRes.data ?? []).map((m: { table_id: string; feature_id: string }) => ({ table_id: m.table_id, feature_id: m.feature_id })),
      toleranceMinutes: Number(r?.waitlist_tolerance_minutes ?? 10),
      readyWhatsappTemplate: r?.waitlist_ready_whatsapp_template ?? null,
      reserveWhatsappTemplate: r?.waitlist_reserve_whatsapp_template ?? null,
      defaultReadyWhatsappTemplate: DEFAULT_WAITLIST_READY_TEMPLATE,
      defaultReserveWhatsappTemplate: DEFAULT_WAITLIST_RESERVE_TEMPLATE,
    })
  } catch (err) {
    if (err instanceof RestaurantAuthError) return NextResponse.json({ error: err.message }, { status: err.status })
    console.error('[table-features GET]', err)
    return NextResponse.json({ error: 'Erro ao carregar.' }, { status: 500 })
  }
}

/** POST — cria uma característica { name, emoji } OU renomeia (quando vem { id }). */
export async function POST(req: NextRequest) {
  try {
    const access = await requireOwnerAccess()
    const admin = createAdminClient()
    const { id, name, emoji } = (await req.json()) as { id?: string; name?: string; emoji?: string }
    if (!name?.trim()) return NextResponse.json({ error: 'Informe o nome da seção.' }, { status: 400 })

    // Renomear/editar uma característica existente (escopada ao restaurante).
    if (id) {
      const { data, error } = await admin
        .from('table_features')
        .update({ name: name.trim(), emoji: emoji?.trim() || null })
        .eq('id', id)
        .eq('restaurant_id', access.restaurantId)
        .select('id, name, emoji')
        .single()
      if (error || !data) return NextResponse.json({ error: 'Erro ao atualizar seção.' }, { status: 400 })
      return NextResponse.json({ feature: data })
    }

    const { data, error } = await admin
      .from('table_features')
      .insert({ restaurant_id: access.restaurantId, name: name.trim(), emoji: emoji?.trim() || null })
      .select('id, name, emoji')
      .single()
    if (error) return NextResponse.json({ error: 'Erro ao criar seção.' }, { status: 400 })
    return NextResponse.json({ feature: data })
  } catch (err) {
    if (err instanceof RestaurantAuthError) return NextResponse.json({ error: err.message }, { status: err.status })
    console.error('[table-features POST]', err)
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 })
  }
}

/** DELETE ?id — remove uma característica (e suas atribuições, via cascade). */
export async function DELETE(req: NextRequest) {
  try {
    const access = await requireOwnerAccess()
    const admin = createAdminClient()
    const id = req.nextUrl.searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'Seção inválida.' }, { status: 400 })

    const { error } = await admin
      .from('table_features')
      .delete()
      .eq('id', id)
      .eq('restaurant_id', access.restaurantId)
    if (error) return NextResponse.json({ error: 'Erro ao remover.' }, { status: 400 })
    return NextResponse.json({ ok: true })
  } catch (err) {
    if (err instanceof RestaurantAuthError) return NextResponse.json({ error: err.message }, { status: err.status })
    console.error('[table-features DELETE]', err)
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 })
  }
}

/** PUT — define as características de UMA mesa { tableId, featureIds[] }. */
export async function PUT(req: NextRequest) {
  try {
    const access = await requireOwnerAccess()
    const admin = createAdminClient()
    const { tableId, featureIds } = (await req.json()) as { tableId?: string; featureIds?: string[] }
    if (!tableId) return NextResponse.json({ error: 'Mesa inválida.' }, { status: 400 })

    // Valida que a mesa é do restaurante.
    const { data: table } = await admin.from('tables').select('id, restaurant_id').eq('id', tableId).maybeSingle()
    if (!table || table.restaurant_id !== access.restaurantId) {
      return NextResponse.json({ error: 'Mesa não encontrada.' }, { status: 404 })
    }

    await admin.from('table_feature_map').delete().eq('table_id', tableId)
    const ids = [...new Set(featureIds ?? [])]
    if (ids.length > 0) {
      await admin.from('table_feature_map').insert(ids.map(fid => ({ table_id: tableId, feature_id: fid })))
    }
    return NextResponse.json({ ok: true })
  } catch (err) {
    if (err instanceof RestaurantAuthError) return NextResponse.json({ error: err.message }, { status: err.status })
    console.error('[table-features PUT]', err)
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 })
  }
}

/** PATCH — tolerância e/ou templates WhatsApp da fila. */
export async function PATCH(req: NextRequest) {
  try {
    const access = await requireOwnerAccess()
    const admin = createAdminClient()
    const body = (await req.json()) as {
      minutes?: number
      readyWhatsappTemplate?: string | null
      reserveWhatsappTemplate?: string | null
    }

    const patch: Record<string, unknown> = {}
    if (body.minutes != null) {
      patch.waitlist_tolerance_minutes = Math.max(1, Math.min(120, Math.round(Number(body.minutes) || 10)))
    }
    if ('readyWhatsappTemplate' in body) {
      patch.waitlist_ready_whatsapp_template = normalizeWaitlistTemplateInput(body.readyWhatsappTemplate)
    }
    if ('reserveWhatsappTemplate' in body) {
      patch.waitlist_reserve_whatsapp_template = normalizeWaitlistTemplateInput(body.reserveWhatsappTemplate)
    }
    if (Object.keys(patch).length === 0) {
      return NextResponse.json({ error: 'Nada para salvar.' }, { status: 400 })
    }

    const { error } = await admin.from('restaurants').update(patch).eq('id', access.restaurantId)
    if (error) return NextResponse.json({ error: 'Erro ao salvar configurações da fila.' }, { status: 400 })
    return NextResponse.json({ ok: true, ...patch })
  } catch (err) {
    if (err instanceof RestaurantAuthError) return NextResponse.json({ error: err.message }, { status: err.status })
    console.error('[table-features PATCH]', err)
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 })
  }
}
