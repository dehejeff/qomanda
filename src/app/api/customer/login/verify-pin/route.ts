import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { findCustomerActiveSession } from '@/lib/customer-auth-server'
import { verifyLoginChallenge } from '@/lib/login-challenge'
import { verifyPinSecret } from '@/lib/customer-pin'
import { isValidCardPassword, isValidLoginPin } from '@/lib/customer-pin-shared'
import { getCustomerPinHash } from '@/lib/customer-pin-server'
import { createCustomerSession } from '@/lib/customer-session'
import type { CustomerAuthPayload } from '@/lib/customer-login-types'
import { rateLimit, tooManyRequests } from '@/lib/rate-limit'

/**
 * POST /api/customer/login/verify-pin
 * Conclui login após WhatsApp + PIN (4) ou senha (6).
 */
export async function POST(req: NextRequest) {
  try {
    // Anti brute-force de PIN/senha por IP.
    const rl = await rateLimit(req, { key: 'verify-pin', limit: 10, windowSec: 60 })
    if (!rl.allowed) return tooManyRequests(rl.retryAfter)

    const body = await req.json() as { challengeToken?: string; pin?: string }
    const { challengeToken, pin } = body

    if (!challengeToken || !pin) {
      return NextResponse.json({ error: 'Token e senha são obrigatórios.' }, { status: 400 })
    }

    const challenge = verifyLoginChallenge(challengeToken)
    if (!challenge) {
      return NextResponse.json({ error: 'Sessão expirada. Digite o WhatsApp novamente.' }, { status: 401 })
    }

    const { customerId, pinLength } = challenge

    if (pinLength === 6 && !isValidCardPassword(pin)) {
      return NextResponse.json({ error: 'A senha deve ter 6 dígitos.' }, { status: 400 })
    }
    if (pinLength === 4 && !isValidLoginPin(pin)) {
      return NextResponse.json({ error: 'PIN deve ter 4 dígitos.' }, { status: 400 })
    }

    const supabase = createAdminClient()
    const { data: customer } = await supabase
      .from('customers')
      .select('id, first_name, last_name')
      .eq('id', customerId)
      .single()

    if (!customer) {
      return NextResponse.json({ error: 'Cliente não encontrado.' }, { status: 404 })
    }

    const pinHash = await getCustomerPinHash(supabase, customer.id)

    if (!pinHash || !verifyPinSecret(pin, pinHash, pinLength)) {
      return NextResponse.json({
        error: pinLength === 6 ? 'Senha incorreta.' : 'PIN incorreto.',
      }, { status: 401 })
    }

    const activeSession = await findCustomerActiveSession(supabase, customer.id)

    return NextResponse.json({
      customerId: customer.id,
      firstName: customer.first_name,
      lastName: customer.last_name,
      activeSession,
      ...(pinLength === 6 ? { sessionToken: createCustomerSession(customer.id) } : {}),
    } satisfies CustomerAuthPayload & { sessionToken?: string })
  } catch (err) {
    console.error('[Customer Verify PIN Error]', err)
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 })
  }
}
