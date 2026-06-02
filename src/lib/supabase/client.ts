import { createBrowserClient } from '@supabase/ssr'
import type { SupabaseClient } from '@supabase/supabase-js'
import { clearStaleAuthSession, isInvalidRefreshTokenError } from '@/lib/supabase/auth-errors'

let browserClient: SupabaseClient | undefined
let authRecoveryInstalled = false

function installAuthRecovery(client: SupabaseClient) {
  if (typeof window === 'undefined' || authRecoveryInstalled) return
  authRecoveryInstalled = true

  void client.auth.getUser().then(({ error }) => {
    if (error && isInvalidRefreshTokenError(error)) {
      void clearStaleAuthSession(client)
    }
  })

  client.auth.onAuthStateChange((event) => {
    if (event === 'TOKEN_REFRESHED') return
    if (event === 'SIGNED_OUT') {
      authRecoveryInstalled = false
    }
  })
}

export function createClient() {
  if (!browserClient) {
    browserClient = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    )
    installAuthRecovery(browserClient)
  }
  return browserClient
}
