/** Principais bancos para seleção no cadastro de repasse. */
export const BRAZIL_BANKS = [
  { code: '001', name: 'Banco do Brasil' },
  { code: '033', name: 'Santander' },
  { code: '104', name: 'Caixa Econômica' },
  { code: '237', name: 'Bradesco' },
  { code: '341', name: 'Itaú' },
  { code: '260', name: 'Nubank' },
  { code: '077', name: 'Inter' },
  { code: '336', name: 'C6 Bank' },
  { code: '422', name: 'Safra' },
  { code: '748', name: 'Sicredi' },
  { code: '756', name: 'Sicoob' },
] as const

export function bankLabel(code: string, name: string | null) {
  const found = BRAZIL_BANKS.find(b => b.code === code)
  return found?.name ?? name ?? `Banco ${code}`
}

export function maskBankAccount(account: string, digit: string | null) {
  const tail = account.slice(-4)
  return digit ? `•••• ${tail}-${digit}` : `•••• ${tail}`
}
