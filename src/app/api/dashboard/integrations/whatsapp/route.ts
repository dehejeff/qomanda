import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { maskSecret } from '@/lib/secret-crypto'
import {
  validateWhatsAppIntegration,
  whatsAppIntegrationDto,
} from '@/lib/restaurant-whatsapp'

export type WhatsAppIntegrationDto = import('@/lib/restaurant-whatsapp').WhatsAppIntegrationDto

/**
 * GET /api/dashboard/integrations/whatsapp
 */
export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })

    const { data: restaurant } = await supabase
      .from('restaurants')
      .select('whatsapp_phone_id, whatsapp_access_token, whatsapp_nfe_enabled')
      .eq('owner_id', user.id)
      .single()

    if (!restaurant) return NextResponse.json({ error: 'Restaurante não encontrado.' }, { status: 404 })

    const tokenMasked = maskSecret(restaurant.whatsapp_access_token, 6)
    const integration = whatsAppIntegrationDto(restaurant, tokenMasked)

    return NextResponse.json({ integration })
  } catch (err) {
    console.error('[WhatsApp integration GET]', err)
    return NextResponse.json({ error: 'Erro ao carregar WhatsApp.' }, { status: 500 })
  }
}

/**
 * POST /api/dashboard/integrations/whatsapp
 */
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })

    const body = await req.json()
    const phoneNumberId = String(body.phoneNumberId ?? '').trim()
    const accessToken = String(body.accessToken ?? '').trim()
    const nfeAutoSendEnabled = Boolean(body.nfeAutoSendEnabled)

    const { data: restaurant } = await supabase
      .from('restaurants')
      .select('id, whatsapp_access_token')
      .eq('owner_id', user.id)
      .single()

    if (!restaurant) return NextResponse.json({ error: 'Restaurante não encontrado.' }, { status: 404 })

    const validationError = validateWhatsAppIntegration({
      phoneNumberId,
      accessToken,
      hasExistingToken: Boolean(restaurant.whatsapp_access_token),
    })
    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 400 })
    }

    const patch: Record<string, unknown> = {
      whatsapp_phone_id: phoneNumberId,
      whatsapp_nfe_enabled: nfeAutoSendEnabled,
    }
    if (accessToken) {
      patch.whatsapp_access_token = accessToken
    }

    const { error: updateErr } = await supabase
      .from('restaurants')
      .update(patch)
      .eq('id', restaurant.id)

    if (updateErr) {
      console.error('[WhatsApp integration POST]', updateErr)
      return NextResponse.json({ error: 'Erro ao salvar WhatsApp.' }, { status: 500 })
    }

    const { data: refreshed } = await supabase
      .from('restaurants')
      .select('whatsapp_phone_id, whatsapp_access_token, whatsapp_nfe_enabled')
      .eq('id', restaurant.id)
      .single()

    const tokenMasked = maskSecret(refreshed?.whatsapp_access_token, 6)
    const integration = whatsAppIntegrationDto(refreshed ?? {}, tokenMasked)

    return NextResponse.json({
      ok: true,
      message: integration.status === 'auto_send'
        ? 'WhatsApp conectado. NF-e será enviada automaticamente após pagamento.'
        : 'WhatsApp conectado.',
      integration,
    })
  } catch (err) {
    console.error('[WhatsApp integration POST]', err)
    return NextResponse.json({ error: 'Erro ao salvar WhatsApp.' }, { status: 500 })
  }
}
