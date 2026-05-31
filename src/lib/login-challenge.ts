import { createHmac, timingSafeEqual } from 'crypto'

const TTL_MS = 5 * 60 * 1000

function secret(): string {
  const s = process.env.CUSTOMER_LOGIN_SECRET ?? process.env.CPF_HASH_SALT
  if (!s) throw new Error('CUSTOMER_LOGIN_SECRET ou CPF_HASH_SALT não configurada.')
  return s
}

export function createLoginChallenge(customerId: string): string {
  const exp = Date.now() + TTL_MS
  const payload = `${customerId}:${exp}`
  const sig = createHmac('sha256', secret()).update(payload).digest('hex')
  return Buffer.from(`${payload}:${sig}`).toString('base64url')
}

export function verifyLoginChallenge(token: string): { customerId: string } | null {
  try {
    const raw = Buffer.from(token, 'base64url').toString('utf8')
    const lastColon = raw.lastIndexOf(':')
    if (lastColon <= 0) return null
    const payload = raw.slice(0, lastColon)
    const sig = raw.slice(lastColon + 1)
    const expected = createHmac('sha256', secret()).update(payload).digest('hex')
    const a = Buffer.from(sig, 'hex')
    const b = Buffer.from(expected, 'hex')
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null

    const [customerId, expStr] = payload.split(':')
    const exp = Number(expStr)
    if (!customerId || !Number.isFinite(exp) || Date.now() > exp) return null
    return { customerId }
  } catch {
    return null
  }
}
