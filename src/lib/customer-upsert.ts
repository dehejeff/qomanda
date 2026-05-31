import type { SupabaseClient } from '@supabase/supabase-js'
import { hashCPF, encryptCPF } from '@/lib/crypto'
import { whatsappForStorage } from '@/lib/customer-lookup'
import { hashLoginPin } from '@/lib/customer-pin'
import { isValidLoginPin } from '@/lib/customer-pin-shared'
import { getCustomerPinHash, isPinColumnMissing } from '@/lib/customer-pin-server'

export type UpsertCustomerInput = {
  firstName: string
  lastName: string
  whatsapp: string
  documentType?: 'cpf' | 'passport' | null
  cpf?: string | null
  passport?: string | null
  /** PIN de 4 dígitos — gravado se o cliente ainda não tiver PIN. */
  pin?: string | null
}

/**
 * Define PIN de login (4 dígitos) se o cliente ainda não tiver.
 */
export async function ensureCustomerLoginPin(
  supabase: SupabaseClient,
  customerId: string,
  pin: string,
): Promise<void> {
  if (!isValidLoginPin(pin)) {
    throw new Error('PIN deve ter 4 dígitos.')
  }

  const existing = await getCustomerPinHash(supabase, customerId)
  if (existing) return

  const { error } = await supabase
    .from('customers')
    .update({ pin_hash: hashLoginPin(pin) })
    .eq('id', customerId)

  if (error) {
    if (isPinColumnMissing(error)) {
      throw new Error('Recurso de PIN indisponível no servidor.')
    }
    throw new Error('Erro ao salvar PIN.')
  }
}

/**
 * Cria ou atualiza um cliente na tabela customers (identidade = WhatsApp).
 */
export async function upsertCustomerRecord(
  supabase: SupabaseClient,
  input: UpsertCustomerInput,
): Promise<string> {
  const { firstName, lastName, whatsapp: rawWhatsapp, documentType, cpf, passport, pin } = input
  const whatsapp = whatsappForStorage(rawWhatsapp)
  let customerId: string | null = null

  let cpfHash: string | null = null
  let cpfEncrypted: string | null = null

  if (documentType === 'cpf' && cpf && cpf.length === 11) {
    try {
      cpfHash = hashCPF(cpf)
      cpfEncrypted = encryptCPF(cpf)
    } catch (cryptoErr) {
      console.warn('[CustomerUpsert] Falha na criptografia do CPF:', cryptoErr)
    }

    if (cpfHash) {
      try {
        const { data: byCpf } = await supabase
          .from('customers')
          .select('id')
          .eq('cpf_hash', cpfHash)
          .maybeSingle()

        if (byCpf) {
          await supabase
            .from('customers')
            .update({ first_name: firstName, last_name: lastName, whatsapp })
            .eq('id', byCpf.id)
          customerId = byCpf.id
        }
      } catch (lookupErr) {
        console.warn('[CustomerUpsert] Busca por CPF falhou:', lookupErr)
      }
    }
  }

  if (!customerId) {
    const payload: Record<string, unknown> = {
      first_name: firstName,
      last_name: lastName,
      whatsapp,
    }

    if (cpfHash && cpfEncrypted) {
      payload.document_type = 'cpf'
      payload.cpf_hash = cpfHash
      payload.cpf_encrypted = cpfEncrypted
    } else if (documentType === 'cpf' && cpf) {
      payload.document_type = 'cpf'
    }

    if (documentType === 'passport' && passport) {
      payload.document_type = 'passport'
      payload.passport = passport
    }

    const { data: customer, error: upsertErr } = await supabase
      .from('customers')
      .upsert(payload, { onConflict: 'whatsapp' })
      .select('id')
      .single()

    if (upsertErr) {
      const { data: fallback, error: fallbackErr } = await supabase
        .from('customers')
        .upsert({ first_name: firstName, last_name: lastName, whatsapp }, { onConflict: 'whatsapp' })
        .select('id')
        .single()

      if (fallbackErr || !fallback) {
        throw new Error('Erro ao salvar dados do cliente.')
      }
      customerId = fallback.id
    } else {
      customerId = customer?.id ?? null
    }
  }

  if (!customerId) {
    throw new Error('Erro ao identificar cliente.')
  }

  if (pin) {
    await ensureCustomerLoginPin(supabase, customerId, pin)
  }

  return customerId
}
