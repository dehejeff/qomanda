import { NextRequest, NextResponse } from 'next/server'
import { StaffAuthError, requireStaff } from '@/lib/staff-auth'
import {
  fetchFinancialAuditEvents,
  fetchFinancialAuditSummary,
  type FinancialEntityType,
} from '@/lib/financial-audit'

type RouteParams = { params: Promise<{ id: string }> }

export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params
    const { admin } = await requireStaff()

    const entityParam = req.nextUrl.searchParams.get('entity') ?? 'all'
    const limit = Math.min(Number(req.nextUrl.searchParams.get('limit') ?? 50), 200)
    const from = req.nextUrl.searchParams.get('from') ?? undefined
    const to = req.nextUrl.searchParams.get('to') ?? undefined
    const confirmationCode = req.nextUrl.searchParams.get('confirmationCode') ?? undefined
    const entityType =
      entityParam === 'payment' || entityParam === 'order' || entityParam === 'order_item'
        ? (entityParam as FinancialEntityType)
        : 'all'

    const [summary, events] = await Promise.all([
      fetchFinancialAuditSummary(admin, id),
      fetchFinancialAuditEvents(admin, id, {
        limit,
        entityType,
        from,
        to,
        confirmationCode,
      }),
    ])

    return NextResponse.json({ summary, events })
  } catch (err) {
    if (err instanceof StaffAuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    console.error('[Financial Audit]', err)
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 })
  }
}
