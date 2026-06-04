import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireWaiterAccess, RestaurantAuthError } from '@/lib/restaurant-auth'
import { fetchWaiterOrderContext, createWaiterOrder } from '@/lib/waiter-order'

/** GET ?sessionId= | ?tableId= — contexto p/ montar pedido (sessão + pessoas + cardápio). */
export async function GET(req: NextRequest) {
  try {
    const access = await requireWaiterAccess()
    if (access.role === 'kitchen') {
      return NextResponse.json({ error: 'Sem permissão para criar pedidos.' }, { status: 403 })
    }
    const sessionId = req.nextUrl.searchParams.get('sessionId') ?? undefined
    const tableId = req.nextUrl.searchParams.get('tableId') ?? undefined
    if (!sessionId && !tableId) {
      return NextResponse.json({ error: 'Informe sessionId ou tableId.' }, { status: 400 })
    }

    const admin = createAdminClient()
    const ctx = await fetchWaiterOrderContext(admin, access.restaurantId, { sessionId, tableId })
    if (!ctx) return NextResponse.json({ error: 'Sessão não encontrada.' }, { status: 404 })

    return NextResponse.json(ctx)
  } catch (err) {
    if (err instanceof RestaurantAuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    console.error('[Waiter order GET]', err)
    return NextResponse.json({ error: 'Erro ao carregar contexto do pedido.' }, { status: 500 })
  }
}

/** POST { sessionId, customerId?, items[] } — cria o pedido em nome da pessoa. */
export async function POST(req: NextRequest) {
  try {
    const access = await requireWaiterAccess()
    if (access.role === 'kitchen') {
      return NextResponse.json({ error: 'Sem permissão para criar pedidos.' }, { status: 403 })
    }
    const body = await req.json().catch(() => ({})) as {
      sessionId?: string
      customerId?: string | null
      items?: { menuItemId?: string; quantity?: number; notes?: string | null }[]
    }
    if (!body.sessionId) {
      return NextResponse.json({ error: 'sessionId obrigatório.' }, { status: 400 })
    }

    const items = (body.items ?? [])
      .filter(i => i.menuItemId && (i.quantity ?? 0) > 0)
      .map(i => ({ menuItemId: i.menuItemId as string, quantity: Math.floor(i.quantity as number), notes: i.notes ?? null }))

    const admin = createAdminClient()
    const result = await createWaiterOrder(admin, access.restaurantId, {
      sessionId: body.sessionId,
      customerId: body.customerId ?? null,
      items,
    })

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 400 })
    }
    return NextResponse.json(result)
  } catch (err) {
    if (err instanceof RestaurantAuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    console.error('[Waiter order POST]', err)
    return NextResponse.json({ error: 'Erro ao criar pedido.' }, { status: 500 })
  }
}
