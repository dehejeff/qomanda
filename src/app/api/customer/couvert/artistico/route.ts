import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { materializeArtisticoForSession } from '@/lib/couvert'

/**
 * POST /api/customer/couvert/artistico  { sessionId }
 * Materializa (idempotente) 1 couvert artístico por participante quando a sessão
 * está na janela do show (dias + horário, fuso BR). Chamado preguiçosamente pela
 * home/checkout — não depende de cron.
 */
export async function POST(req: NextRequest) {
  try {
    const { sessionId } = (await req.json()) as { sessionId?: string }
    if (!sessionId) return NextResponse.json({ error: 'Sessão inválida.' }, { status: 400 })

    const admin = createAdminClient()
    const { created } = await materializeArtisticoForSession(admin, sessionId)
    return NextResponse.json({ ok: true, created })
  } catch (err) {
    console.error('[couvert artistico]', err)
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 })
  }
}
