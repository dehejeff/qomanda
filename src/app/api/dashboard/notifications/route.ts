import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireOwnerAccess, RestaurantAuthError } from '@/lib/restaurant-auth'
import {
  countUnreadNotifications,
  fetchRestaurantNotifications,
  markAllNotificationsRead,
} from '@/lib/nfe-retention-reminders-server'

export async function GET() {
  try {
    const access = await requireOwnerAccess()
    const admin = createAdminClient()
    const [notifications, unreadCount] = await Promise.all([
      fetchRestaurantNotifications(admin, access.restaurantId),
      countUnreadNotifications(admin, access.restaurantId),
    ])
    return NextResponse.json({ notifications, unreadCount })
  } catch (err) {
    if (err instanceof RestaurantAuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    console.error('[Dashboard Notifications GET]', err)
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const access = await requireOwnerAccess()
    const admin = createAdminClient()
    const body = await req.json().catch(() => ({})) as { all?: boolean; notificationId?: string }

    if (body.all) {
      await markAllNotificationsRead(admin, access.restaurantId)
      return NextResponse.json({ ok: true })
    }

    if (body.notificationId) {
      const { markNotificationRead } = await import('@/lib/nfe-retention-reminders-server')
      await markNotificationRead(admin, access.restaurantId, body.notificationId)
      return NextResponse.json({ ok: true })
    }

    return NextResponse.json({ error: 'Parâmetro inválido.' }, { status: 400 })
  } catch (err) {
    if (err instanceof RestaurantAuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    console.error('[Dashboard Notifications PATCH]', err)
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 })
  }
}
