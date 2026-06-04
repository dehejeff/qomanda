import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireOwnerAccess, RestaurantAuthError } from '@/lib/restaurant-auth'
import { encryptSecret } from '@/lib/secret-crypto'
import { verifyOAuthState, exchangeMercadoPagoCode } from '@/lib/mercadopago-oauth'

function settingsRedirect(req: NextRequest, status: 'connected' | 'error', message?: string): NextResponse {
  const url = new URL('/dashboard/settings', req.nextUrl.origin)
  url.searchParams.set('tab', 'pagamentos')
  url.searchParams.set('mp', status)
  if (message) url.searchParams.set('mp_msg', message.slice(0, 140))
  return NextResponse.redirect(url)
}

/**
 * GET /api/dashboard/gateway/mercadopago/callback?code&state
 * Recebe o retorno do Mercado Pago, valida o state (anti-CSRF), troca o code por
 * tokens e grava como gateway do restaurante (provider=mercado_pago).
 */
export async function GET(req: NextRequest) {
  try {
    const code = req.nextUrl.searchParams.get('code')
    const state = req.nextUrl.searchParams.get('state')
    const oauthError = req.nextUrl.searchParams.get('error')

    if (oauthError) return settingsRedirect(req, 'error', oauthError)
    if (!code || !state) return settingsRedirect(req, 'error', 'Retorno inválido do Mercado Pago.')

    const verified = verifyOAuthState(state)
    if (!verified) return settingsRedirect(req, 'error', 'Sessão de conexão expirada. Tente novamente.')

    // Confirma que quem retornou é o dono do mesmo restaurante do state (anti-CSRF).
    const access = await requireOwnerAccess()
    if (access.restaurantId !== verified.restaurantId) {
      return settingsRedirect(req, 'error', 'Conta não corresponde ao restaurante.')
    }

    const tokens = await exchangeMercadoPagoCode(code)

    const expiresAt = tokens.expires_in
      ? new Date(Date.now() + tokens.expires_in * 1000).toISOString()
      : null

    const admin = createAdminClient()
    const { error } = await admin
      .from('restaurants')
      .update({
        payment_gateway_provider: 'mercado_pago',
        payment_gateway_api_key_encrypted: encryptSecret(tokens.access_token),
        payment_gateway_environment: 'production',
        payment_gateway_connected_at: new Date().toISOString(),
        mp_refresh_token_encrypted: tokens.refresh_token ? encryptSecret(tokens.refresh_token) : null,
        mp_public_key: tokens.public_key,
        mp_user_id: tokens.user_id ? String(tokens.user_id) : null,
        mp_token_expires_at: expiresAt,
        mp_connected_via: 'oauth',
      })
      .eq('id', access.restaurantId)

    if (error) {
      console.error('[MP OAuth callback] update', error)
      return settingsRedirect(req, 'error', 'Erro ao salvar a conexão.')
    }

    return settingsRedirect(req, 'connected')
  } catch (err) {
    if (err instanceof RestaurantAuthError) {
      // Sessão do dono não encontrada no retorno — pede login e nova tentativa.
      const url = new URL('/login', req.nextUrl.origin)
      url.searchParams.set('perfil', 'admin')
      url.searchParams.set('next', '/dashboard/settings?tab=pagamentos')
      return NextResponse.redirect(url)
    }
    console.error('[MP OAuth callback]', err)
    return settingsRedirect(req, 'error', 'Erro inesperado na conexão.')
  }
}
