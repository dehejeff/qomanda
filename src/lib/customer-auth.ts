import type { SupabaseClient } from '@supabase/supabase-js'
import type { AppRouterInstance } from 'next/dist/shared/lib/app-router-context.shared-runtime'

export type CustomerActiveSession = {
  sessionId: string
  slug: string
  restaurantName: string
  logoUrl: string | null
  tableNumber: string
  status: string
}

type SessionRow = {
  id: string
  status: string
  table: { number: string } | { number: string }[] | null
  restaurant: { name: string; slug: string; logo_url: string | null } | { name: string; slug: string; logo_url: string | null }[] | null
}

/** Sessão aberta mais recente do cliente (open / closing). */
export async function findCustomerActiveSession(
  supabase: SupabaseClient,
  customerId: string,
): Promise<CustomerActiveSession | null> {
  const { data: participations } = await supabase
    .from('session_participants')
    .select(`
      joined_at,
      session_id,
      sessions(
        id,
        status,
        table:tables(number),
        restaurant:restaurants(name, slug, logo_url)
      )
    `)
    .eq('customer_id', customerId)
    .order('joined_at', { ascending: false })
    .limit(10)

  for (const row of participations ?? []) {
    const sessRaw = row.sessions as SessionRow | SessionRow[] | null
    const sess = Array.isArray(sessRaw) ? sessRaw[0] : sessRaw
    if (!sess || !['open', 'closing'].includes(sess.status)) continue

    const tableRaw = sess.table
    const table = Array.isArray(tableRaw) ? tableRaw[0] : tableRaw
    const restRaw = sess.restaurant
    const rest = Array.isArray(restRaw) ? restRaw[0] : restRaw

    return {
      sessionId: sess.id,
      slug: rest?.slug ?? '',
      restaurantName: rest?.name ?? 'Restaurante',
      logoUrl: rest?.logo_url ?? null,
      tableNumber: table?.number ?? '—',
      status: sess.status,
    }
  }

  return null
}

/** Persiste identidade do cliente no localStorage (browser). */
export function persistCustomerAuth(
  customerId: string,
  firstName: string,
  lastName: string,
  activeSession?: CustomerActiveSession | null,
) {
  localStorage.setItem('qomanda_customer_id', customerId)
  localStorage.setItem('qomanda_customer_name', `${firstName} ${lastName}`.trim())
  if (activeSession) {
    localStorage.setItem('qomanda_session_id', activeSession.sessionId)
  }
}

const SESSION_TOKEN_KEY = 'qomanda_customer_session_token'

/** Token de sessão autenticada (emitido após a senha de 6 dígitos). */
export function setCustomerSessionToken(token: string) {
  localStorage.setItem(SESSION_TOKEN_KEY, token)
}

export function getCustomerSessionToken(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem(SESSION_TOKEN_KEY)
}

export function clearCustomerSessionToken() {
  localStorage.removeItem(SESSION_TOKEN_KEY)
}

/** Headers com a sessão autenticada para chamadas sensíveis (cartões/pagamento). */
export function authHeaders(extra?: Record<string, string>): Record<string, string> {
  const token = getCustomerSessionToken()
  return {
    ...(extra ?? {}),
    ...(token ? { 'x-customer-session': token } : {}),
  }
}

/** Cliente encerra visita ao restaurante (mantém login WhatsApp → hub). */
export function leaveRestaurantSession(router: AppRouterInstance, restaurantSlug?: string) {
  localStorage.removeItem('qomanda_session_id')
  if (localStorage.getItem('qomanda_customer_id')) {
    router.replace('/hub')
    return
  }
  if (restaurantSlug) {
    router.replace(`/${restaurantSlug}`)
    return
  }
  router.replace('/login?perfil=cliente')
}

/** @deprecated use leaveRestaurantSession */
export const redirectAfterSessionEnd = leaveRestaurantSession
