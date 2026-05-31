import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { findCustomerActiveSession } from '@/lib/customer-auth-server'
import {
  fetchCustomerReceipts,
  groupReceiptsByRestaurant,
} from '@/lib/customer-receipts-server'

export type HubVisit = {
  restaurantId: string
  slug: string
  name: string
  logoUrl: string | null
  visitCount: number
  lastVisitAt: string
  isFavorite: boolean
}

export type HubReceiptSummary = {
  totalReceipts: number
  restaurantCount: number
}

export type HubActiveSession = {
  sessionId: string
  slug: string
  restaurantName: string
  logoUrl: string | null
  tableNumber: string
  status: string
}

/**
 * GET /api/customer/hub?customer=UUID[&session=UUID]
 * Dados agregados para a home global do cliente.
 */
export async function GET(req: NextRequest) {
  const customerId = req.nextUrl.searchParams.get('customer')
  const sessionId  = req.nextUrl.searchParams.get('session')

  if (!customerId) {
    return NextResponse.json({ error: 'customer obrigatório.' }, { status: 400 })
  }

  try {
    const supabase = createAdminClient()

    const { data: customer } = await supabase
      .from('customers')
      .select('id, first_name, last_name, whatsapp, pin_hash')
      .eq('id', customerId)
      .single()

    if (!customer) {
      return NextResponse.json({ error: 'Cliente não encontrado.' }, { status: 404 })
    }

    const { data: participations } = await supabase
      .from('session_participants')
      .select(`
        joined_at,
        session_id,
        sessions!inner(
          id,
          restaurant_id,
          started_at,
          restaurant:restaurants(id, name, slug, logo_url)
        )
      `)
      .eq('customer_id', customerId)
      .order('joined_at', { ascending: false })

    const { data: favorites, error: favError } = await supabase
      .from('customer_favorites')
      .select('restaurant_id, restaurant:restaurants(id, name, slug, logo_url)')
      .eq('customer_id', customerId)

    if (favError) {
      console.warn('[Customer Hub] Favorites unavailable:', favError.message)
    }

    const favoriteIds = new Set((favorites ?? []).map(f => f.restaurant_id))

    type SessionRow = {
      id: string
      restaurant_id: string
      started_at: string
      restaurant: { id: string; name: string; slug: string; logo_url: string | null } | { id: string; name: string; slug: string; logo_url: string | null }[] | null
    }

    const visitMap = new Map<string, HubVisit>()

    for (const row of participations ?? []) {
      const sessRaw = row.sessions as SessionRow | SessionRow[] | null
      const sess = Array.isArray(sessRaw) ? sessRaw[0] : sessRaw
      if (!sess?.restaurant_id) continue

      const restRaw = sess.restaurant
      const rest = Array.isArray(restRaw) ? restRaw[0] : restRaw
      if (!rest) continue

      const existing = visitMap.get(sess.restaurant_id)
      const joinedAt = row.joined_at ?? sess.started_at

      if (!existing) {
        visitMap.set(sess.restaurant_id, {
          restaurantId: sess.restaurant_id,
          slug: rest.slug,
          name: rest.name,
          logoUrl: rest.logo_url,
          visitCount: 1,
          lastVisitAt: joinedAt,
          isFavorite: favoriteIds.has(sess.restaurant_id),
        })
      } else {
        existing.visitCount += 1
        if (new Date(joinedAt) > new Date(existing.lastVisitAt)) {
          existing.lastVisitAt = joinedAt
        }
      }
    }

    const visits = [...visitMap.values()].sort(
      (a, b) => new Date(b.lastVisitAt).getTime() - new Date(a.lastVisitAt).getTime(),
    )

    const favoriteRestaurants = (favorites ?? []).map(f => {
      const restRaw = f.restaurant as { id: string; name: string; slug: string; logo_url: string | null } | { id: string; name: string; slug: string; logo_url: string | null }[] | null
      const rest = Array.isArray(restRaw) ? restRaw[0] : restRaw
      return rest ? {
        restaurantId: rest.id,
        slug: rest.slug,
        name: rest.name,
        logoUrl: rest.logo_url,
      } : null
    }).filter(Boolean) as { restaurantId: string; slug: string; name: string; logoUrl: string | null }[]

    const receipts = await fetchCustomerReceipts(supabase, customerId)
    const receiptSummary: HubReceiptSummary = {
      totalReceipts: receipts.length,
      restaurantCount: groupReceiptsByRestaurant(receipts).length,
    }

    let activeSession: HubActiveSession | null = await findCustomerActiveSession(supabase, customerId)

    // Preferir sessão informada pelo cliente se ainda estiver aberta
    if (sessionId && (!activeSession || activeSession.sessionId !== sessionId)) {
      const { data: active } = await supabase
        .from('sessions')
        .select(`
          id, status,
          table:tables(number),
          restaurant:restaurants(name, slug, logo_url)
        `)
        .eq('id', sessionId)
        .in('status', ['open', 'closing'])
        .maybeSingle()

      if (active) {
        const { data: participant } = await supabase
          .from('session_participants')
          .select('id')
          .eq('session_id', sessionId)
          .eq('customer_id', customerId)
          .maybeSingle()

        if (participant) {
          const tableRaw = active.table as { number: string } | { number: string }[] | null
          const table = Array.isArray(tableRaw) ? tableRaw[0] : tableRaw
          const restRaw = active.restaurant as { name: string; slug: string; logo_url: string | null } | { name: string; slug: string; logo_url: string | null }[] | null
          const rest = Array.isArray(restRaw) ? restRaw[0] : restRaw

          activeSession = {
            sessionId: active.id,
            slug: rest?.slug ?? '',
            restaurantName: rest?.name ?? 'Restaurante',
            logoUrl: rest?.logo_url ?? null,
            tableNumber: table?.number ?? '—',
            status: active.status,
          }
        }
      }
    }

    return NextResponse.json({
      customer: {
        firstName: customer.first_name,
        lastName:  customer.last_name,
        whatsapp:  customer.whatsapp,
      },
      visits,
      favorites: favoriteRestaurants,
      receiptSummary,
      hasPin: Boolean(customer.pin_hash),
      activeSession,
    })
  } catch (err) {
    console.error('[Customer Hub API Error]', err)
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 })
  }
}
