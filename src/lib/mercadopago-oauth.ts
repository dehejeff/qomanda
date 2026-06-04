import { createHmac, randomBytes, timingSafeEqual } from 'crypto'

/**
 * Mercado Pago OAuth (marketplace) — onboarding da conta do restaurante.
 * Doc: https://www.mercadopago.com.br/developers/pt/docs/security/oauth/introduction
 *
 * Sem MERCADO_PAGO_CLIENT_ID/SECRET o OAuth fica indisponível e o restaurante
 * usa o token manual (fallback no painel).
 */

const MP_AUTH_BASE = 'https://auth.mercadopago.com.br/authorization'
const MP_TOKEN_URL = 'https://api.mercadopago.com/oauth/token'
const STATE_TTL_MS = 10 * 60 * 1000 // 10 min

export function isMercadoPagoOAuthConfigured(): boolean {
  return Boolean(process.env.MERCADO_PAGO_CLIENT_ID && process.env.MERCADO_PAGO_CLIENT_SECRET)
}

export function mercadoPagoRedirectUri(): string {
  const base = (process.env.NEXT_PUBLIC_APP_URL ?? process.env.APP_URL ?? 'http://localhost:3000').replace(/\/$/, '')
  return `${base}/api/dashboard/gateway/mercadopago/callback`
}

function stateSecret(): Buffer {
  // Reutiliza a chave de criptografia da plataforma para assinar o state.
  const key = process.env.CPF_ENCRYPTION_KEY
  if (!key) throw new Error('CPF_ENCRYPTION_KEY ausente para assinar o state OAuth.')
  return Buffer.from(key, key.length === 64 ? 'hex' : 'utf8')
}

/** Assina `restaurantId` num state opaco (HMAC + expiração) — protege contra CSRF. */
export function signOAuthState(restaurantId: string): string {
  const payload = `${restaurantId}.${Date.now()}.${randomBytes(8).toString('hex')}`
  const sig = createHmac('sha256', stateSecret()).update(payload).digest('hex')
  return Buffer.from(`${payload}.${sig}`).toString('base64url')
}

export function verifyOAuthState(state: string): { restaurantId: string } | null {
  try {
    const decoded = Buffer.from(state, 'base64url').toString('utf8')
    const parts = decoded.split('.')
    if (parts.length !== 4) return null
    const [restaurantId, ts, nonce, sig] = parts
    const expected = createHmac('sha256', stateSecret()).update(`${restaurantId}.${ts}.${nonce}`).digest('hex')
    const a = Buffer.from(sig, 'hex')
    const b = Buffer.from(expected, 'hex')
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null
    if (Date.now() - Number(ts) > STATE_TTL_MS) return null
    return { restaurantId }
  } catch {
    return null
  }
}

export function buildMercadoPagoAuthorizeUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: process.env.MERCADO_PAGO_CLIENT_ID as string,
    response_type: 'code',
    platform_id: 'mp',
    state,
    redirect_uri: mercadoPagoRedirectUri(),
  })
  return `${MP_AUTH_BASE}?${params.toString()}`
}

export type MercadoPagoTokenResponse = {
  access_token: string
  refresh_token: string
  public_key: string | null
  user_id: number
  expires_in: number
  scope?: string
}

async function postToken(body: Record<string, string>): Promise<MercadoPagoTokenResponse> {
  const res = await fetch(MP_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(body),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    const msg = data?.message ?? data?.error_description ?? data?.error ?? 'Erro na troca de token Mercado Pago.'
    throw new Error(typeof msg === 'string' ? msg : 'Erro na troca de token Mercado Pago.')
  }
  return {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    public_key: data.public_key ?? null,
    user_id: data.user_id,
    expires_in: Number(data.expires_in ?? 0),
    scope: data.scope,
  }
}

/** Troca o `code` do callback por access/refresh token. */
export function exchangeMercadoPagoCode(code: string): Promise<MercadoPagoTokenResponse> {
  return postToken({
    grant_type: 'authorization_code',
    client_id: process.env.MERCADO_PAGO_CLIENT_ID as string,
    client_secret: process.env.MERCADO_PAGO_CLIENT_SECRET as string,
    code,
    redirect_uri: mercadoPagoRedirectUri(),
  })
}

/** Renova o access token usando o refresh token. */
export function refreshMercadoPagoToken(refreshToken: string): Promise<MercadoPagoTokenResponse> {
  return postToken({
    grant_type: 'refresh_token',
    client_id: process.env.MERCADO_PAGO_CLIENT_ID as string,
    client_secret: process.env.MERCADO_PAGO_CLIENT_SECRET as string,
    refresh_token: refreshToken,
  })
}
