import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * GET /api/customer/profile?session=SESSION_ID
 * Retorna dados seguros do cliente para exibição no perfil.
 * Usa service role para leitura — dados PII nunca expostos via RLS público.
 */
export async function GET(req: NextRequest) {
  const sessionId = req.nextUrl.searchParams.get('session')
  if (!sessionId) {
    return NextResponse.json({ error: 'session obrigatório.' }, { status: 400 })
  }

  try {
    const supabase = createAdminClient()

    // Valida sessão e obtém customer_id + restaurant_id
    const { data: session } = await supabase
      .from('sessions')
      .select('customer_id, restaurant_id')
      .eq('id', sessionId)
      .single()

    if (!session?.customer_id) {
      return NextResponse.json({ error: 'Sessão inválida.' }, { status: 404 })
    }

    // Cliente logado (localStorage) — importante em mesas compartilhadas
    const customerParam = req.nextUrl.searchParams.get('customer')
    let customerId = session.customer_id
    if (customerParam) {
      const { data: participant } = await supabase
        .from('session_participants')
        .select('customer_id')
        .eq('session_id', sessionId)
        .eq('customer_id', customerParam)
        .maybeSingle()
      if (participant) customerId = customerParam
    }

    // Garante registro do participante (sessões criadas antes da tabela)
    await supabase
      .from('session_participants')
      .upsert(
        { session_id: sessionId, customer_id: customerId },
        { onConflict: 'session_id,customer_id' },
      )
      .then(() => {})  // erro não bloqueia resposta do perfil

    // Contagem: sessões distintas em que participou neste restaurante
    const { data: participations } = await supabase
      .from('session_participants')
      .select('session_id, sessions!inner(restaurant_id)')
      .eq('customer_id', customerId)

    const visitCount = (participations ?? []).filter(p => {
      const sess = p.sessions as { restaurant_id: string } | { restaurant_id: string }[] | null
      const restaurantId = Array.isArray(sess) ? sess[0]?.restaurant_id : sess?.restaurant_id
      return restaurantId === session.restaurant_id
    }).length

    // Mantém customer_visits sincronizado (fidelidade / relatórios) — falha não bloqueia perfil
    await supabase
      .from('customer_visits')
      .upsert(
        {
          customer_id: customerId,
          restaurant_id: session.restaurant_id,
          session_id: sessionId,
        },
        { onConflict: 'customer_id,session_id' },
      )
      .then(() => {})
      .catch((err: unknown) => console.error('[Profile] customer_visits upsert:', err))

    const { data: customer } = await supabase
      .from('customers')
      .select('first_name, last_name, whatsapp, document_type')
      .eq('id', customerId)
      .single()

    // Próxima recompensa
    const { data: rules } = await supabase
      .from('loyalty_rules')
      .select('visit_count, benefit_value')
      .eq('restaurant_id', session.restaurant_id)
      .eq('active', true)
      .gt('visit_count', visitCount ?? 0)
      .order('visit_count', { ascending: true })
      .limit(1)

    return NextResponse.json({
      customerId,
      firstName:    customer?.first_name ?? '',
      lastName:     customer?.last_name ?? '',
      whatsapp:     customer?.whatsapp ?? '',
      documentType: customer?.document_type ?? null,
      hasCpf:       customer?.document_type === 'cpf',
      visits:       visitCount ?? 0,
      nextReward:   rules?.[0] ?? null,
    })
  } catch (err) {
    console.error('[Profile API Error]', err)
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 })
  }
}

/**
 * PATCH /api/customer/profile
 * Atualiza nome do cliente (WhatsApp é imutável — é a chave de identidade).
 * Aceita customerId opcional; valida que é participante da sessão.
 */
export async function PATCH(req: NextRequest) {
  const { sessionId, customerId: bodyCustomerId, firstName, lastName } = await req.json()

  if (!sessionId || !firstName?.trim()) {
    return NextResponse.json({ error: 'Dados inválidos.' }, { status: 400 })
  }

  try {
    const supabase = createAdminClient()

    const { data: session } = await supabase
      .from('sessions')
      .select('customer_id')
      .eq('id', sessionId)
      .single()

    if (!session?.customer_id) {
      return NextResponse.json({ error: 'Sessão inválida.' }, { status: 404 })
    }

    let resolvedCustomerId = session.customer_id

    if (bodyCustomerId && bodyCustomerId !== session.customer_id) {
      const { data: participant } = await supabase
        .from('session_participants')
        .select('customer_id')
        .eq('session_id', sessionId)
        .eq('customer_id', bodyCustomerId)
        .maybeSingle()

      if (participant) resolvedCustomerId = bodyCustomerId
    }

    await supabase
      .from('customers')
      .update({ first_name: firstName.trim(), last_name: lastName?.trim() ?? '' })
      .eq('id', resolvedCustomerId)

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[Profile PATCH Error]', err)
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 })
  }
}
