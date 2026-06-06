import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireOwnerAccess, RestaurantAuthError } from '@/lib/restaurant-auth'
import { brMidnight, brToday } from '@/lib/date-tz'

export async function GET() {
  try {
    const access = await requireOwnerAccess()
    const admin = createAdminClient()

    // Últimas 48h para incluir pedidos em aberto de ontem
    const since = new Date(brMidnight(brToday()).getTime() - 48 * 60 * 60 * 1000).toISOString()

    const { data } = await admin
      .from('payments')
      .select(`
        id, status, method, amount, confirmation_code,
        created_at, paid_at, asaas_payment_id,
        customer:customers ( first_name, last_name ),
        session:sessions ( table:tables ( number ) )
      `)
      .eq('restaurant_id', access.restaurantId)
      .gte('created_at', since)
      .not('method', 'in', '("offer")')
      .order('created_at', { ascending: false })
      .limit(200)

    const payments = (data ?? []).map((p: any) => {
      const cRaw = p.customer
      const c = Array.isArray(cRaw) ? cRaw[0] : cRaw
      const sRaw = p.session
      const s = Array.isArray(sRaw) ? sRaw[0] : sRaw
      const tRaw = s?.table
      const t = Array.isArray(tRaw) ? tRaw[0] : tRaw
      const isManualPending = (p.method === 'cash' || (p.method === 'pix' && !p.asaas_payment_id)) && p.status === 'pending'
      return {
        id: p.id,
        ref: p.id.slice(-6).toUpperCase(),
        status: p.status as string,
        method: p.method as string,
        amount: Number(p.amount),
        confirmationCode: p.confirmation_code ?? null,
        createdAt: p.created_at,
        paidAt: p.paid_at ?? null,
        customerName: c ? `${c.first_name ?? ''} ${c.last_name ?? ''}`.trim() || 'Cliente' : 'Cliente',
        tableNumber: t?.number ?? null,
        isManualPending,
      }
    })

    return NextResponse.json({ payments })
  } catch (err) {
    if (err instanceof RestaurantAuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    return NextResponse.json({ error: 'Erro ao carregar pagamentos.' }, { status: 500 })
  }
}
