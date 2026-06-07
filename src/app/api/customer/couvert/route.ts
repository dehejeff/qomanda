import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { addCouvertForCustomer, removeCouvertForCustomer } from '@/lib/couvert'

type Body = { sessionId?: string; customerId?: string; action?: 'add' | 'remove' }

type RestaurantCfg = {
  couvert_enabled?: boolean
  couvert_price?: number | null
  couvert_label?: string | null
}

/**
 * POST /api/customer/couvert  { sessionId, customerId, action }
 * Couvert tradicional (entrada) — opt-in pelo cliente, por pessoa, SÓ MESA.
 * action 'add' (padrão) adiciona 1; 'remove' tira (se ainda não pagou).
 */
export async function POST(req: NextRequest) {
  try {
    const { sessionId, customerId, action = 'add' } = (await req.json()) as Body
    if (!sessionId || !customerId) {
      return NextResponse.json({ error: 'Parâmetros inválidos.' }, { status: 400 })
    }

    const admin = createAdminClient()

    const { data: session } = await admin
      .from('sessions')
      .select('id, restaurant_id, status, service_mode, restaurant:restaurants(couvert_enabled, couvert_price, couvert_label)')
      .eq('id', sessionId)
      .maybeSingle()

    if (!session) {
      return NextResponse.json({ error: 'Sessão não encontrada.' }, { status: 404 })
    }
    if (session.status === 'closed') {
      return NextResponse.json({ error: 'Sessão já encerrada.' }, { status: 400 })
    }

    // Cliente precisa ser participante da sessão.
    const { data: participant } = await admin
      .from('session_participants')
      .select('customer_id')
      .eq('session_id', sessionId)
      .eq('customer_id', customerId)
      .maybeSingle()
    if (!participant) {
      return NextResponse.json({ error: 'Cliente não pertence a esta mesa.' }, { status: 403 })
    }

    if (action === 'remove') {
      const res = await removeCouvertForCustomer(admin, {
        sessionId, restaurantId: session.restaurant_id, customerId, kind: 'couvert',
      })
      return res.ok
        ? NextResponse.json({ ok: true })
        : NextResponse.json({ error: res.error ?? 'Erro ao remover couvert.' }, { status: 400 })
    }

    // ── add ──
    if (session.service_mode === 'counter') {
      return NextResponse.json({ error: 'Couvert disponível apenas para mesas.' }, { status: 400 })
    }

    const raw = (session as { restaurant?: RestaurantCfg | RestaurantCfg[] }).restaurant
    const cfg = (Array.isArray(raw) ? raw[0] : raw) ?? {}
    if (!cfg.couvert_enabled) {
      return NextResponse.json({ error: 'Couvert não está habilitado neste restaurante.' }, { status: 400 })
    }
    const price = Number(cfg.couvert_price ?? 0)
    if (!(price > 0)) {
      return NextResponse.json({ error: 'Preço de couvert não configurado.' }, { status: 400 })
    }

    const res = await addCouvertForCustomer(admin, {
      sessionId, restaurantId: session.restaurant_id, customerId,
      kind: 'couvert', price, label: cfg.couvert_label,
    })
    return res.ok
      ? NextResponse.json({ ok: true, alreadyExists: res.alreadyExists ?? false })
      : NextResponse.json({ error: res.error ?? 'Erro ao adicionar couvert.' }, { status: 400 })
  } catch (err) {
    console.error('[customer couvert]', err)
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 })
  }
}
