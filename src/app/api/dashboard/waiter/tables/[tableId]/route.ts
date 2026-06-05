import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireWaiterAccess, RestaurantAuthError } from '@/lib/restaurant-auth'
import {
  fetchWaiterLoyaltyAlerts,
  requestWaiterSessionClose,
  sessionOrdersSubtotal,
} from '@/lib/waiter-garcom'
import { sessionStatus } from '@/lib/design-tokens'

type RouteCtx = { params: Promise<{ tableId: string }> }

export async function GET(_req: NextRequest, ctx: RouteCtx) {
  try {
    const access = await requireWaiterAccess()
    const { tableId } = await ctx.params
    const admin = createAdminClient()

    const { data: table } = await admin
      .from('tables')
      .select('id, number, status, restaurant_id')
      .eq('id', tableId)
      .maybeSingle()

    if (!table || table.restaurant_id !== access.restaurantId) {
      return NextResponse.json({ error: 'Mesa não encontrada.' }, { status: 404 })
    }

    const { data: session } = await admin
      .from('sessions')
      .select('id, status, started_at')
      .eq('table_id', tableId)
      .in('status', ['open', 'closing'])
      .order('started_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (!session) {
      // Mesa aparece como occupied mas não tem sessão ativa — corrige o status
      if (table.status === 'occupied') {
        await admin.from('tables').update({ status: 'free' }).eq('id', tableId)
      }
      return NextResponse.json({
        table: { id: table.id, number: table.number, status: 'free' },
        session: null,
        participants: [],
        loyaltyAlerts: [],
        canClose: false,
      })
    }

    const [total, participantsRes, allAlerts] = await Promise.all([
      sessionOrdersSubtotal(admin, session.id),
      admin
        .from('session_participants')
        .select(`
          customer_id,
          customer:customers ( first_name, last_name )
        `)
        .eq('session_id', session.id),
      fetchWaiterLoyaltyAlerts(admin, access.restaurantId),
    ])

    const sessionAlerts = allAlerts.filter(a => a.sessionId === session.id)
    const statusMeta = sessionStatus[session.status as keyof typeof sessionStatus]

    const participants = (participantsRes.data ?? []).map(p => {
      const cRaw = (p as { customer?: { first_name?: string; last_name?: string } | { first_name?: string; last_name?: string }[] }).customer
      const c = Array.isArray(cRaw) ? cRaw[0] : cRaw
      const name = c ? `${c.first_name ?? ''} ${c.last_name ?? ''}`.trim() : 'Cliente'
      return {
        customerId: p.customer_id,
        name: name || 'Cliente',
        offers: sessionAlerts.filter(a => a.customerId === p.customer_id),
      }
    })

    return NextResponse.json({
      table: { id: table.id, number: table.number, status: table.status },
      session: {
        id: session.id,
        status: session.status,
        statusLabel: statusMeta?.label ?? session.status,
        startedAt: session.started_at,
        total,
      },
      participants,
      loyaltyAlerts: sessionAlerts,
      canClose: access.role !== 'kitchen',
    })
  } catch (err) {
    if (err instanceof RestaurantAuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    console.error('[Waiter table detail]', err)
    return NextResponse.json({ error: 'Erro ao carregar mesa.' }, { status: 500 })
  }
}

export async function POST(_req: NextRequest, ctx: RouteCtx) {
  try {
    const access = await requireWaiterAccess()
    if (access.role === 'kitchen') {
      return NextResponse.json({ error: 'Sem permissão para encerrar mesa.' }, { status: 403 })
    }

    const { tableId } = await ctx.params
    const admin = createAdminClient()

    const { data: session } = await admin
      .from('sessions')
      .select('id')
      .eq('table_id', tableId)
      .in('status', ['open', 'closing'])
      .order('started_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (!session) {
      return NextResponse.json({ error: 'Mesa sem sessão aberta.' }, { status: 404 })
    }

    const result = await requestWaiterSessionClose(admin, session.id, access.restaurantId)
    return NextResponse.json({ ok: true, ...result })
  } catch (err) {
    if (err instanceof RestaurantAuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    const message = err instanceof Error ? err.message : 'Erro ao encerrar mesa.'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
