import { NextResponse } from 'next/server'
import { StaffAuthError, requireStaff } from '@/lib/staff-auth'
import { fetchSystemHealth } from '@/lib/internal-health'

/** GET /api/internal/health — saúde operacional (fila, webhooks, NF-e, atraso). */
export async function GET() {
  try {
    const { admin } = await requireStaff()
    const health = await fetchSystemHealth(admin)
    return NextResponse.json(health)
  } catch (err) {
    if (err instanceof StaffAuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    console.error('[Internal health GET]', err)
    return NextResponse.json({ error: 'Erro ao carregar saúde do sistema.' }, { status: 500 })
  }
}
