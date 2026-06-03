import { NextRequest, NextResponse } from 'next/server'
import { StaffAuthError, requireStaff } from '@/lib/staff-auth'
import {
  fetchFinancialAuditEventsForExport,
  type FinancialEntityType,
} from '@/lib/financial-audit'
import { buildAuditCsv, buildAuditHtmlReport } from '@/lib/financial-audit-export'
import { fetchRestaurantMonthlyStats } from '@/lib/restaurant-monthly-stats'
import { FINANCIAL_RETENTION_DAYS } from '@/lib/financial-retention'

type RouteParams = { params: Promise<{ id: string }> }

export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params
    const { admin } = await requireStaff()

    const format = req.nextUrl.searchParams.get('format') ?? 'csv'
    const from = req.nextUrl.searchParams.get('from') ?? undefined
    const to = req.nextUrl.searchParams.get('to') ?? undefined
    const confirmationCode = req.nextUrl.searchParams.get('confirmationCode') ?? undefined
    const entityParam = req.nextUrl.searchParams.get('entity') ?? 'all'
    const entityType =
      entityParam === 'payment' || entityParam === 'order' || entityParam === 'order_item'
        ? (entityParam as FinancialEntityType)
        : 'all'

    const { data: restaurant } = await admin
      .from('restaurants')
      .select('name, slug')
      .eq('id', id)
      .maybeSingle()

    if (!restaurant) {
      return NextResponse.json({ error: 'Cliente não encontrado.' }, { status: 404 })
    }

    const [events, monthlyStats] = await Promise.all([
      fetchFinancialAuditEventsForExport(admin, id, {
        from,
        to,
        confirmationCode,
        entityType,
      }),
      fetchRestaurantMonthlyStats(admin, id, 24),
    ])

    const filters = { from, to, confirmationCode }

    if (format === 'html' || format === 'pdf') {
      const html = buildAuditHtmlReport({
        restaurantName: restaurant.name,
        restaurantSlug: restaurant.slug,
        events,
        monthlyStats: monthlyStats.map(s => ({
          periodLabel: s.periodLabel,
          revenueTotal: s.revenueTotal,
          gmvDigital: s.gmvDigital,
          paymentCount: s.paymentCount,
        })),
        retentionDays: FINANCIAL_RETENTION_DAYS,
        filters,
      })
      return new NextResponse(html, {
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
          'Content-Disposition': `inline; filename="auditoria-${restaurant.slug}.html"`,
        },
      })
    }

    const csv = buildAuditCsv(restaurant.name, events, filters)
    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="auditoria-${restaurant.slug}.csv"`,
      },
    })
  } catch (err) {
    if (err instanceof StaffAuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    console.error('[Financial Audit Export]', err)
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 })
  }
}
