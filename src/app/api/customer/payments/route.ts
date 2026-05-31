import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * GET /api/customer/payments?session=SESSION_ID
 * Pagamentos confirmados do cliente na sessão (recibos + códigos).
 */
export async function GET(req: NextRequest) {
  const sessionId = req.nextUrl.searchParams.get('session')
  if (!sessionId) {
    return NextResponse.json({ error: 'session obrigatório.' }, { status: 400 })
  }

  try {
    const supabase = createAdminClient()

    const { data: session } = await supabase
      .from('sessions')
      .select('customer_id, table:tables(number), restaurant:restaurants(name)')
      .eq('id', sessionId)
      .single()

    if (!session?.customer_id) {
      return NextResponse.json({ error: 'Sessão inválida.' }, { status: 404 })
    }

    const { data: payments, error } = await supabase
      .from('payments')
      .select('id, amount, method, split_type, service_fee_included, confirmation_code, paid_at, created_at')
      .eq('session_id', sessionId)
      .eq('customer_id', session.customer_id)
      .eq('status', 'paid')
      .order('paid_at', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false })

    if (error) {
      console.error('[Customer Payments API]', error)
      return NextResponse.json({ error: 'Erro ao carregar pagamentos.' }, { status: 500 })
    }

    const table = session.table as { number?: string } | null
    const restaurant = session.restaurant as { name?: string } | null

    return NextResponse.json({
      payments: payments ?? [],
      context: {
        restaurantName: restaurant?.name ?? 'Restaurante',
        tableNumber: table?.number ?? '—',
      },
    })
  } catch (err) {
    console.error('[Customer Payments API Error]', err)
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 })
  }
}
