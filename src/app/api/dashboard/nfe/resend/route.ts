import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireOwnerAccess, RestaurantAuthError } from '@/lib/restaurant-auth'
import { sendRestaurantWhatsApp } from '@/lib/send-whatsapp'

/**
 * POST /api/dashboard/nfe/resend { invoiceId }
 * Reenvia o link da nota ao cliente por WhatsApp.
 */
export async function POST(req: NextRequest) {
  try {
    const access = await requireOwnerAccess()
    const { invoiceId } = await req.json() as { invoiceId?: string }
    if (!invoiceId) return NextResponse.json({ error: 'invoiceId obrigatório.' }, { status: 400 })

    const admin = createAdminClient()
    const { data: inv } = await admin
      .from('nfe_invoices')
      .select('id, restaurant_id, note_type, status, danfe_url, customer:customers(first_name, last_name, whatsapp), restaurant:restaurants(name)')
      .eq('id', invoiceId)
      .maybeSingle()

    if (!inv || inv.restaurant_id !== access.restaurantId) {
      return NextResponse.json({ error: 'Nota não encontrada.' }, { status: 404 })
    }

    const c = Array.isArray(inv.customer) ? inv.customer[0] : inv.customer
    const rest = Array.isArray(inv.restaurant) ? inv.restaurant[0] : inv.restaurant
    const whatsapp = (c as { whatsapp?: string } | null)?.whatsapp
    if (!whatsapp) return NextResponse.json({ error: 'Cliente sem WhatsApp cadastrado.' }, { status: 400 })

    const first = ((c as { first_name?: string } | null)?.first_name) || 'Olá'
    const tipo = inv.note_type === 'nfce' ? 'Nota Fiscal (NFC-e)' : 'Nota Fiscal de Serviço (NFS-e)'
    const restName = (rest as { name?: string } | null)?.name ?? 'o restaurante'
    const msg = inv.danfe_url
      ? `Olá, ${first}! Sua ${tipo} de *${restName}* está disponível.\n\n📄 ${inv.danfe_url}`
      : `Olá, ${first}! Sua ${tipo} de *${restName}* foi registrada e será enviada por aqui.`

    const sent = await sendRestaurantWhatsApp(admin, access.restaurantId, whatsapp, msg)
    if (!sent.ok) return NextResponse.json({ error: sent.error ?? 'Falha ao enviar WhatsApp.' }, { status: 400 })

    await admin.from('nfe_invoices').update({ whatsapp_sent_at: new Date().toISOString() }).eq('id', invoiceId)
    return NextResponse.json({ ok: true, mock: sent.mock ?? false })
  } catch (err) {
    if (err instanceof RestaurantAuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    console.error('[NFe resend]', err)
    return NextResponse.json({ error: 'Erro ao reenviar nota.' }, { status: 500 })
  }
}
