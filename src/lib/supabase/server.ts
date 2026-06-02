import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { clearStaleAuthSession, isInvalidRefreshTokenError } from '@/lib/supabase/auth-errors'

export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {}
        },
      },
    }
  )
}

/** getUser com limpeza automática de refresh token inválido (server components / routes). */
export async function getServerUser() {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error && isInvalidRefreshTokenError(error)) {
    await clearStaleAuthSession(supabase)
    return { user: null, error }
  }
  return { user, error }
}
