import { createHmac, timingSafeEqual } from 'crypto'
import type { NextRequest } from 'next/server'

/**
 * Sessão autenticada do cliente, emitida APÓS verificação da senha de 6 dígitos.
 * É a prova de identidade exigida para ações sensíveis (cartões e pagamento
 * com cartão salvo). Token HMAC assinado, sem estado no servidor.
 */

const TTL_MS = 30 * 24 * 60 * 60 * 1000 // 30 dias

function secret(): string {
  const s = process.env.CUSTOMER_LOGIN_SECRET ?? process.env.CPF_HASH_SALT
  if (!s) throw new Error('CUSTOMER_LOGIN_SECRET ou CPF_HASH_SALT não configurada.')
  return s
}

export function createCustomerSession(customerId: string): string {
  const exp = Date.now() + TTL_MS
  const payload = `s:${customerId}:${exp}`
  const sig = createHmac('sha256', secret()).update(payload).digest('hex')
  return Buffer.from(`${payload}:${sig}`).toString('base64url')
}

export function verifyCustomerSession(token: string | null | undefined): { customerId: string } | null {
  if (!token) return null
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

    const [, customerId, expStr] = payload.split(':')
    const exp = Number(expStr)
    if (!customerId || !Number.isFinite(exp) || Date.now() > exp) return null
    return { customerId }
  } catch {
    return null
  }
}

/** Lê o token do header e valida que pertence ao customerId informado. */
export function requireCustomerSession(req: NextRequest, customerId: string): boolean {
  const header = req.headers.get('x-customer-session') ?? ''
  const token = header.startsWith('Bearer ') ? header.slice(7) : header
  const session = verifyCustomerSession(token)
  return Boolean(session && session.customerId === customerId)
}
