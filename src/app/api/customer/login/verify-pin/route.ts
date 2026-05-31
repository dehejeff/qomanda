import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { findCustomerActiveSession } from '@/lib/customer-auth-server'
import { verifyLoginChallenge } from '@/lib/login-challenge'
import { verifyPin, isValidPin } from '@/lib/customer-pin'
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
      return NextResponse.json({ error: 'Token e PIN são obrigatórios.' }, { status: 400 })
    }

    if (!isValidPin(pin)) {
      return NextResponse.json({ error: 'PIN deve ter 4 dígitos.' }, { status: 400 })
    }

    const challenge = verifyLoginChallenge(challengeToken)
    if (!challenge) {
      return NextResponse.json({ error: 'Sessão expirada. Digite o WhatsApp novamente.' }, { status: 401 })
    }

    const supabase = createAdminClient()
    const { data: customer } = await supabase
      .from('customers')
      .select('id, first_name, last_name, pin_hash')
      .eq('id', challenge.customerId)
      .single()

    if (!customer?.pin_hash || !verifyPin(pin, customer.pin_hash)) {
      return NextResponse.json({ error: 'PIN incorreto.' }, { status: 401 })
    }

    const activeSession = await findCustomerActiveSession(supabase, customer.id)

    return NextResponse.json({
      customerId: customer.id,
      firstName: customer.first_name,
      lastName: customer.last_name,
      activeSession,
    } satisfies CustomerAuthPayload)
  } catch (err) {
    console.error('[Customer Verify PIN Error]', err)
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 })
  }
}
