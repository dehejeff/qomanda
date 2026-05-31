import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { findCustomerActiveSession } from '@/lib/customer-auth-server'
import { verifyLoginChallenge } from '@/lib/login-challenge'
import { verifyPin, isValidPin } from '@/lib/customer-pin'
import { getCustomerPinHash } from '@/lib/customer-pin-server'
import { createCustomerSession } from '@/lib/customer-session'
import type { CustomerAuthPayload } from '@/lib/customer-login-types'

/**
 * POST /api/customer/login/verify-pin
 * Conclui login após WhatsApp + PIN.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as { challengeToken?: string; pin?: string }
    const { challengeToken, pin } = body

    if (!challengeToken || !pin) {
      return NextResponse.json({ error: 'Token e senha são obrigatórios.' }, { status: 400 })
    }

    if (!isValidPin(pin)) {
      return NextResponse.json({ error: 'A senha deve ter 6 dígitos.' }, { status: 400 })
    }

    const challenge = verifyLoginChallenge(challengeToken)
    if (!challenge) {
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

    const pinHash = await getCustomerPinHash(supabase, customer.id)

    if (!pinHash || !verifyPin(pin, pinHash)) {
      return NextResponse.json({ error: 'Senha incorreta.' }, { status: 401 })
    }

    const activeSession = await findCustomerActiveSession(supabase, customer.id)

    return NextResponse.json({
      customerId: customer.id,
      firstName: customer.first_name,
      lastName: customer.last_name,
      activeSession,
      sessionToken: createCustomerSession(customer.id),
    } satisfies CustomerAuthPayload & { sessionToken: string })
  } catch (err) {
    console.error('[Customer Verify PIN Error]', err)
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 })
  }
}
