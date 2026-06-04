/** Monta URL de check-in com token da mesa (segurança do QR). */
export function buildTableCheckInUrl(
  baseUrl: string,
  slug: string,
  tableNumber: string,
  checkInToken: string,
): string {
  const base = baseUrl.replace(/\/$/, '')
  const params = new URLSearchParams({
    mesa: tableNumber,
    t: checkInToken,
  })
  return `${base}/${slug}?${params.toString()}`
}

export function parseTableCheckInSearchParams(search: string): { mesa: string | null; token: string | null } {
  const params = new URLSearchParams(search)
  return {
    mesa: params.get('mesa'),
    token: params.get('t') ?? params.get('token'),
  }
}

export type TableCheckInQuery = { mesa: string | null; token: string | null }

/** Lê mesa/token da URL (router + window.location — câmera nativa no mobile). */
export function readTableCheckInQuery(searchParams?: Pick<URLSearchParams, 'get'> | null): TableCheckInQuery {
  const fromRouter = {
    mesa: searchParams?.get('mesa') ?? null,
    token: searchParams?.get('t') ?? searchParams?.get('token') ?? null,
  }
  if (typeof window === 'undefined') return fromRouter

  const qs = new URLSearchParams(window.location.search)
  return {
    mesa: fromRouter.mesa ?? qs.get('mesa'),
    token: fromRouter.token ?? qs.get('t') ?? qs.get('token'),
  }
}

const PENDING_CHECKIN_KEY = 'qomanda_pending_table_checkin'
const PENDING_TTL_MS = 30 * 60 * 1000

export function stashPendingTableCheckIn(slug: string, mesa: string, token: string) {
  if (typeof sessionStorage === 'undefined') return
  sessionStorage.setItem(
    PENDING_CHECKIN_KEY,
    JSON.stringify({ slug, mesa, t: token, at: Date.now() }),
  )
}

export function readPendingTableCheckIn(slug: string): TableCheckInQuery | null {
  if (typeof sessionStorage === 'undefined') return null
  try {
    const raw = sessionStorage.getItem(PENDING_CHECKIN_KEY)
    if (!raw) return null
    const data = JSON.parse(raw) as { slug?: string; mesa?: string; t?: string; at?: number }
    if (data.slug !== slug || !data.mesa || !data.t) return null
    if (typeof data.at === 'number' && Date.now() - data.at > PENDING_TTL_MS) {
      sessionStorage.removeItem(PENDING_CHECKIN_KEY)
      return null
    }
    return { mesa: data.mesa, token: data.t }
  } catch {
    return null
  }
}

export function clearPendingTableCheckIn() {
  if (typeof sessionStorage === 'undefined') return
  sessionStorage.removeItem(PENDING_CHECKIN_KEY)
}

function cleanQrPayload(rawValue: string): string {
  return rawValue.replace(/[\u200B-\u200D\uFEFF]/g, '').trim()
}

/** URL absoluta para navegação (PWA/iOS exige href completo + toque do usuário). */
export function resolveCheckInAbsoluteUrl(relativePath: string, origin?: string): string {
  const base = (origin ?? (typeof window !== 'undefined' ? window.location.origin : '')).replace(/\/$/, '')
  return `${base}${relativePath.startsWith('/') ? relativePath : `/${relativePath}`}`
}

export function isMobileSafariLike(): boolean {
  if (typeof navigator === 'undefined') return false
  const ua = navigator.userAgent
  const iOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  const webkit = /WebKit/.test(ua) && !/CriOS|FxiOS|EdgiOS/.test(ua)
  return iOS && webkit
}

/** Celular/tablet — navegação automática após câmera costuma ser bloqueada (iOS/Android/PWA). */
export function isMobileClient(): boolean {
  if (typeof navigator === 'undefined') return false
  const ua = navigator.userAgent
  if (/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua)) return true
  return navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1
}

/**
 * Extrai rota interna `/{slug}?mesa=&t=` a partir do conteúdo lido no QR.
 * Aceita QR legado só com `mesa` (sem token) — abre a página do restaurante.
 */
export function parseCheckInTargetFromQr(rawValue: string): string | null {
  const raw = cleanQrPayload(rawValue)
  if (!raw) return null

  let pathname = ''
  let search = ''

  try {
    const url = raw.includes('://')
      ? new URL(raw)
      : new URL(raw.startsWith('/') ? raw : `/${raw}`, 'https://qomanda.local')
    pathname = url.pathname.replace(/\/$/, '') || url.pathname
    search = url.search
  } catch {
    if (raw.includes('mesa=')) {
      const q = raw.indexOf('?')
      if (raw.startsWith('/')) {
        pathname = q >= 0 ? raw.slice(0, q) : raw
        search = q >= 0 ? raw.slice(q) : ''
      } else {
        pathname = '/'
        search = raw.startsWith('?') ? raw : `?${raw}`
      }
    } else {
      return null
    }
  }

  const { mesa, token } = parseTableCheckInSearchParams(search.startsWith('?') ? search.slice(1) : search)
  if (!mesa) return null

  const segments = pathname.split('/').filter(Boolean)
  const slug = segments.find(s => !['scan', 'hub', 'login', 'cadastro', 'cliente'].includes(s))
  if (!slug) return null

  const params = new URLSearchParams({ mesa })
  if (token) params.set('t', token)
  return `/${slug}?${params.toString()}`
}

export type ParsedCheckInPath = {
  slug: string
  mesa: string
  token: string | null
}

export function parseCheckInPath(relativePath: string): ParsedCheckInPath | null {
  try {
    const url = new URL(relativePath.startsWith('/') ? relativePath : `/${relativePath}`, 'https://qomanda.local')
    const slug = url.pathname.split('/').filter(Boolean)[0]
    const mesa = url.searchParams.get('mesa')
    const token = url.searchParams.get('t') ?? url.searchParams.get('token')
    if (!slug || !mesa) return null
    return { slug, mesa, token }
  } catch {
    return null
  }
}

/** URL interna de redirect (302) — mais confiável que location.assign em PWA. */
export function buildCheckInRedirectApiUrl(parsed: ParsedCheckInPath, origin?: string): string | null {
  if (!parsed.token) return null
  const base = (origin ?? (typeof window !== 'undefined' ? window.location.origin : '')).replace(/\/$/, '')
  const params = new URLSearchParams({
    slug: parsed.slug,
    mesa: parsed.mesa,
    t: parsed.token,
  })
  return `${base}/api/checkin/redirect?${params.toString()}`
}
