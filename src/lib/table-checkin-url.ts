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

/**
 * Extrai rota interna `/{slug}?mesa=&t=` a partir do conteúdo lido no QR.
 * Retorna null se não for um check-in válido.
 */
export function parseCheckInTargetFromQr(rawValue: string): string | null {
  const raw = rawValue.trim()
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
    if (raw.startsWith('/') && raw.includes('mesa=') && (raw.includes('t=') || raw.includes('token='))) {
      const q = raw.indexOf('?')
      pathname = q >= 0 ? raw.slice(0, q) : raw
      search = q >= 0 ? raw.slice(q) : ''
    } else {
      return null
    }
  }

  const { mesa, token } = parseTableCheckInSearchParams(search.startsWith('?') ? search.slice(1) : search)
  if (!mesa || !token) return null

  const slug = pathname.split('/').filter(Boolean)[0]
  if (!slug || slug === 'scan' || slug === 'hub' || slug === 'login') return null

  const params = new URLSearchParams({ mesa, t: token })
  return `/${slug}?${params.toString()}`
}
