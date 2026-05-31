import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { hashPin, verifyPin, isValidPin } from '@/lib/customer-pin'
import { getCustomerPinHash, isPinColumnMissing } from '@/lib/customer-pin-server'
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
  return NextResponse.json({ hasPin: Boolean(pinHash) })
}

/**
 * POST /api/customer/pin — criar ou alterar PIN
 * DELETE /api/customer/pin — remover PIN (body: customerId, pin)
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as { customerId?: string; pin?: string; currentPin?: string; mode?: 'set' | 'verify' }
    const { customerId, pin, currentPin, mode } = body

    if (!customerId || !pin) {
      return NextResponse.json({ error: 'customerId e senha são obrigatórios.' }, { status: 400 })
    }

    if (!isValidPin(pin)) {
      return NextResponse.json({ error: 'A senha deve ter 6 dígitos.' }, { status: 400 })
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

    const existingPin = await getCustomerPinHash(supabase, customerId)

    // Modo verificação: confere a senha existente e emite sessão (não altera o hash).
    if (mode === 'verify') {
      if (!existingPin || !verifyPin(pin, existingPin)) {
        return NextResponse.json({ error: 'Senha incorreta.' }, { status: 401 })
      }
      return NextResponse.json({ success: true, hasPin: true, sessionToken: createCustomerSession(customerId) })
    }

    if (existingPin) {
      if (!currentPin || !verifyPin(currentPin, existingPin)) {
        return NextResponse.json({ error: 'Senha atual incorreta.' }, { status: 401 })
      }
    }

    const { error } = await supabase
      .from('customers')
      .update({ pin_hash: hashPin(pin) })
      .eq('id', customerId)

    if (error) {
      if (isPinColumnMissing(error)) {
        return NextResponse.json({ error: PIN_MIGRATION_HINT }, { status: 503 })
      }
      return NextResponse.json({ error: 'Erro ao salvar senha.' }, { status: 500 })
    }

    // Emite sessão autenticada: ao criar/alterar a senha o cliente fica autenticado.
    return NextResponse.json({ success: true, hasPin: true, sessionToken: createCustomerSession(customerId) })
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
    const existingPin = await getCustomerPinHash(supabase, customerId)

    if (!existingPin) {
      return NextResponse.json({ success: true, hasPin: false })
    }

    if (!verifyPin(pin, existingPin)) {
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
