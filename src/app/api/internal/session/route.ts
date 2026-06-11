import { NextResponse } from 'next/server'
import { StaffAuthError, requireStaff } from '@/lib/staff-auth'

/** GET /api/internal/session — validação leve pós-login (sem carregar overview). */
export async function GET() {
  try {
    const { user, staff } = await requireStaff()
    return NextResponse.json({
      ok: true,
      email: user.email,
      role: staff?.role ?? 'allowlist',
    })
  } catch (err) {
    if (err instanceof StaffAuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    console.error('[Internal session GET]', err)
    return NextResponse.json({ error: 'Erro ao validar sessão.' }, { status: 500 })
  }
}
