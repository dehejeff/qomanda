import { NextResponse } from 'next/server'
import { StaffAuthError, requireStaff } from '@/lib/staff-auth'
import { fetchPlans } from '@/lib/internal-clients'

export async function GET() {
  try {
    const { admin } = await requireStaff()
    const plans = await fetchPlans(admin)
    return NextResponse.json({ plans })
  } catch (err) {
    if (err instanceof StaffAuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    console.error('[Internal plans GET]', err)
    return NextResponse.json({ error: 'Erro ao carregar planos.' }, { status: 500 })
  }
}
