import { randomBytes, scryptSync, timingSafeEqual } from 'crypto'
import { isValidPin, normalizePin } from '@/lib/customer-pin-shared'

export { isValidPin, normalizePin } from '@/lib/customer-pin-shared'

const KEY_LEN = 32
const SCRYPT_OPTS = { N: 16384, r: 8, p: 1, maxmem: 32 * 1024 * 1024 } as const

export function hashPin(pin: string): string {
  const digits = normalizePin(pin)
  if (!isValidPin(digits)) throw new Error('A senha deve ter 6 dígitos.')
  const salt = randomBytes(16).toString('hex')
  const hash = scryptSync(digits, salt, KEY_LEN, SCRYPT_OPTS).toString('hex')
  return `${salt}:${hash}`
}

export function verifyPin(pin: string, stored: string | null | undefined): boolean {
  if (!stored) return false
  const [salt, expectedHex] = stored.split(':')
  if (!salt || !expectedHex) return false
  const digits = normalizePin(pin)
  if (!isValidPin(digits)) return false
  try {
    const attempt = scryptSync(digits, salt, KEY_LEN, SCRYPT_OPTS)
    const expected = Buffer.from(expectedHex, 'hex')
    if (attempt.length !== expected.length) return false
    return timingSafeEqual(attempt, expected)
  } catch {
    return false
  }
}
