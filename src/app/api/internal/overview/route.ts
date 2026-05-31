import { NextResponse } from 'next/server'
import { StaffAuthError, requireStaff } from '@/lib/staff-auth'
import { buildInternalOverview } from '@/lib/internal-overview'

export async function GET() {
  try {
    const { admin } = await requireStaff()
    const overview = await buildInternalOverview(admin)
    return NextResponse.json(overview)
  } catch (err) {
    if (err instanceof StaffAuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    console.error('[Internal overview GET]', err)
    return NextResponse.json({ error: 'Erro ao carregar overview.' }, { status: 500 })
  }
}
