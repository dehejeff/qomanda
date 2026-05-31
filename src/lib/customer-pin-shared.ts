export function normalizePin(pin: string): string {
  return pin.replace(/\D/g, '').slice(0, 4)
}

export function isValidPin(pin: string): boolean {
  return /^\d{4}$/.test(normalizePin(pin))
}
