/** Marca e domínios oficiais KiComanda. */
export const BRAND_NAME = 'KiComanda'
export const BRAND_PAY = 'KiComanda Pay'

export const APP_DOMAIN = 'kicomanda.app'
export const SITE_DOMAIN = 'kicomanda.com.br'

export const CONTACT_EMAIL = `contato@${SITE_DOMAIN}`
export const NOREPLY_EMAIL = `noreply@${SITE_DOMAIN}`
export const CLIENT_EMAIL_DOMAIN = `cliente.${APP_DOMAIN}`

export function appUrl(path = ''): string {
  const base = (process.env.NEXT_PUBLIC_APP_URL ?? `https://${APP_DOMAIN}`).replace(/\/$/, '')
  if (!path) return base
  return `${base}${path.startsWith('/') ? path : `/${path}`}`
}

export function publicRestaurantPath(slug: string, suffix = ''): string {
  return `${APP_DOMAIN}/${slug}${suffix}`
}
