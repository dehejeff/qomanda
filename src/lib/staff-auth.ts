import { createClient, getServerUser } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import type { StaffUser } from '@/types/internal'
import type { User } from '@supabase/supabase-js'

export class StaffAuthError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

function staffEmailAllowlist(): string[] {
  return (process.env.QOMANDA_STAFF_EMAILS ?? '')
    .split(',')
    .map(e => e.trim().toLowerCase())
    .filter(Boolean)
}

export function isStaffEmailAllowed(email: string | undefined | null): boolean {
  if (!email) return false
  return staffEmailAllowlist().includes(email.toLowerCase())
}

/** DEV_BYPASS também libera o portal interno em desenvolvimento local. */
export function isInternalDevBypass(): boolean {
  return process.env.NEXT_PUBLIC_DEV_BYPASS === 'true'
}

export type StaffContext = {
  user: User
  staff: StaffUser | null
  admin: ReturnType<typeof createAdminClient>
}

export async function requireStaff(): Promise<StaffContext> {
  if (isInternalDevBypass()) {
    const admin = createAdminClient()
    return {
      user: { id: 'dev-staff', email: 'dev@qomanda.local' } as User,
      staff: null,
      admin,
    }
  }

  const { user } = await getServerUser()
  if (!user) throw new StaffAuthError('Não autenticado.', 401)

  const admin = createAdminClient()
  const { data: staff } = await admin
    .from('staff_users')
    .select('*')
    .eq('user_id', user.id)
    .eq('active', true)
    .maybeSingle()

  if (!staff && !isStaffEmailAllowed(user.email)) {
    throw new StaffAuthError('Acesso restrito à equipe Qomanda.', 403)
  }

  return { user, staff: staff as StaffUser | null, admin }
}

export async function getStaffSession(): Promise<StaffContext | null> {
  try {
    return await requireStaff()
  } catch {
    return null
  }
}
