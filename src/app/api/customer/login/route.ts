import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { findCustomerByWhatsApp } from '@/lib/customer-lookup'
import {
  customerHasSavedCards,
  getCustomerPinHash,
} from '@/lib/customer-pin-server'
import { createLoginChallenge } from '@/lib/login-challenge'
import { isValidWhatsApp, normalizeWhatsApp } from '@/lib/whatsapp-normalize'
import type { CustomerAuthPayload, CustomerLoginResponse } from '@/lib/customer-login-types'

export type { CustomerAuthPayload, CustomerLoginResponse }

/**
 * POST /api/customer/login
 * WhatsApp + PIN de 4 dígitos (sem cartão) ou senha de 6 dígitos (com cartão salvo).
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as { whatsapp?: string }
    const phone = body.whatsapp?.replace(/\D/g, '') ?? ''

    if (!isValidWhatsApp(phone)) {
      return NextResponse.json({ error: 'Informe um WhatsApp válido (BR ou internacional com +).' }, { status: 400 })
    }

    const supabase = createAdminClient()
    const customer = await findCustomerByWhatsApp(supabase, phone)

    if (!customer) {
      return NextResponse.json(
        { error: 'WhatsApp não encontrado. Cadastre-se ou faça check-in na mesa do restaurante.' },
        { status: 404 },
      )
    }

    const canonical = normalizeWhatsApp(phone).e164
    if (customer.whatsapp !== canonical) {
      await supabase.from('customers').update({ whatsapp: canonical }).eq('id', customer.id)
    }

    const hasSavedCards = await customerHasSavedCards(supabase, customer.id)
    const pinHash = await getCustomerPinHash(supabase, customer.id)

    if (hasSavedCards) {
      return NextResponse.json({
        requiresPin: true,
        pinLength: 6,
        requiresSession: true,
        challengeToken: createLoginChallenge(customer.id, 6),
        firstName: customer.first_name,
      } satisfies CustomerLoginResponse)
    }

    if (pinHash) {
      return NextResponse.json({
        requiresPin: true,
        pinLength: 4,
        challengeToken: createLoginChallenge(customer.id, 4),
        firstName: customer.first_name,
      } satisfies CustomerLoginResponse)
    }

    let challengeToken: string
    try {
      challengeToken = createLoginChallenge(customer.id, 'setup')
    } catch (challengeErr) {
      const msg = challengeErr instanceof Error ? challengeErr.message : String(challengeErr)
      console.error('[Customer Login] challenge setup failed:', msg)
      if (msg.includes('não configurada')) {
        return NextResponse.json({ error: 'Login temporariamente indisponível. Contate o suporte.' }, { status: 503 })
      }
      throw challengeErr
    }

    return NextResponse.json({
      requiresPinSetup: true,
      challengeToken,
      firstName: customer.first_name,
    } satisfies CustomerLoginResponse)
  } catch (err) {
    console.error('[Customer Login Error]', err)
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 })
  }
}
