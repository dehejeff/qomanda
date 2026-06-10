import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getWaitlistStatus } from '@/lib/waitlist'
import { parseWaitlistContacts } from '@/lib/waitlist-contact'

/**
 * Fila de espera por característica de mesa — operações do cliente.
 * GET ?ids=a,b   → status (poll) das entradas do cliente (ele guarda os ids).
 * POST           → entrar na fila { restaurantId, featureId, name, whatsapp?, partySize?, customerId? }
 * DELETE ?id     → cancelar a própria entrada.
 */
export async function GET(req: NextRequest) {
  try {
    const idsParam = req.nextUrl.searchParams.get('ids') ?? ''
    const ids = idsParam.split(',').map(s => s.trim()).filter(Boolean)
    const admin = createAdminClient()
    const entries = await getWaitlistStatus(admin, ids)
    return NextResponse.json({ entries })
  } catch (err) {
    console.error('[customer waitlist GET]', err)
    return NextResponse.json({ error: 'Erro ao carregar fila.' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      restaurantId?: string; featureId?: string; name?: string
      whatsapp?: string; secondaryName?: string | null; secondaryWhatsapp?: string | null
      partySize?: number; customerId?: string
    }
    const { restaurantId, featureId, customerId } = body
    const name = body.name?.trim()
    if (!restaurantId || !featureId || !name) {
      return NextResponse.json({ error: 'Informe nome e a seção desejada.' }, { status: 400 })
    }

    const contacts = parseWaitlistContacts(body)
    if ('error' in contacts) {
      return NextResponse.json({ error: contacts.error }, { status: 400 })
    }

    const admin = createAdminClient()

    // Característica pertence ao restaurante?
    const { data: feature } = await admin
      .from('table_features')
      .select('id, restaurant_id')
      .eq('id', featureId)
      .maybeSingle()
    if (!feature || feature.restaurant_id !== restaurantId) {
      return NextResponse.json({ error: 'Seção inválida.' }, { status: 404 })
    }

    // Evita duplicar: mesma pessoa já esperando essa característica.
    if (customerId) {
      const { data: existing } = await admin
        .from('table_waitlist')
        .select('id, status, created_at, feature_id')
        .eq('feature_id', featureId)
        .eq('customer_id', customerId)
        .in('status', ['waiting', 'notified'])
        .limit(1)
        .maybeSingle()
      if (existing) {
        const [status] = await getWaitlistStatus(admin, [existing.id])
        return NextResponse.json({ id: existing.id, alreadyInQueue: true, status })
      }
    }

    const { data: inserted, error } = await admin
      .from('table_waitlist')
      .insert({
        restaurant_id: restaurantId,
        feature_id: featureId,
        customer_id: customerId ?? null,
        name,
        whatsapp: contacts.whatsapp,
        secondary_name: contacts.secondaryName,
        whatsapp_secondary: contacts.whatsappSecondary,
        party_size: Math.max(1, Math.min(20, Math.round(Number(body.partySize) || 1))),
        source: 'customer',
      })
      .select('id')
      .single()
    if (error || !inserted) {
      return NextResponse.json({ error: 'Erro ao entrar na fila.' }, { status: 400 })
    }

    const [status] = await getWaitlistStatus(admin, [inserted.id])
    return NextResponse.json({ id: inserted.id, status })
  } catch (err) {
    console.error('[customer waitlist POST]', err)
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const id = req.nextUrl.searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'Entrada inválida.' }, { status: 400 })
    const admin = createAdminClient()
    await admin
      .from('table_waitlist')
      .update({ status: 'cancelled' })
      .eq('id', id)
      .in('status', ['waiting', 'notified'])
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[customer waitlist DELETE]', err)
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 })
  }
}
