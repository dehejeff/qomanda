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
