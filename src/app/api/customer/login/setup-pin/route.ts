import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { findCustomerActiveSession } from '@/lib/customer-auth-server'
import { verifyLoginChallenge } from '@/lib/login-challenge'
import { hashLoginPin } from '@/lib/customer-pin'
import { isValidLoginPin } from '@/lib/customer-pin-shared'
import { customerHasSavedCards, getCustomerPinHash, isPinColumnMissing } from '@/lib/customer-pin-server'
import type { CustomerAuthPayload } from '@/lib/customer-login-types'

/**
 * POST /api/customer/login/setup-pin
 * Conta legada sem PIN: cria PIN de 4 dígitos após validar WhatsApp (challenge).
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as { challengeToken?: string; pin?: string; pinConfirm?: string }
    const { challengeToken, pin, pinConfirm } = body

    if (!challengeToken || !pin || !pinConfirm) {
      return NextResponse.json({ error: 'Preencha o PIN e a confirmação.' }, { status: 400 })
    }

    if (!isValidLoginPin(pin)) {
      return NextResponse.json({ error: 'O PIN deve ter 4 dígitos.' }, { status: 400 })
    }

    if (pin !== pinConfirm) {
      return NextResponse.json({ error: 'A confirmação do PIN não confere.' }, { status: 400 })
    }

    const challenge = verifyLoginChallenge(challengeToken)
    if (!challenge?.setup) {
      return NextResponse.json({ error: 'Sessão expirada. Digite o WhatsApp novamente.' }, { status: 401 })
    }

    const supabase = createAdminClient()
    const { data: customer } = await supabase
      .from('customers')
      .select('id, first_name, last_name')
      .eq('id', challenge.customerId)
      .single()

    if (!customer) {
      return NextResponse.json({ error: 'Cliente não encontrado.' }, { status: 404 })
    }

    const hasSavedCards = await customerHasSavedCards(supabase, customer.id)
    if (hasSavedCards) {
      return NextResponse.json({
        error: 'Esta conta usa senha de 6 dígitos. Entre com sua senha de cartão.',
      }, { status: 400 })
    }

    const existingPin = await getCustomerPinHash(supabase, customer.id)
    if (existingPin) {
      return NextResponse.json({
        error: 'PIN já cadastrado. Digite seu PIN para entrar.',
      }, { status: 409 })
    }

    const { error: updateError } = await supabase
      .from('customers')
      .update({ pin_hash: hashLoginPin(pin) })
      .eq('id', customer.id)

    if (updateError) {
      if (isPinColumnMissing(updateError)) {
        return NextResponse.json({ error: 'Recurso de PIN indisponível no servidor.' }, { status: 503 })
      }
      return NextResponse.json({ error: 'Erro ao salvar PIN.' }, { status: 500 })
    }

    const activeSession = await findCustomerActiveSession(supabase, customer.id)

    return NextResponse.json({
      customerId: customer.id,
      firstName: customer.first_name,
      lastName: customer.last_name,
      activeSession,
    } satisfies CustomerAuthPayload)
  } catch (err) {
    console.error('[Customer Setup PIN Error]', err)
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 })
  }
}
