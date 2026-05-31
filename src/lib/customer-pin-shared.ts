// Senha de acesso do cliente: 6 dígitos numéricos.
export function normalizePin(pin: string): string {
  return pin.replace(/\D/g, '').slice(0, 6)
}

export function isValidPin(pin: string): boolean {
  return /^\d{6}$/.test(normalizePin(pin))
}
