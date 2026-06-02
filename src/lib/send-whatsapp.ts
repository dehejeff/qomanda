import type { SupabaseClient } from '@supabase/supabase-js'

/** E.164 — assume Brasil (55) quando 10-11 dígitos sem código de país. */
export function toE164(phone: string): string {
  const digits = phone.replace(/\D/g, '')
  if (digits.startsWith('55') && digits.length >= 12) return digits
  if (digits.length === 11 || digits.length === 10) return `55${digits}`
  return digits
}

export type SendWhatsAppResult = {
  ok: boolean
  mock?: boolean
  messageId?: string
  error?: string
}

/**
 * Envia mensagem de texto via WhatsApp Business usando as credenciais do restaurante.
 * Server-side (reaproveitado pela rota /api/whatsapp e pela emissão de NF-e).
 * Em dev sem credenciais, loga a mensagem e retorna mock=true (não falha).
 */
export async function sendRestaurantWhatsApp(
  supabase: SupabaseClient,
  restaurantId: string,
  to: string,
  message: string,
): Promise<SendWhatsAppResult> {
  const { data: restaurant } = await supabase
    .from('restaurants')
    .select('whatsapp_phone_id, whatsapp_access_token, name')
    .eq('id', restaurantId)
    .maybeSingle()

  const phoneId = restaurant?.whatsapp_phone_id?.trim()
  const token = restaurant?.whatsapp_access_token?.trim()
  const target = toE164(to)

  if (!phoneId || !token) {
    if (process.env.NODE_ENV === 'development') {
      console.log('\n📱 [WhatsApp Mock] Para:', target)
      console.log('📨 Mensagem:\n', message)
      console.log('─'.repeat(60))
      return { ok: true, mock: true }
    }
    return { ok: false, error: 'WhatsApp Business não configurado.' }
  }

  try {
    const res = await fetch(`https://graph.facebook.com/v18.0/${phoneId}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: target,
        type: 'text',
        text: { body: message, preview_url: true },
      }),
    })
    const data = await res.json()
    if (!res.ok) {
      console.error('[sendRestaurantWhatsApp]', data)
      return { ok: false, error: data?.error?.message ?? 'Erro ao enviar WhatsApp.' }
    }
    return { ok: true, messageId: data.messages?.[0]?.id }
  } catch (err) {
    console.error('[sendRestaurantWhatsApp]', err)
    return { ok: false, error: 'Falha de rede ao enviar WhatsApp.' }
  }
}
