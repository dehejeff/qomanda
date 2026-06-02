import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireWaiterAccess, RestaurantAuthError } from '@/lib/restaurant-auth'
import {
  fetchWaiterLoyaltyAlerts,
  requestWaiterSessionClose,
  sessionOrdersSubtotal,
} from '@/lib/waiter-garcom'
import { sessionStatus } from '@/lib/design-tokens'

type RouteCtx = { params: Promise<{ sessionId: string }> }

export async function POST(_req: NextRequest, ctx: RouteCtx) {
  try {
    const access = await requireWaiterAccess()
    if (access.role === 'kitchen') {
      return NextResponse.json({ error: 'Sem permissão para encerrar mesa.' }, { status: 403 })
    }

    const { sessionId } = await ctx.params
    const admin = createAdminClient()
    const result = await requestWaiterSessionClose(admin, sessionId, access.restaurantId)

    return NextResponse.json({ ok: true, ...result })
  } catch (err) {
    if (err instanceof RestaurantAuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    const message = err instanceof Error ? err.message : 'Erro ao encerrar mesa.'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}

export async function GET(_req: NextRequest, ctx: RouteCtx) {
  try {
    const access = await requireWaiterAccess()
    const { sessionId } = await ctx.params
    const admin = createAdminClient()

    const { data: session } = await admin
      .from('sessions')
      .select(`
        id, status, started_at, restaurant_id,
        table:tables ( id, number, status )
      `)
      .eq('id', sessionId)
      .maybeSingle()

    if (!session || session.restaurant_id !== access.restaurantId) {
      return NextResponse.json({ error: 'Sessão não encontrada.' }, { status: 404 })
    }

    const tableRaw = (session as { table?: { id?: string; number?: string; status?: string } | { id?: string; number?: string; status?: string }[] }).table
    const table = Array.isArray(tableRaw) ? tableRaw[0] : tableRaw

    const [total, participantsRes, alerts] = await Promise.all([
      sessionOrdersSubtotal(admin, sessionId),
      admin
        .from('session_participants')
        .select(`
          customer_id,
          customer:customers ( first_name, last_name )
        `)
        .eq('session_id', sessionId),
      fetchWaiterLoyaltyAlerts(admin, access.restaurantId),
    ])

    const sessionAlerts = alerts.filter(a => a.sessionId === sessionId)

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

    const statusMeta = sessionStatus[session.status as keyof typeof sessionStatus]

    return NextResponse.json({
      session: {
        id: session.id,
        status: session.status,
        statusLabel: statusMeta?.label ?? session.status,
        startedAt: session.started_at,
        total,
        table: table ?? null,
      },
      participants,
      loyaltyAlerts: sessionAlerts,
      canClose: access.role !== 'kitchen' && session.status !== 'closed',
    })
  } catch (err) {
    if (err instanceof RestaurantAuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    console.error('[Waiter session detail]', err)
    return NextResponse.json({ error: 'Erro ao carregar sessão.' }, { status: 500 })
  }
}
