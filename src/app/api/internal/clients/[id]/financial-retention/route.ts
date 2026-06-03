import { NextRequest, NextResponse } from 'next/server'
import { StaffAuthError, requireStaff } from '@/lib/staff-auth'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  fetchRetentionStatus,
  runFinancialRetentionPurge,
  FINANCIAL_RETENTION_DAYS,
} from '@/lib/financial-retention'
import { fetchRestaurantMonthlyStats } from '@/lib/restaurant-monthly-stats'

type RouteParams = { params: Promise<{ id: string }> }

export async function GET(_req: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params
    const { admin } = await requireStaff()

    const [status, monthlyStats] = await Promise.all([
      fetchRetentionStatus(admin, id),
      fetchRestaurantMonthlyStats(admin, id, 12),
    ])

    return NextResponse.json({
      retentionDays: FINANCIAL_RETENTION_DAYS,
      status,
      monthlyStats,
    })
  } catch (err) {
    if (err instanceof StaffAuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    console.error('[Financial Retention GET]', err)
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 })
  }
}

/** Dispara purge manual (superadmin/ops). Idempotente — seguro rodar diariamente via cron. */
export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
    await params
    const { user, staff, admin } = await requireStaff()
    if (staff && !['superadmin', 'ops'].includes(staff.role)) {
      throw new StaffAuthError('Sem permissão para executar retenção.', 403)
    }

    const body = await req.json().catch(() => ({})) as { dryRun?: boolean }
    if (body.dryRun) {
      const status = await fetchRetentionStatus(admin)
      return NextResponse.json({
        ok: true,
        dryRun: true,
        retentionDays: FINANCIAL_RETENTION_DAYS,
        message: `Purge removeria registros anteriores a ${FINANCIAL_RETENTION_DAYS} dias após rollup mensal.`,
        status,
      })
    }

    const run = await runFinancialRetentionPurge(admin, 'staff')
    if (!run) {
      return NextResponse.json({ error: 'Falha ao executar retenção.' }, { status: 500 })
    }

    return NextResponse.json({ ok: true, run, triggeredBy: user.id })
  } catch (err) {
    if (err instanceof StaffAuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    console.error('[Financial Retention POST]', err)
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 })
  }
}
