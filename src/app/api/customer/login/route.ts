import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { findCustomerActiveSession } from '@/lib/customer-auth-server'
import { findCustomerByWhatsApp } from '@/lib/customer-lookup'
import { createLoginChallenge } from '@/lib/login-challenge'
import { isValidBrazilWhatsApp, normalizeBrazilWhatsApp } from '@/lib/whatsapp-normalize'
import type { CustomerAuthPayload, CustomerLoginResponse } from '@/lib/customer-login-types'

export type { CustomerAuthPayload, CustomerLoginResponse }

async function buildAuthPayload(
  supabase: ReturnType<typeof createAdminClient>,
  customer: { id: string; first_name: string; last_name: string },
): Promise<CustomerAuthPayload> {
  const activeSession = await findCustomerActiveSession(supabase, customer.id)
  return {
    customerId: customer.id,
    firstName: customer.first_name,
    lastName: customer.last_name,
    activeSession,
  }
}

/**
 * POST /api/customer/login
 * Identifica cliente pelo WhatsApp. Se tiver PIN, exige verificação.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as { whatsapp?: string }
    const phone = body.whatsapp?.replace(/\D/g, '') ?? ''

    if (!isValidBrazilWhatsApp(phone)) {
      return NextResponse.json({ error: 'Informe um WhatsApp válido com DDD.' }, { status: 400 })
    }

    const supabase = createAdminClient()
    const customer = await findCustomerByWhatsApp(supabase, phone)

    if (!customer) {
      return NextResponse.json(
        { error: 'WhatsApp não encontrado. Cadastre-se ou faça check-in na mesa do restaurante.' },
        { status: 404 },
      )
    }

    // Unifica formato legado no banco (ex.: sem 9º dígito ou com 55)
    const canonical = normalizeBrazilWhatsApp(phone)
    if (customer.whatsapp !== canonical) {
      await supabase.from('customers').update({ whatsapp: canonical }).eq('id', customer.id)
    }

    if (customer.pin_hash) {
      return NextResponse.json({
        requiresPin: true,
        challengeToken: createLoginChallenge(customer.id),
        firstName: customer.first_name,
      } satisfies CustomerLoginResponse)
    }

    const payload = await buildAuthPayload(supabase, customer)
    return NextResponse.json({ requiresPin: false, ...payload } satisfies CustomerLoginResponse)
  } catch (err) {
    console.error('[Customer Login Error]', err)
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 })
  }
}
