import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireWaiterAccess, RestaurantAuthError } from '@/lib/restaurant-auth'
import { parseNfceQrContent } from '@/lib/nfe/parse-nfce-qr'
import { sendRestaurantWhatsApp } from '@/lib/send-whatsapp'

/**
 * GET /api/garcom/nfe-whatsapp?paymentIds=a,b,c
 * Retorna quais desses pagamentos já tiveram a nota enviada por WhatsApp.
 * (RLS de nfe_invoices é owner-only; garçom consulta por aqui.)
 */
export async function GET(req: NextRequest) {
  try {
    const access = await requireWaiterAccess()
    const idsParam = req.nextUrl.searchParams.get('paymentIds') ?? ''
    const ids = idsParam.split(',').map(s => s.trim()).filter(Boolean).slice(0, 100)
    if (ids.length === 0) return NextResponse.json({ sentPaymentIds: [] })

    const admin = createAdminClient()
    const { data } = await admin
      .from('nfe_invoices')
      .select('payment_id')
      .eq('restaurant_id', access.restaurantId)
      .in('payment_id', ids)
      .not('whatsapp_sent_at', 'is', null)

    return NextResponse.json({
      sentPaymentIds: (data ?? []).map(r => String(r.payment_id)),
    })
  } catch (err) {
    if (err instanceof RestaurantAuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    console.error('[garcom nfe-whatsapp GET]', err)
    return NextResponse.json({ error: 'Erro ao consultar notas.' }, { status: 500 })
  }
}

/**
 * POST /api/garcom/nfe-whatsapp
 *
 * Ponte manual da nota fiscal: o restaurante emite a NFC-e no sistema fiscal
 * dele; o garçom/caixa escaneia o QR do DANFE impresso (ou cola a chave) e
 * o link de consulta vai por WhatsApp para o cliente do pagamento.
 *
 * Registra em nfe_invoices com provider 'externo' (nota emitida fora do
 * KiComanda) para histórico e idempotência.
 */
export async function POST(req: NextRequest) {
  try {
    const access = await requireWaiterAccess()

    const body = await req.json() as { paymentId?: string; qrContent?: string }
    const { paymentId, qrContent } = body

    if (!paymentId || !qrContent) {
      return NextResponse.json({ error: 'Pagamento e QR da nota são obrigatórios.' }, { status: 400 })
    }

    const parsed = parseNfceQrContent(qrContent)
    if (!parsed) {
      return NextResponse.json(
        { error: 'QR inválido. Escaneie o QR impresso na nota (DANFE) ou cole a chave de acesso de 44 dígitos.' },
        { status: 400 },
      )
    }

    const admin = createAdminClient()

    const { data: payment } = await admin
      .from('payments')
      .select('id, restaurant_id, customer_id, session_id, amount, status')
      .eq('id', paymentId)
      .maybeSingle()

    if (!payment) {
      return NextResponse.json({ error: 'Pagamento não encontrado.' }, { status: 404 })
    }
    if (payment.restaurant_id !== access.restaurantId) {
      return NextResponse.json({ error: 'Sem permissão para este pagamento.' }, { status: 403 })
    }
    if (payment.status !== 'paid') {
      return NextResponse.json({ error: 'Confirme o pagamento antes de enviar a nota.' }, { status: 409 })
    }
    if (!payment.customer_id) {
      return NextResponse.json({ error: 'Pagamento sem cliente identificado.' }, { status: 409 })
    }

    const { data: customer } = await admin
      .from('customers')
      .select('first_name, whatsapp')
      .eq('id', payment.customer_id)
      .maybeSingle()

    const whatsapp = customer?.whatsapp?.trim()
    if (!whatsapp) {
      return NextResponse.json({ error: 'Cliente não tem WhatsApp cadastrado.' }, { status: 409 })
    }

    const { data: restaurant } = await admin
      .from('restaurants')
      .select('name')
      .eq('id', access.restaurantId)
      .maybeSingle()

    // Idempotência: reaproveita o registro da nota deste pagamento, se houver.
    const { data: existing } = await admin
      .from('nfe_invoices')
      .select('id, whatsapp_sent_at')
      .eq('payment_id', payment.id)
      .eq('provider', 'externo')
      .maybeSingle()

    let invoiceId = existing?.id ?? null
    if (existing) {
      await admin
        .from('nfe_invoices')
        .update({ access_key: parsed.accessKey, danfe_url: parsed.consultUrl, status: 'issued' })
        .eq('id', existing.id)
    } else {
      const { data: invoice, error: insErr } = await admin
        .from('nfe_invoices')
        .insert({
          restaurant_id: access.restaurantId,
          payment_id: payment.id,
          customer_id: payment.customer_id,
          session_id: payment.session_id,
          note_type: 'nfce',
          status: 'issued',
          provider: 'externo',
          provider_ref: parsed.accessKey,
          environment: 'producao',
          amount: Number(payment.amount),
          danfe_url: parsed.consultUrl,
          access_key: parsed.accessKey,
        })
        .select('id')
        .single()
      if (insErr || !invoice) {
        console.error('[garcom nfe-whatsapp] insert', insErr)
        return NextResponse.json({ error: 'Erro ao registrar a nota.' }, { status: 500 })
      }
      invoiceId = invoice.id
    }

    const message = buildMessage({
      customerName: customer?.first_name ?? null,
      restaurantName: restaurant?.name ?? 'Restaurante',
      consultUrl: parsed.consultUrl,
      accessKey: parsed.accessKey,
    })

    const sent = await sendRestaurantWhatsApp(admin, access.restaurantId, whatsapp, message)
    if (!sent.ok && !sent.mock) {
      return NextResponse.json({ error: sent.error ?? 'Falha ao enviar o WhatsApp.' }, { status: 502 })
    }

    if (invoiceId) {
      await admin
        .from('nfe_invoices')
        .update({ whatsapp_sent_at: new Date().toISOString() })
        .eq('id', invoiceId)
    }

    return NextResponse.json({
      ok: true,
      mock: Boolean(sent.mock),
      alreadySent: Boolean(existing?.whatsapp_sent_at),
    })
  } catch (err) {
    if (err instanceof RestaurantAuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    console.error('[garcom nfe-whatsapp]', err)
    return NextResponse.json({ error: 'Erro ao enviar a nota fiscal.' }, { status: 500 })
  }
}

function buildMessage(p: {
  customerName: string | null
  restaurantName: string
  consultUrl: string | null
  accessKey: string
}): string {
  const greeting = p.customerName ? `Olá, ${p.customerName}!` : 'Olá!'
  if (p.consultUrl) {
    return `${greeting} Sua nota fiscal de *${p.restaurantName}* está disponível:\n\n📄 ${p.consultUrl}\n\nObrigado pela visita!`
  }
  return `${greeting} Sua nota fiscal de *${p.restaurantName}* foi emitida.\n\n🔑 Chave de acesso:\n${p.accessKey}\n\nConsulte em https://www.nfce.fazenda.gov.br\n\nObrigado pela visita!`
}
