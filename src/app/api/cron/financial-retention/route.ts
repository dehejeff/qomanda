import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { runFinancialRetentionPurge } from '@/lib/financial-retention'

/**
 * GET/POST /api/cron/financial-retention
 * Remove dados financeiros detalhados com mais de 90 dias (após rollup mensal).
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
    const run = await runFinancialRetentionPurge(createAdminClient(), 'cron')
    if (!run) {
      return NextResponse.json({ error: 'Falha no purge.' }, { status: 500 })
    }
    return NextResponse.json({ ok: true, run })
  } catch (err) {
    console.error('[cron financial-retention]', err)
    return NextResponse.json({ error: 'Erro ao processar retenção.' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  return GET(req)
}
