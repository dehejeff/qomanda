import { randomBytes, scryptSync, timingSafeEqual } from 'crypto'
import {
  CARD_PASSWORD_LENGTH,
  isValidCardPassword,
  isValidLoginPin,
  LOGIN_PIN_LENGTH,
  normalizeCardPassword,
  normalizeLoginPin,
} from '@/lib/customer-pin-shared'

export {
  isValidCardPassword,
  isValidLoginPin,
  isValidPin,
  normalizeCardPassword,
  normalizeLoginPin,
  normalizePin,
} from '@/lib/customer-pin-shared'

const KEY_LEN = 32
const SCRYPT_OPTS = { N: 16384, r: 8, p: 1, maxmem: 32 * 1024 * 1024 } as const

function hashSecret(digits: string): string {
  const salt = randomBytes(16).toString('hex')
  const hash = scryptSync(digits, salt, KEY_LEN, SCRYPT_OPTS).toString('hex')
  return `${salt}:${hash}`
}

export function hashLoginPin(pin: string): string {
  const digits = normalizeLoginPin(pin)
  if (!isValidLoginPin(digits)) throw new Error('PIN deve ter 4 dígitos.')
  return hashSecret(digits)
}

export function hashCardPassword(pin: string): string {
  const digits = normalizeCardPassword(pin)
  if (!isValidCardPassword(digits)) throw new Error('A senha deve ter 6 dígitos.')
  return hashSecret(digits)
}

/** Alias para fluxos de cartão (POST /api/customer/pin). */
export function hashPin(pin: string): string {
  return hashCardPassword(pin)
}

export function verifyPinSecret(
  pin: string,
  stored: string | null | undefined,
  length: typeof LOGIN_PIN_LENGTH | typeof CARD_PASSWORD_LENGTH,
): boolean {
  if (!stored) return false
  const [salt, expectedHex] = stored.split(':')
  if (!salt || !expectedHex) return false
  const digits = pin.replace(/\D/g, '').slice(0, length)
  if (digits.length !== length) return false
  try {
    const attempt = scryptSync(digits, salt, KEY_LEN, SCRYPT_OPTS)
    const expected = Buffer.from(expectedHex, 'hex')
    if (attempt.length !== expected.length) return false
    return timingSafeEqual(attempt, expected)
  } catch {
    return false
  }
}

export function verifyPin(pin: string, stored: string | null | undefined, length: 4 | 6): boolean {
  return verifyPinSecret(pin, stored, length)
}
