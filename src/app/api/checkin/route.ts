import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export type CheckInRequest = {
  slug: string
  mesa: string
  firstName: string
  lastName: string
  whatsapp: string        // dígitos apenas
  documentType?: 'cpf' | 'passport' | null
  cpf?: string | null     // 11 dígitos, sem formatação
  passport?: string | null
}

export type CheckInResponse = {
  sessionId: string
  customerId: string
  isJoining: boolean      // true = entrou em sessão existente
}

export async function POST(req: NextRequest) {
  try {
    const body: CheckInRequest = await req.json()
    const { slug, mesa, firstName, lastName, whatsapp, documentType, cpf, passport } = body

    if (!slug || !mesa || !firstName || !lastName || !whatsapp) {
      return NextResponse.json({ error: 'Campos obrigatórios ausentes.' }, { status: 400 })
    }

    const supabase = createAdminClient()

    // ── 1. Resolver restaurante ───────────────────────────────
    const { data: restaurant } = await supabase
      .from('restaurants')
      .select('id')
      .eq('slug', slug)
      .eq('status', 'active')
      .single()

    if (!restaurant) {
      return NextResponse.json({ error: 'Restaurante não encontrado.' }, { status: 404 })
    }

    // ── 2. Upsert do cliente ──────────────────────────────────
    // Estratégia: CPF primeiro (mais estável), fallback por WhatsApp
    let customerId: string | null = null

    if (documentType === 'cpf' && cpf && cpf.length === 11) {
      const { data: byCpf } = await supabase
        .from('customers')
        .select('id')
        .eq('cpf', cpf)
        .maybeSingle()

      if (byCpf) {
        await supabase
          .from('customers')
          .update({ first_name: firstName, last_name: lastName, whatsapp })
          .eq('id', byCpf.id)
        customerId = byCpf.id
      }
    }

    if (!customerId) {
      const payload: Record<string, unknown> = {
        first_name: firstName,
        last_name: lastName,
        whatsapp,
      }
      if (documentType === 'cpf' && cpf)           { payload.document_type = 'cpf';      payload.cpf = cpf }
      if (documentType === 'passport' && passport)  { payload.document_type = 'passport'; payload.passport = passport }

      const { data: customer, error } = await supabase
        .from('customers')
        .upsert(payload, { onConflict: 'whatsapp' })
        .select('id')
        .single()

      if (error || !customer) {
        return NextResponse.json({ error: 'Erro ao salvar dados do cliente.' }, { status: 500 })
      }
      customerId = customer.id
    }

    // ── 3. Resolver mesa ─────────────────────────────────────
    const { data: table } = await supabase
      .from('tables')
      .select('id')
      .eq('restaurant_id', restaurant.id)
      .eq('number', mesa)
      .maybeSingle()

    if (!table) {
      return NextResponse.json({ error: 'Mesa não encontrada.' }, { status: 404 })
    }

    // ── 4. Sessão: entrar na existente ou criar nova ──────────
    const { data: existingSession } = await supabase
      .from('sessions')
      .select('id')
      .eq('table_id', table.id)
      .eq('status', 'open')
      .maybeSingle()

    let sessionId: string
    let isJoining = false

    if (existingSession) {
      sessionId = existingSession.id
      isJoining = true
    } else {
      const { data: newSession, error: sessionError } = await supabase
        .from('sessions')
        .insert({
          table_id: table.id,
          restaurant_id: restaurant.id,
          customer_id: customerId,
          status: 'open',
        })
        .select('id')
        .single()

      if (sessionError || !newSession) {
        return NextResponse.json({ error: 'Erro ao criar sessão.' }, { status: 500 })
      }
      sessionId = newSession.id
    }

    // ── 5. Registrar participante ────────────────────────────
    await supabase
      .from('session_participants')
      .upsert(
        { session_id: sessionId, customer_id: customerId },
        { onConflict: 'session_id,customer_id' }
      )

    // ── 6. Registrar visita (fidelidade) ─────────────────────
    await supabase
      .from('customer_visits')
      .upsert(
        { customer_id: customerId, restaurant_id: restaurant.id, session_id: sessionId },
        { onConflict: 'session_id' }
      )

    return NextResponse.json({ sessionId, customerId: customerId!, isJoining } satisfies CheckInResponse)
  } catch (err) {
    console.error('[CheckIn API Error]', err)
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 })
  }
}
