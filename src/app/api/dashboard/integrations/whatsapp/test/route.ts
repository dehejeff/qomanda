import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

function toE164(phone: string): string {
  const digits = phone.replace(/\D/g, '')
  if (digits.startsWith('55') && digits.length >= 12) return digits
  if (digits.length === 11 || digits.length === 10) return `55${digits}`
  return digits
}

/**
 * POST /api/dashboard/integrations/whatsapp/test
 * Envia mensagem de teste usando credenciais do restaurante autenticado.
 */
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })

    const body = await req.json().catch(() => ({}))
    const toRaw = String(body.to ?? '').trim()

    const { data: restaurant } = await supabase
      .from('restaurants')
      .select('id, name, phone, whatsapp_phone_id, whatsapp_access_token')
      .eq('owner_id', user.id)
      .single()

    if (!restaurant) return NextResponse.json({ error: 'Restaurante não encontrado.' }, { status: 404 })

    const destination = toRaw || restaurant.phone || ''
    const digits = destination.replace(/\D/g, '')
    if (digits.length < 10) {
      return NextResponse.json({ error: 'Informe um número válido para o teste.' }, { status: 400 })
    }

    if (!restaurant.whatsapp_phone_id || !restaurant.whatsapp_access_token) {
      if (process.env.NODE_ENV === 'development') {
        console.log('\n📱 [WhatsApp Test Mock] Para:', toE164(digits))
        console.log('Restaurante:', restaurant.name)
        return NextResponse.json({ success: true, mock: true })
      }
      return NextResponse.json({ error: 'Configure Phone Number ID e Access Token antes de testar.' }, { status: 400 })
    }

    const message = `✅ *${restaurant.name}* — teste KiComanda\n\nSe você recebeu esta mensagem, o WhatsApp Business está conectado corretamente.`
    const phoneNumber = toE164(digits)
    const url = `https://graph.facebook.com/v18.0/${restaurant.whatsapp_phone_id}/messages`

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${restaurant.whatsapp_access_token}`,
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
      console.error('[WhatsApp test]', data)
      return NextResponse.json({ error: 'Falha ao enviar mensagem de teste.', detail: data }, { status: 500 })
    }

    return NextResponse.json({ success: true, messageId: data.messages?.[0]?.id })
  } catch (err) {
    console.error('[WhatsApp test POST]', err)
    return NextResponse.json({ error: 'Erro ao enviar teste.' }, { status: 500 })
  }
}
