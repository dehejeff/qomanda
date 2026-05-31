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
    token: params.get('t'),
  }
}
