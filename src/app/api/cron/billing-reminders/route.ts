import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { runBillingReminders } from '@/lib/internal-billing-email'

/**
 * GET/POST /api/cron/billing-reminders
 * Envia lembrete por e-mail das mensalidades em atraso (1x/dia por fatura).
 * Vercel Cron dispara GET com Authorization: Bearer CRON_SECRET (vercel.json).
 */
function authorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return process.env.NODE_ENV !== 'production'
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
  const summary = await runBillingReminders(admin)
  return NextResponse.json({ ok: true, ...summary })
}

export async function GET(req: NextRequest) {
  return run(req)
}

export async function POST(req: NextRequest) {
  return run(req)
}
