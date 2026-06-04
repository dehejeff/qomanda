import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { processDueJobs } from '@/lib/job-queue'

/**
 * GET/POST /api/cron/process-jobs
 * Consome a fila assíncrona (NF-e, WhatsApp). Idempotente e com retry/backoff.
 *
 * - Vercel Cron dispara GET com Authorization: Bearer CRON_SECRET (vercel.json).
 * - POST permite disparo manual (mesmo secret) para processar na hora.
 */
function authorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return process.env.NODE_ENV !== 'production' // dev: libera sem secret
  const provided = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
    ?? req.headers.get('x-cron-secret')
    ?? ''
  return provided === secret
}

async function run(req: NextRequest) {
  if (!authorized(req)) {
    return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 })
  }
  const admin = createAdminClient()
  const summary = await processDueJobs(admin, { limit: 25 })
  return NextResponse.json({ ok: true, ...summary })
}

export async function GET(req: NextRequest) {
  return run(req)
}

export async function POST(req: NextRequest) {
  return run(req)
}
