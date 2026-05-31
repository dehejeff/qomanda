import { NextRequest, NextResponse } from 'next/server'
import { StaffAuthError, requireStaff } from '@/lib/staff-auth'
import {
  fetchTicketDetail,
  isSupportPriority,
  isSupportStatus,
  mapTicketRow,
} from '@/lib/support-tickets'

/**
 * GET /api/internal/support/tickets?status=open
 */
export async function GET(req: NextRequest) {
  try {
    const { admin } = await requireStaff()
    const status = req.nextUrl.searchParams.get('status')

    let query = admin
      .from('support_tickets')
      .select(`
        *,
        restaurant:restaurants ( id, name, slug )
      `)
      .order('last_message_at', { ascending: false })
      .limit(100)

    if (status && isSupportStatus(status)) {
      query = query.eq('status', status)
    }

    const { data, error } = await query
    if (error) throw error

    const tickets = (data ?? []).map(row => {
      const restaurant = row.restaurant as { name?: string } | null
      return mapTicketRow(row as Record<string, unknown>, restaurant?.name)
    })

    const openCount = tickets.filter(t => t.status === 'open' || t.status === 'in_progress').length

    return NextResponse.json({ tickets, openCount })
  } catch (err) {
    if (err instanceof StaffAuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    console.error('[Internal support GET]', err)
    return NextResponse.json({ error: 'Erro ao carregar tickets.' }, { status: 500 })
  }
}
