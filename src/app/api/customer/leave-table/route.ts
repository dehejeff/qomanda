import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { closeSessionIfSettled, sessionBalance } from '@/lib/close-session-if-settled'
import { SETTLE_TOLERANCE } from '@/lib/session-billing'

/**
 * POST /api/customer/leave-table
 * Cliente sai da mesa quando não há valor em aberto.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as { sessionId?: string; customerId?: string }
    const { sessionId, customerId } = body

    if (!sessionId || !customerId) {
      return NextResponse.json({ error: 'Sessão ou cliente inválido.' }, { status: 400 })
    }

    const supabase = createAdminClient()

    const { data: session } = await supabase
      .from('sessions')
      .select('id, status')
      .eq('id', sessionId)
      .maybeSingle()

    if (!session || session.status === 'closed') {
      return NextResponse.json({ error: 'Sessão não encontrada ou já encerrada.' }, { status: 404 })
    }

    const { data: participant } = await supabase
      .from('session_participants')
      .select('id')
      .eq('session_id', sessionId)
      .eq('customer_id', customerId)
      .maybeSingle()

    if (!participant) {
      return NextResponse.json({ error: 'Você não está vinculado a esta mesa.' }, { status: 403 })
    }

    const balance = await sessionBalance(supabase, sessionId)
    if (balance.remaining > SETTLE_TOLERANCE) {
      return NextResponse.json({
        error: 'Ainda há valores em aberto na mesa. Quite sua conta antes de sair.',
      }, { status: 400 })
    }

    const { error: removeError } = await supabase
      .from('session_participants')
      .delete()
      .eq('session_id', sessionId)
      .eq('customer_id', customerId)

    if (removeError) {
      console.error('[Leave Table] remove participant', removeError)
      return NextResponse.json({ error: 'Erro ao sair da mesa.' }, { status: 500 })
    }

    const { count: participantsLeft } = await supabase
      .from('session_participants')
      .select('id', { count: 'exact', head: true })
      .eq('session_id', sessionId)

    let sessionClosed = false
    if ((participantsLeft ?? 0) === 0) {
      const result = await closeSessionIfSettled(supabase, sessionId)
      sessionClosed = result.closed
    }

    return NextResponse.json({ ok: true, sessionClosed })
  } catch (err) {
    console.error('[Leave Table Error]', err)
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 })
  }
}
