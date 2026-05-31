import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { hashPin, verifyPin, isValidPin } from '@/lib/customer-pin'

/**
 * GET /api/customer/pin?customer=UUID
 */
export async function GET(req: NextRequest) {
  const customerId = req.nextUrl.searchParams.get('customer')
  if (!customerId) {
    return NextResponse.json({ error: 'customer obrigatório.' }, { status: 400 })
  }

  const supabase = createAdminClient()
  const { data } = await supabase
    .from('customers')
    .select('pin_hash')
    .eq('id', customerId)
    .single()

  if (!data) {
    return NextResponse.json({ error: 'Cliente não encontrado.' }, { status: 404 })
  }

  return NextResponse.json({ hasPin: Boolean(data.pin_hash) })
}

/**
 * POST /api/customer/pin — criar ou alterar PIN
 * DELETE /api/customer/pin — remover PIN (body: customerId, pin)
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as { customerId?: string; pin?: string; currentPin?: string }
    const { customerId, pin, currentPin } = body

    if (!customerId || !pin) {
      return NextResponse.json({ error: 'customerId e pin são obrigatórios.' }, { status: 400 })
    }

    if (!isValidPin(pin)) {
      return NextResponse.json({ error: 'PIN deve ter 4 dígitos.' }, { status: 400 })
    }

    const supabase = createAdminClient()
    const { data: customer } = await supabase
      .from('customers')
      .select('pin_hash')
      .eq('id', customerId)
      .single()

    if (!customer) {
      return NextResponse.json({ error: 'Cliente não encontrado.' }, { status: 404 })
    }

    if (customer.pin_hash) {
      if (!currentPin || !verifyPin(currentPin, customer.pin_hash)) {
        return NextResponse.json({ error: 'PIN atual incorreto.' }, { status: 401 })
      }
    }

    const { error } = await supabase
      .from('customers')
      .update({ pin_hash: hashPin(pin) })
      .eq('id', customerId)

    if (error) {
      return NextResponse.json({ error: 'Erro ao salvar PIN.' }, { status: 500 })
    }

    return NextResponse.json({ success: true, hasPin: true })
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
    const { data: customer } = await supabase
      .from('customers')
      .select('pin_hash')
      .eq('id', customerId)
      .single()

    if (!customer?.pin_hash) {
      return NextResponse.json({ success: true, hasPin: false })
    }

    if (!verifyPin(pin, customer.pin_hash)) {
      return NextResponse.json({ error: 'PIN incorreto.' }, { status: 401 })
    }

    const { error } = await supabase
      .from('customers')
      .update({ pin_hash: null })
      .eq('id', customerId)

    if (error) {
      return NextResponse.json({ error: 'Erro ao remover PIN.' }, { status: 500 })
    }

    return NextResponse.json({ success: true, hasPin: false })
  } catch (err) {
    console.error('[Customer PIN DELETE Error]', err)
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 })
  }
}
