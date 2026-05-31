/** Apenas dígitos. */
export function digitsOnly(value: string): string {
  return value.replace(/\D/g, '')
}

/**
 * Formato canônico BR para celular: DDD (2) + 9 dígitos = 11 caracteres.
 * Remove código do país (55) e corrige celular antigo de 8 dígitos.
 */
export function normalizeBrazilWhatsApp(input: string): string {
  let d = digitsOnly(input)

  if (d.startsWith('55') && d.length >= 12) {
    d = d.slice(2)
  }

  // DDD + 8 dígitos (celular legado) → insere 9 após o DDD
  if (d.length === 10 && /^[1-9]{2}[6-9]/.test(d)) {
    d = `${d.slice(0, 2)}9${d.slice(2)}`
  }

  return d
}

/** Variantes para lookup quando registros antigos usam formatos diferentes. */
export function whatsappLookupVariants(input: string): string[] {
  const raw = digitsOnly(input)
  const canonical = normalizeBrazilWhatsApp(input)
  const variants = new Set<string>()

  if (raw) variants.add(raw)
  if (canonical) variants.add(canonical)

  if (canonical.length === 11) {
    variants.add(`55${canonical}`)
    if (canonical[2] === '9') {
      const legacy = canonical.slice(0, 2) + canonical.slice(3)
      variants.add(legacy)
      variants.add(`55${legacy}`)
    }
  }

  if (raw.startsWith('55') && raw.length > 2) {
    variants.add(raw.slice(2))
  }

  return [...variants].filter(v => v.length >= 10)
}

export function isValidBrazilWhatsApp(input: string): boolean {
  const n = normalizeBrazilWhatsApp(input)
  return n.length === 11 && /^[1-9]{2}9[0-9]{8}$/.test(n)
}
