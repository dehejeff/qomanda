import { NextResponse } from 'next/server'
import { requireOwnerAccess, RestaurantAuthError } from '@/lib/restaurant-auth'
import {
  isMercadoPagoOAuthConfigured,
  signOAuthState,
  buildMercadoPagoAuthorizeUrl,
} from '@/lib/mercadopago-oauth'

/**
 * GET /api/dashboard/gateway/mercadopago/connect
 * Inicia o OAuth: gera o state assinado e redireciona o dono para o Mercado Pago.
 */
export async function GET() {
  try {
    const access = await requireOwnerAccess()

    if (!isMercadoPagoOAuthConfigured()) {
      return NextResponse.json(
        { error: 'OAuth do Mercado Pago não configurado (MERCADO_PAGO_CLIENT_ID/SECRET).' },
        { status: 400 },
      )
    }

    const state = signOAuthState(access.restaurantId)
    return NextResponse.redirect(buildMercadoPagoAuthorizeUrl(state))
  } catch (err) {
    if (err instanceof RestaurantAuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    console.error('[MP OAuth connect]', err)
    return NextResponse.json({ error: 'Erro ao iniciar conexão.' }, { status: 500 })
  }
}
