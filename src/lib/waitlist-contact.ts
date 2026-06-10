import { isValidWhatsApp, normalizeWhatsApp } from '@/lib/whatsapp-normalize'

export type WaitlistContactPayload = {
  whatsapp?: string | null
  secondaryName?: string | null
  secondaryWhatsapp?: string | null
}

export type ParsedWaitlistContacts = {
  whatsapp: string
  secondaryName: string | null
  whatsappSecondary: string | null
}

/** Normaliza e valida telefones da fila (principal obrigatório). */
export function parseWaitlistContacts(input: WaitlistContactPayload): ParsedWaitlistContacts | { error: string } {
  const whatsappRaw = String(input.whatsapp ?? '').trim()
  if (!whatsappRaw) return { error: 'Informe o WhatsApp para receber o aviso quando a mesa liberar.' }
  if (!isValidWhatsApp(whatsappRaw)) {
    return { error: 'WhatsApp inválido. Use DDD + número, ex: (11) 98765-4321.' }
  }

  const whatsapp = normalizeWhatsApp(whatsappRaw).e164
  const secondaryRaw = String(input.secondaryWhatsapp ?? '').trim()
  const secondaryName = String(input.secondaryName ?? '').trim() || null

  if (!secondaryRaw) {
    return { whatsapp, secondaryName: null, whatsappSecondary: null }
  }

  if (!isValidWhatsApp(secondaryRaw)) {
    return { error: 'WhatsApp da segunda pessoa inválido.' }
  }

  const whatsappSecondary = normalizeWhatsApp(secondaryRaw).e164
  if (whatsappSecondary === whatsapp) {
    return { error: 'O segundo WhatsApp deve ser diferente do principal.' }
  }

  return { whatsapp, secondaryName, whatsappSecondary }
}
