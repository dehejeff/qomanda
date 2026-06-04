import { NextResponse } from 'next/server'
import { StaffAuthError, requireStaff } from '@/lib/staff-auth'
import { fetchInternalBilling, buildBillingCsv } from '@/lib/internal-billing'
import { brToday } from '@/lib/date-tz'

/** GET /api/internal/billing/export — CSV da visão de cobrança (staff). */
export async function GET() {
  try {
    const { admin } = await requireStaff()
    const { rows } = await fetchInternalBilling(admin)
    const csv = buildBillingCsv(rows)
    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="cobranca-qomanda-${brToday()}.csv"`,
      },
    })
  } catch (err) {
    if (err instanceof StaffAuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    console.error('[Internal billing export]', err)
    return NextResponse.json({ error: 'Erro ao exportar.' }, { status: 500 })
  }
}
