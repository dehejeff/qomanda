export const LOGIN_PIN_LENGTH = 4
export const CARD_PASSWORD_LENGTH = 6

/** PIN opcional de login remoto (sem cartão salvo). */
export function normalizeLoginPin(pin: string): string {
  return pin.replace(/\D/g, '').slice(0, LOGIN_PIN_LENGTH)
}

export function isValidLoginPin(pin: string): boolean {
  return /^\d{4}$/.test(normalizeLoginPin(pin))
}

/** Senha obrigatória quando há cartão salvo (hub + cartões). */
export function normalizeCardPassword(pin: string): string {
  return pin.replace(/\D/g, '').slice(0, CARD_PASSWORD_LENGTH)
}

export function isValidCardPassword(pin: string): boolean {
  return /^\d{6}$/.test(normalizeCardPassword(pin))
}

/** Alias usado em fluxos de cartão / senha de 6 dígitos. */
export const normalizePin = normalizeCardPassword
export const isValidPin = isValidCardPassword
