import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  customerHasPin,
  customerHasSavedCards,
} from '@/lib/customer-pin-server'
import {
  applySessionRenewal,
  authenticateCustomerSession,
} from '@/lib/customer-session'

export type HubAccessResponse = {
  hasSavedCards: boolean
  hasPin: boolean
  requiresSession: boolean
  sessionValid: boolean
  pinLength: 4 | 6 | null
}

/**
 * GET /api/customer/hub/access?customer=UUID
 * Informa se o hub exige senha de 6 dígitos (cartão salvo).
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

  const hasSavedCards = await customerHasSavedCards(supabase, customerId)
  const hasPin = await customerHasPin(supabase, customerId)
  const auth = authenticateCustomerSession(req, customerId)
  const sessionValid = auth.ok

  return applySessionRenewal(
    NextResponse.json({
      hasSavedCards,
      hasPin,
      requiresSession: hasSavedCards,
      sessionValid,
      pinLength: hasSavedCards ? 6 : hasPin ? 4 : null,
    } satisfies HubAccessResponse),
    hasSavedCards && sessionValid ? auth.renewedToken : undefined,
  )
}
