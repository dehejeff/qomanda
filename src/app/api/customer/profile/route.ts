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

    // Busca dados do cliente — sem expor CPF (nem hash nem encrypted)
    const { data: customer } = await supabase
      .from('customers')
      .select('first_name, last_name, whatsapp, document_type')
      .eq('id', session.customer_id)
      .single()

    // Contagem de visitas para fidelidade
    const { count: visitCount } = await supabase
      .from('customer_visits')
      .select('id', { count: 'exact', head: true })
      .eq('customer_id', session.customer_id)
      .eq('restaurant_id', session.restaurant_id)

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
 */
export async function PATCH(req: NextRequest) {
  const { sessionId, firstName, lastName } = await req.json()

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

    await supabase
      .from('customers')
      .update({ first_name: firstName.trim(), last_name: lastName?.trim() ?? '' })
      .eq('id', session.customer_id)

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[Profile PATCH Error]', err)
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 })
  }
}
