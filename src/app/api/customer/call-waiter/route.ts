import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

const THROTTLE_SECONDS = 90

/**
 * POST /api/customer/call-waiter  { sessionId, note? }
 * Cria uma notificação 'call_waiter' para o restaurante da sessão.
 * Throttle: ignora chamados repetidos da mesma sessão em < 90s.
 */
export async function POST(req: NextRequest) {
  try {
    const { sessionId, note } = await req.json() as { sessionId?: string; note?: string }
    if (!sessionId) {
      return NextResponse.json({ error: 'Sessão inválida.' }, { status: 400 })
    }

    const admin = createAdminClient()

    const { data: session } = await admin
      .from('sessions')
      .select('id, restaurant_id, status, table:tables(number)')
      .eq('id', sessionId)
      .maybeSingle()

    if (!session) return NextResponse.json({ error: 'Sessão não encontrada.' }, { status: 404 })
    if (session.status === 'closed') {
      return NextResponse.json({ error: 'Esta mesa já foi encerrada.' }, { status: 409 })
    }

    const tableRaw = session.table
    const table = (Array.isArray(tableRaw) ? tableRaw[0] : tableRaw) as { number?: string } | null
    const tableNumber = table?.number ?? null
    const isCounter = (tableNumber ?? '').toUpperCase() === 'BALCAO'
    const localLabel = isCounter ? 'Balcão' : tableNumber ? `Mesa ${tableNumber}` : 'Mesa'

    // Throttle: já há um chamado recente desta sessão ainda não lido?
    const since = new Date(Date.now() - THROTTLE_SECONDS * 1000).toISOString()
    const { data: recent } = await admin
      .from('restaurant_notifications')
      .select('id')
      .eq('restaurant_id', session.restaurant_id)
      .eq('type', 'call_waiter')
      .eq('session_id', sessionId)
      .gte('created_at', since)
      .maybeSingle()

    if (recent) {
      return NextResponse.json({ ok: true, throttled: true, message: 'Garçom já foi avisado. Aguarde um instante.' })
    }

    const cleanNote = (note ?? '').trim().slice(0, 140)
    const { error } = await admin
      .from('restaurant_notifications')
      .insert({
        restaurant_id: session.restaurant_id,
        session_id: sessionId,
        type: 'call_waiter',
        title: `Chamado — ${localLabel}`,
        body: cleanNote || `${localLabel} está chamando o garçom.`,
        link: '/garcom/mesas',
        severity: 'warning',
        metadata: { tableNumber, localLabel, isCounter, note: cleanNote || null },
      })

    if (error) {
      console.error('[call-waiter] insert', error)
      return NextResponse.json({ error: 'Não foi possível chamar o garçom.' }, { status: 500 })
    }

    return NextResponse.json({ ok: true, localLabel })
  } catch (err) {
    console.error('[call-waiter]', err)
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 })
  }
}
