import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireOwnerAccess, RestaurantAuthError } from '@/lib/restaurant-auth'
import { fetchAnalyticsData } from '@/lib/dashboard-analytics'
import { buildAnalyticsCsv, buildAnalyticsHtml } from '@/lib/dashboard-analytics-export'
import { resolvePeriodRange, PERIOD_OPTIONS, type ReportPeriod } from '@/lib/dashboard-reports'

const VALID = new Set<ReportPeriod>(['today', 'week', 'fortnight', 'month', 'last_month'])

/** GET /api/dashboard/reports/export?period=week&format=csv|html — owner. */
export async function GET(req: NextRequest) {
  try {
    const access = await requireOwnerAccess()
    const admin = createAdminClient()

    const pParam = req.nextUrl.searchParams.get('period') as ReportPeriod | null
    const period: ReportPeriod = pParam && VALID.has(pParam) ? pParam : 'week'
    const format = req.nextUrl.searchParams.get('format') === 'html' ? 'html' : 'csv'

    const data = await fetchAnalyticsData(admin, access.restaurantId, period)
    const periodLabel = resolvePeriodRange(period).label
      + ` (${PERIOD_OPTIONS.find(o => o.id === period)?.label ?? period})`
    const stamp = new Date().toISOString().slice(0, 10)
    const safeName = access.restaurantName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'restaurante'

    if (format === 'html') {
      const html = buildAnalyticsHtml(data, periodLabel, access.restaurantName)
      return new NextResponse(html, {
        headers: { 'Content-Type': 'text/html; charset=utf-8', 'Content-Disposition': `inline; filename="analytics-${safeName}-${stamp}.html"` },
      })
    }

    const csv = buildAnalyticsCsv(data, periodLabel)
    return new NextResponse(csv, {
      headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="analytics-${safeName}-${stamp}.csv"` },
    })
  } catch (err) {
    if (err instanceof RestaurantAuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    console.error('[Reports export]', err)
    return NextResponse.json({ error: 'Erro ao exportar.' }, { status: 500 })
  }
}
