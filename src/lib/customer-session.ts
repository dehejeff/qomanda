import { createHmac, timingSafeEqual } from 'crypto'
import type { NextRequest, NextResponse } from 'next/server'
import {
  CUSTOMER_SESSION_ABSOLUTE_TTL_MS,
  CUSTOMER_SESSION_INACTIVITY_MS,
  CUSTOMER_SESSION_RENEWAL_HEADER,
} from '@/lib/customer-session-shared'

/**
 * Sessão autenticada do cliente, emitida APÓS verificação da senha de 6 dígitos.
 * Prova de identidade para cartões e pagamento salvo. Token HMAC assinado, sem estado no servidor.
 *
 * Regras (PCI-DSS 8.2.8):
 * - Expira em no máximo 24h desde a emissão (absoluteExp).
 * - Expira após 15 min de inatividade (lastActivity no payload).
 */

function secret(): string {
  const s =
    process.env.CUSTOMER_LOGIN_SECRET ??
    process.env.CPF_HASH_SALT ??
    process.env.CPF_ENCRYPTION_KEY
  if (!s) {
    throw new Error('CUSTOMER_LOGIN_SECRET, CPF_HASH_SALT ou CPF_ENCRYPTION_KEY não configurada.')
  }
  return s
}

type ParsedPayload = {
  customerId: string
  absoluteExp: number
  lastActivity: number | null
}

function signPayload(payload: string): string {
  const sig = createHmac('sha256', secret()).update(payload).digest('hex')
  return Buffer.from(`${payload}:${sig}`).toString('base64url')
}

function parsePayload(raw: string): ParsedPayload | null {
  const lastColon = raw.lastIndexOf(':')
  if (lastColon <= 0) return null
  const payload = raw.slice(0, lastColon)
  const sig = raw.slice(lastColon + 1)
  const expected = createHmac('sha256', secret()).update(payload).digest('hex')
  const a = Buffer.from(sig, 'hex')
  const b = Buffer.from(expected, 'hex')
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null

  const parts = payload.split(':')
  if (parts[0] !== 's' || parts.length < 3) return null

  const customerId = parts[1]
  const absoluteExp = Number(parts[2])
  if (!customerId || !Number.isFinite(absoluteExp)) return null

  if (parts.length === 3) {
    return { customerId, absoluteExp, lastActivity: null }
  }

  const lastActivity = Number(parts[3])
  if (!Number.isFinite(lastActivity)) return null
  return { customerId, absoluteExp, lastActivity }
}

function decodeToken(token: string): ParsedPayload | null {
  try {
    const raw = Buffer.from(token, 'base64url').toString('utf8')
    return parsePayload(raw)
  } catch {
    return null
  }
}

function isSessionTimely(parsed: ParsedPayload, now = Date.now()): boolean {
  if (now > parsed.absoluteExp) return false
  if (parsed.lastActivity === null) return true
  return now - parsed.lastActivity <= CUSTOMER_SESSION_INACTIVITY_MS
}

export function createCustomerSession(
  customerId: string,
  opts?: { absoluteExp?: number },
): string {
  const now = Date.now()
  const absoluteExp = opts?.absoluteExp ?? now + CUSTOMER_SESSION_ABSOLUTE_TTL_MS
  const payload = `s:${customerId}:${absoluteExp}:${now}`
  return signPayload(payload)
}

export function verifyCustomerSession(token: string | null | undefined): { customerId: string } | null {
  if (!token) return null
  const parsed = decodeToken(token)
  if (!parsed || !isSessionTimely(parsed)) return null
  return { customerId: parsed.customerId }
}

/** Renova lastActivity mantendo o absoluteExp original. */
export function refreshCustomerSessionToken(token: string): string | null {
  const parsed = decodeToken(token)
  if (!parsed || !isSessionTimely(parsed)) return null
  const now = Date.now()
  if (now >= parsed.absoluteExp) return null
  const payload = `s:${parsed.customerId}:${parsed.absoluteExp}:${now}`
  return signPayload(payload)
}

export function getCustomerSessionTokenFromRequest(req: NextRequest): string | null {
  const header = req.headers.get('x-customer-session') ?? ''
  const token = header.startsWith('Bearer ') ? header.slice(7) : header
  return token || null
}

export function authenticateCustomerSession(
  req: NextRequest,
  customerId: string,
): { ok: boolean; renewedToken?: string } {
  const token = getCustomerSessionTokenFromRequest(req)
  if (!token) return { ok: false }
  const session = verifyCustomerSession(token)
  if (!session || session.customerId !== customerId) return { ok: false }
  const renewedToken = refreshCustomerSessionToken(token) ?? undefined
  return { ok: true, renewedToken }
}

/** @deprecated prefer authenticateCustomerSession + applySessionRenewal */
export function requireCustomerSession(req: NextRequest, customerId: string): boolean {
  return authenticateCustomerSession(req, customerId).ok
}

export function applySessionRenewal(res: NextResponse, renewedToken?: string): NextResponse {
  if (renewedToken) {
    res.headers.set(CUSTOMER_SESSION_RENEWAL_HEADER, renewedToken)
  }
  return res
}
