import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export type WhatsAppPayload = {
  to: string            // número destino (só dígitos)
  restaurantId: string  // para buscar as credenciais
  message: string       // corpo da mensagem (texto simples ou markdown WhatsApp)
}

/**
 * Formata número para E.164 (WhatsApp exige).
 * Assume Brasil (55) se 10-11 dígitos sem código de país.
 */
function toE164(phone: string): string {
  const digits = phone.replace(/\D/g, '')
  if (digits.startsWith('55') && digits.length >= 12) return digits
  if (digits.length === 11 || digits.length === 10) return `55${digits}`
  return digits
}

export async function POST(req: NextRequest) {
  try {
    const body: WhatsAppPayload = await req.json()
    const { to, restaurantId, message } = body

    if (!to || !restaurantId || !message) {
      return NextResponse.json({ error: 'Campos obrigatórios: to, restaurantId, message' }, { status: 400 })
    }

    // Busca credenciais do restaurante
    const supabase = await createClient()
    const { data: restaurant } = await supabase
      .from('restaurants')
      .select('whatsapp_phone_id, whatsapp_access_token, whatsapp_nfe_enabled, name')
      .eq('id', restaurantId)
      .single()

    if (!restaurant?.whatsapp_phone_id || !restaurant?.whatsapp_access_token) {
      // Em desenvolvimento, apenas loga a mensagem
      if (process.env.NODE_ENV === 'development') {
        console.log('\n📱 [WhatsApp Mock] Para:', toE164(to))
        console.log('📨 Mensagem:\n', message)
        console.log('─'.repeat(60))
        return NextResponse.json({ success: true, mock: true })
      }
      return NextResponse.json({ error: 'WhatsApp Business não configurado para este restaurante.' }, { status: 400 })
    }

    const phoneNumber = toE164(to)
    const url = `https://graph.facebook.com/v18.0/${restaurant.whatsapp_phone_id}/messages`

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${restaurant.whatsapp_access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: phoneNumber,
        type: 'text',
        text: { body: message, preview_url: false },
      }),
    })

    const data = await res.json()

    if (!res.ok) {
      console.error('[WhatsApp API Error]', data)
      return NextResponse.json({ error: 'Erro ao enviar WhatsApp', detail: data }, { status: 500 })
    }

    return NextResponse.json({ success: true, messageId: data.messages?.[0]?.id })
  } catch (err) {
    console.error('[WhatsApp Route Error]', err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
