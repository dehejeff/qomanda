import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { tokenizeCreditCard, type AsaasCreditCard, type AsaasCreditCardHolderInfo } from '@/lib/asaas'
import { buildHolderInfoFromCustomer, resolveAsaasCustomerId } from '@/lib/asaas-customer'
import {
  applySessionRenewal,
  authenticateCustomerSession,
} from '@/lib/customer-session'
import {
  clientIp,
  listPaymentMethods,
  savePaymentMethod,
} from '@/lib/payment-methods'

const UNAUTHORIZED = { error: 'Sessão não autenticada. Faça login com sua senha de 6 dígitos.' }

export type SavedPaymentMethodDto = {
  id: string
  brand: string | null
  lastFour: string
  holderName: string | null
  isDefault: boolean
}

/**
 * GET /api/customer/payment-methods?customer=UUID
 */
export async function GET(req: NextRequest) {
  const customerId = req.nextUrl.searchParams.get('customer')
  if (!customerId) {
    return NextResponse.json({ error: 'customer obrigatório.' }, { status: 400 })
  }

  const auth = authenticateCustomerSession(req, customerId)
  if (!auth.ok) {
    return NextResponse.json(UNAUTHORIZED, { status: 401 })
  }

  try {
    const supabase = createAdminClient()

    const { data: customer } = await supabase
      .from('customers')
      .select('id')
      .eq('id', customerId)
      .single()

    if (!customer) {
      return NextResponse.json({ error: 'Cliente não encontrado.' }, { status: 404 })
    }

    const methods = await listPaymentMethods(supabase, customerId)
    return applySessionRenewal(
      NextResponse.json({ methods }),
      auth.renewedToken,
    )
  } catch (err) {
    console.error('[Payment Methods GET]', err)
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 })
  }
}

/**
 * POST /api/customer/payment-methods
 * Tokeniza e salva cartão (sem cobrança).
 */
export async function POST(req: NextRequest) {
  const body = await req.json() as {
    customerId?: string
    creditCard?: AsaasCreditCard
    creditCardHolderInfo?: Partial<AsaasCreditCardHolderInfo>
    setDefault?: boolean
  }

  const { customerId, creditCard, setDefault } = body

  if (!customerId || !creditCard?.number || !creditCard.holderName || !creditCard.ccv) {
    return NextResponse.json({ error: 'Dados do cartão incompletos.' }, { status: 400 })
  }

  const auth = authenticateCustomerSession(req, customerId)
  if (!auth.ok) {
    return NextResponse.json(UNAUTHORIZED, { status: 401 })
  }

  try {
    const supabase = createAdminClient()
    const { asaasCustomerId, customer } = await resolveAsaasCustomerId(supabase, customerId)
    const baseHolder = buildHolderInfoFromCustomer(customer)

    const holderInfo: AsaasCreditCardHolderInfo = {
      ...baseHolder,
      name: body.creditCardHolderInfo?.name ?? creditCard.holderName ?? baseHolder.name,
      email: body.creditCardHolderInfo?.email ?? baseHolder.email,
      cpfCnpj: body.creditCardHolderInfo?.cpfCnpj ?? baseHolder.cpfCnpj,
      phone: body.creditCardHolderInfo?.phone ?? baseHolder.phone,
      mobilePhone: body.creditCardHolderInfo?.mobilePhone ?? baseHolder.mobilePhone,
    }

    const tokenized = await tokenizeCreditCard({
      customerId: asaasCustomerId,
      creditCard,
      creditCardHolderInfo: holderInfo,
      remoteIp: clientIp(req),
    })

    const saved = await savePaymentMethod(supabase, {
      customerId,
      creditCardToken: tokenized.creditCardToken,
      brand: tokenized.creditCardBrand,
      lastFour: tokenized.creditCardNumber,
      holderName: creditCard.holderName,
      setDefault,
    })

    return applySessionRenewal(
      NextResponse.json({ method: saved }),
      auth.renewedToken,
    )
  } catch (err) {
    console.error('[Payment Methods POST]', err)
    const msg = err instanceof Error ? err.message : 'Erro ao salvar cartão.'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

/**
 * DELETE /api/customer/payment-methods?customer=UUID&id=UUID
 */
export async function DELETE(req: NextRequest) {
  const customerId = req.nextUrl.searchParams.get('customer')
  const methodId   = req.nextUrl.searchParams.get('id')

  if (!customerId || !methodId) {
    return NextResponse.json({ error: 'Parâmetros inválidos.' }, { status: 400 })
  }

  const auth = authenticateCustomerSession(req, customerId)
  if (!auth.ok) {
    return NextResponse.json(UNAUTHORIZED, { status: 401 })
  }

  try {
    const supabase = createAdminClient()

    await supabase
      .from('customer_payment_methods')
      .delete()
      .eq('id', methodId)
      .eq('customer_id', customerId)

    const remaining = await listPaymentMethods(supabase, customerId)
    if (remaining.length > 0 && !remaining.some(m => m.isDefault)) {
      await supabase
        .from('customer_payment_methods')
        .update({ is_default: true })
        .eq('id', remaining[0].id)
    }

    return applySessionRenewal(
      NextResponse.json({ success: true }),
      auth.renewedToken,
    )
  } catch (err) {
    console.error('[Payment Methods DELETE]', err)
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 })
  }
}

/**
 * PATCH /api/customer/payment-methods  { customerId, methodId }
 * Define cartão padrão.
 */
export async function PATCH(req: NextRequest) {
  const { customerId, methodId } = await req.json()

  if (!customerId || !methodId) {
    return NextResponse.json({ error: 'Dados inválidos.' }, { status: 400 })
  }

  const auth = authenticateCustomerSession(req, customerId)
  if (!auth.ok) {
    return NextResponse.json(UNAUTHORIZED, { status: 401 })
  }

  try {
    const supabase = createAdminClient()

    await supabase
      .from('customer_payment_methods')
      .update({ is_default: false })
      .eq('customer_id', customerId)

    await supabase
      .from('customer_payment_methods')
      .update({ is_default: true })
      .eq('id', methodId)
      .eq('customer_id', customerId)

    return applySessionRenewal(
      NextResponse.json({ success: true }),
      auth.renewedToken,
    )
  } catch (err) {
    console.error('[Payment Methods PATCH]', err)
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 })
  }
}
