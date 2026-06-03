import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { runNfeRetentionReminders } from '@/lib/nfe-retention-reminders-server'

/**
 * GET/POST /api/cron/nfe-retention-reminders
 * Avisos 20, 15 e 5 dias antes da exclusão de NF-e (painel + e-mail).
 */
function authorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return process.env.NODE_ENV !== 'production'
  const provided = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
    ?? req.headers.get('x-cron-secret')
    ?? ''
  return provided === secret
}

export async function GET(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 })
  try {
    const result = await runNfeRetentionReminders(createAdminClient())
    return NextResponse.json(result)
  } catch (err) {
    console.error('[cron nfe-retention-reminders]', err)
    return NextResponse.json({ error: 'Erro ao processar lembretes.' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  return GET(req)
}
