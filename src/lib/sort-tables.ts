/** Ordenação natural: 1, 2, … 10 (não 1, 10, 2). Suporta prefixos como B1, B2. */
export function compareTableNumbers(a: string, b: string): number {
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' })
}

export function sortTablesByNumber<T extends { number: string }>(tables: T[]): T[] {
  return [...tables].sort((a, b) => compareTableNumbers(a.number, b.number))
}

/** Próximo número sequencial (ignora mesas alfanuméricas como B1). */
export function nextTableNumber(tables: { number: string }[]): string {
  let max = 0
  for (const t of tables) {
    if (/^\d+$/.test(t.number.trim())) {
      max = Math.max(max, parseInt(t.number, 10))
    }
  }
  return String(max + 1)
}
