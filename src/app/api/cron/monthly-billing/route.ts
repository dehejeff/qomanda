import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { generateMonthlyInvoice, restaurantsDueForBilling } from '@/lib/monthly-billing'

/**
 * GET/POST /api/cron/monthly-billing
 * Gera a fatura mensal (mensalidade + comissão) e cria a cobrança PIX de cada
 * restaurante com assinatura ativa. Idempotente por período.
 *
 * - Vercel Cron dispara GET com Authorization: Bearer CRON_SECRET (vercel.json).
 * - POST aceita body { year, month, charge } para disparo manual/reprocesso.
 */
function authorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return process.env.NODE_ENV !== 'production' // dev: libera sem secret
  const provided = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
    ?? req.headers.get('x-cron-secret')
    ?? ''
  return provided === secret
}

async function runBilling(year: number, month: number, charge: boolean) {
  const admin = createAdminClient()
  const ids = await restaurantsDueForBilling(admin)

  const results = []
  for (const restaurantId of ids) {
    const r = await generateMonthlyInvoice(admin, restaurantId, { year, month, charge })
    results.push({ restaurantId, ...r })
  }

  return {
    period: `${month}/${year}`,
    restaurants: ids.length,
    created: results.filter(r => r.ok && !r.reason?.includes('exists')).length,
    charged: results.filter(r => r.charged).length,
    skipped: results.filter(r => !r.ok || r.reason?.includes('exists')).length,
    results,
  }
}

export async function GET(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 })
  try {
    const now = new Date()
    const out = await runBilling(now.getFullYear(), now.getMonth() + 1, true)
    return NextResponse.json({ ok: true, ...out })
  } catch (err) {
    console.error('[cron monthly-billing GET]', err)
    return NextResponse.json({ error: 'Erro ao processar faturamento.' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 })
  try {
    const body = await req.json().catch(() => ({})) as { year?: number; month?: number; charge?: boolean }
    const now = new Date()
    const out = await runBilling(
      body.year ?? now.getFullYear(),
      body.month ?? (now.getMonth() + 1),
      body.charge ?? true,
    )
    return NextResponse.json({ ok: true, ...out })
  } catch (err) {
    console.error('[cron monthly-billing POST]', err)
    return NextResponse.json({ error: 'Erro ao processar faturamento.' }, { status: 500 })
  }
}
