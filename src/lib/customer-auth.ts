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

/** Navegação completa para o app do restaurante (confiável após check-in no mobile/PWA). */
export function navigateToCustomerHome(slug: string, sessionId: string) {
  if (typeof window === 'undefined') return
  localStorage.setItem('kicomanda_session_id', sessionId)
  const path = `/${slug}/home?session=${encodeURIComponent(sessionId)}`
  window.location.replace(path)
}

/** session na URL ou última sessão salva neste aparelho. */
export function resolveCustomerSessionId(searchParams?: Pick<URLSearchParams, 'get'> | null): string | null {
  const fromUrl = searchParams?.get('session') ?? null
  if (fromUrl) return fromUrl
  if (typeof window === 'undefined') return null
  return localStorage.getItem('kicomanda_session_id')
}

/** Persiste identidade do cliente no localStorage (browser). */
export function persistCustomerAuth(
  customerId: string,
  firstName: string,
  lastName: string,
  activeSession?: CustomerActiveSession | null,
) {
  localStorage.setItem('kicomanda_customer_id', customerId)
  localStorage.setItem('kicomanda_customer_name', `${firstName} ${lastName}`.trim())
  if (activeSession) {
    localStorage.setItem('kicomanda_session_id', activeSession.sessionId)
  }
}

import {
  CUSTOMER_SESSION_INACTIVITY_MS,
  CUSTOMER_SESSION_RENEWAL_HEADER,
} from '@/lib/customer-session-shared'

const SESSION_TOKEN_KEY = 'kicomanda_customer_session_token'
const SESSION_LAST_ACTIVITY_KEY = 'kicomanda_customer_session_last_activity'

/** Token de sessão autenticada (emitido após a senha de 6 dígitos). */
export function setCustomerSessionToken(token: string) {
  localStorage.setItem(SESSION_TOKEN_KEY, token)
  localStorage.setItem(SESSION_LAST_ACTIVITY_KEY, String(Date.now()))
}

export function getCustomerSessionToken(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem(SESSION_TOKEN_KEY)
}

function getSessionLastActivity(): number {
  if (typeof window === 'undefined') return 0
  const raw = localStorage.getItem(SESSION_LAST_ACTIVITY_KEY)
  const n = raw ? Number(raw) : 0
  return Number.isFinite(n) ? n : 0
}

export function touchCustomerSessionActivity() {
  if (typeof window === 'undefined') return
  if (!getCustomerSessionToken()) return
  localStorage.setItem(SESSION_LAST_ACTIVITY_KEY, String(Date.now()))
}

/** Cliente ficou 15 min sem interação — sessão de cartão expirada localmente. */
export function isCustomerSessionIdleExpired(): boolean {
  const token = getCustomerSessionToken()
  if (!token) return false
  const last = getSessionLastActivity()
  if (last <= 0) return true
  return Date.now() - last > CUSTOMER_SESSION_INACTIVITY_MS
}

/** Retorna token válido ou limpa e retorna null se expirou por inatividade. */
export function ensureActiveCustomerSession(): string | null {
  if (isCustomerSessionIdleExpired()) {
    clearCustomerSessionToken()
    return null
  }
  return getCustomerSessionToken()
}

export function clearCustomerSessionToken() {
  localStorage.removeItem(SESSION_TOKEN_KEY)
  localStorage.removeItem(SESSION_LAST_ACTIVITY_KEY)
}

/** Atualiza token quando o servidor renova lastActivity. */
export function applySessionRenewalFromResponse(res: Response) {
  const renewed = res.headers.get(CUSTOMER_SESSION_RENEWAL_HEADER)
  if (renewed) {
    setCustomerSessionToken(renewed)
  } else if (res.ok && getCustomerSessionToken()) {
    touchCustomerSessionActivity()
  }
}

/** fetch com sessão de cartão + renovação automática por inatividade. */
export async function customerAuthFetch(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> {
  const headers = new Headers(init?.headers)
  const token = ensureActiveCustomerSession()
  if (token) headers.set('x-customer-session', token)

  const res = await fetch(input, { ...init, headers })
  applySessionRenewalFromResponse(res)
  return res
}

/**
 * Observa interação do usuário e encerra sessão de cartão após 15 min ocioso.
 * Retorna função de cleanup.
 */
export function startCustomerSessionIdleWatch(onIdle: () => void): () => void {
  if (typeof window === 'undefined') return () => {}

  let timer: ReturnType<typeof setTimeout> | undefined

  const schedule = () => {
    if (timer) clearTimeout(timer)
    if (!getCustomerSessionToken()) return
    touchCustomerSessionActivity()
    timer = setTimeout(() => {
      if (isCustomerSessionIdleExpired()) {
        clearCustomerSessionToken()
        onIdle()
      }
    }, CUSTOMER_SESSION_INACTIVITY_MS)
  }

  const events = ['mousedown', 'keydown', 'touchstart', 'scroll'] as const
  for (const e of events) {
    window.addEventListener(e, schedule, { passive: true })
  }
  schedule()

  return () => {
    if (timer) clearTimeout(timer)
    for (const e of events) {
      window.removeEventListener(e, schedule)
    }
  }
}

/** Limpa toda autenticação do cliente neste aparelho. */
export function clearCustomerAuth() {
  localStorage.removeItem('kicomanda_customer_id')
  localStorage.removeItem('kicomanda_customer_name')
  localStorage.removeItem('kicomanda_session_id')
  clearCustomerSessionToken()
}

/** Headers com a sessão autenticada para chamadas sensíveis (cartões/pagamento). */
export function authHeaders(extra?: Record<string, string>): Record<string, string> {
  const token = ensureActiveCustomerSession()
  return {
    ...(extra ?? {}),
    ...(token ? { 'x-customer-session': token } : {}),
  }
}

/** Cliente encerra visita ao restaurante (mantém login WhatsApp → hub). */
export function leaveRestaurantSession(router: AppRouterInstance, restaurantSlug?: string) {
  localStorage.removeItem('kicomanda_session_id')
  if (localStorage.getItem('kicomanda_customer_id')) {
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
