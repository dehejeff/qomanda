import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { upsertCustomerRecord } from '@/lib/customer-upsert'

export type CustomerRegisterRequest = {
  firstName: string
  lastName: string
  whatsapp: string
  documentType?: 'cpf' | 'passport' | null
  cpf?: string | null
  passport?: string | null
}

export type CustomerRegisterResponse = {
  customerId: string
  firstName: string
  lastName: string
}

/**
 * POST /api/customer/register
 * Cadastro global do cliente (sem check-in em restaurante).
 */
export async function POST(req: NextRequest) {
  try {
    const body: CustomerRegisterRequest = await req.json()
    const { firstName, lastName, whatsapp, documentType, cpf, passport } = body

    if (!firstName?.trim() || !lastName?.trim() || !whatsapp) {
      return NextResponse.json({ error: 'Nome, sobrenome e WhatsApp são obrigatórios.' }, { status: 400 })
    }

    const phone = whatsapp.replace(/\D/g, '')
    if (phone.length < 10) {
      return NextResponse.json({ error: 'Informe um WhatsApp válido.' }, { status: 400 })
    }

    const supabase = createAdminClient()
    const customerId = await upsertCustomerRecord(supabase, {
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      whatsapp: phone,
      documentType,
      cpf: cpf?.replace(/\D/g, '') || null,
      passport: passport?.trim() || null,
    })

    return NextResponse.json({
      customerId,
      firstName: firstName.trim(),
      lastName: lastName.trim(),
    } satisfies CustomerRegisterResponse)
  } catch (err) {
    console.error('[Customer Register Error]', err)
    const msg = err instanceof Error ? err.message : 'Erro interno.'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
