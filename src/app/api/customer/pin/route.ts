import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  hashCardPassword,
  hashLoginPin,
  verifyPinSecret,
} from '@/lib/customer-pin'
import {
  isValidCardPassword,
  isValidLoginPin,
} from '@/lib/customer-pin-shared'
import {
  customerHasSavedCards,
  getCustomerPinHash,
  isPinColumnMissing,
} from '@/lib/customer-pin-server'
import { createCustomerSession } from '@/lib/customer-session'

const PIN_MIGRATION_HINT =
  'Recurso de PIN indisponível. Execute supabase/migrate-customer-pin.sql no Supabase SQL Editor.'

/**
 * GET /api/customer/pin?customer=UUID
 */
export async function GET(req: NextRequest) {
  const customerId = req.nextUrl.searchParams.get('customer')
  if (!customerId) {
    return NextResponse.json({ error: 'customer obrigatório.' }, { status: 400 })
  }

  const supabase = createAdminClient()
  const { data: customer } = await supabase
    .from('customers')
    .select('id')
    .eq('id', customerId)
    .single()

  if (!customer) {
    return NextResponse.json({ error: 'Cliente não encontrado.' }, { status: 404 })
  }

  const pinHash = await getCustomerPinHash(supabase, customerId)
  const hasSavedCards = await customerHasSavedCards(supabase, customerId)
  return NextResponse.json({
    hasPin: Boolean(pinHash),
    hasSavedCards,
    pinLength: hasSavedCards ? 6 : 4,
  })
}

/**
 * POST /api/customer/pin — criar/alterar PIN (4) ou senha (6) / verificar
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as {
      customerId?: string
      pin?: string
      currentPin?: string
      mode?: 'set' | 'verify'
      pinKind?: 'login' | 'card'
    }
    const { customerId, pin, currentPin, mode, pinKind } = body

    if (!customerId || !pin) {
      return NextResponse.json({ error: 'customerId e senha são obrigatórios.' }, { status: 400 })
    }

    const supabase = createAdminClient()
    const { data: customer } = await supabase
      .from('customers')
      .select('id')
      .eq('id', customerId)
      .single()

    if (!customer) {
      return NextResponse.json({ error: 'Cliente não encontrado.' }, { status: 404 })
    }

    const hasSavedCards = await customerHasSavedCards(supabase, customerId)
    const useCardPassword = pinKind === 'card' || hasSavedCards
    const pinLength = useCardPassword ? 6 : 4

    if (useCardPassword && !isValidCardPassword(pin)) {
      return NextResponse.json({ error: 'A senha deve ter 6 dígitos.' }, { status: 400 })
    }
    if (!useCardPassword && !isValidLoginPin(pin)) {
      return NextResponse.json({ error: 'PIN deve ter 4 dígitos.' }, { status: 400 })
    }

    const existingPin = await getCustomerPinHash(supabase, customerId)

    if (mode === 'verify') {
      if (!existingPin || !verifyPinSecret(pin, existingPin, pinLength)) {
        return NextResponse.json({ error: 'Senha incorreta.' }, { status: 401 })
      }
      return NextResponse.json({
        success: true,
        hasPin: true,
        ...(useCardPassword ? { sessionToken: createCustomerSession(customerId) } : {}),
      })
    }

    if (existingPin) {
      const currentLength = hasSavedCards ? 6 : 4
      if (!currentPin || !verifyPinSecret(currentPin, existingPin, currentLength)) {
        return NextResponse.json({ error: 'Senha atual incorreta.' }, { status: 401 })
      }
    }

    const pinHash = useCardPassword ? hashCardPassword(pin) : hashLoginPin(pin)
    const { error } = await supabase
      .from('customers')
      .update({ pin_hash: pinHash })
      .eq('id', customerId)

    if (error) {
      if (isPinColumnMissing(error)) {
        return NextResponse.json({ error: PIN_MIGRATION_HINT }, { status: 503 })
      }
      return NextResponse.json({ error: 'Erro ao salvar senha.' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      hasPin: true,
      ...(useCardPassword ? { sessionToken: createCustomerSession(customerId) } : {}),
    })
  } catch (err) {
    console.error('[Customer PIN POST Error]', err)
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const body = await req.json() as { customerId?: string; pin?: string }
    const { customerId, pin } = body

    if (!customerId || !pin) {
      return NextResponse.json({ error: 'customerId e pin são obrigatórios.' }, { status: 400 })
    }

    const supabase = createAdminClient()
    const hasSavedCards = await customerHasSavedCards(supabase, customerId)
    if (hasSavedCards) {
      return NextResponse.json({
        error: 'Remova seus cartões antes de excluir a senha de acesso.',
      }, { status: 400 })
    }

    const existingPin = await getCustomerPinHash(supabase, customerId)

    if (!existingPin) {
      return NextResponse.json({ success: true, hasPin: false })
    }

    if (!verifyPinSecret(pin, existingPin, 4)) {
      return NextResponse.json({ error: 'PIN incorreto.' }, { status: 401 })
    }

    const { error } = await supabase
      .from('customers')
      .update({ pin_hash: null })
      .eq('id', customerId)

    if (error) {
      if (isPinColumnMissing(error)) {
        return NextResponse.json({ error: PIN_MIGRATION_HINT }, { status: 503 })
      }
      return NextResponse.json({ error: 'Erro ao remover PIN.' }, { status: 500 })
    }

    return NextResponse.json({ success: true, hasPin: false })
  } catch (err) {
    console.error('[Customer PIN DELETE Error]', err)
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 })
  }
}
