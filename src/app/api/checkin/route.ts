import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { upsertCustomerRecord } from '@/lib/customer-upsert'
import { whatsappForStorage } from '@/lib/customer-lookup'
import { isValidLoginPin } from '@/lib/customer-pin-shared'

export type CheckInRequest = {
  slug: string
  mesa: string
  tableToken: string
  firstName?: string
  lastName?: string
  whatsapp?: string        // dígitos apenas
  documentType?: 'cpf' | 'passport' | null
  cpf?: string | null     // 11 dígitos, sem formatação
  passport?: string | null
  pin?: string        // 4 dígitos — obrigatório no cadastro na mesa
  customerId?: string     // check-in rápido para clientes recorrentes
}

export type CheckInResponse = {
  sessionId: string
  customerId: string
  isJoining: boolean      // true = entrou em sessão existente
}

export async function POST(req: NextRequest) {
  try {
    const body: CheckInRequest = await req.json()
    const { slug, mesa, tableToken, documentType, cpf, passport, pin, customerId: quickCustomerId } = body
    let { firstName, lastName, whatsapp } = body

    if (!slug || !mesa || !tableToken) {
      return NextResponse.json({ error: 'Check-in requer QR Code válido da mesa.' }, { status: 400 })
    }

    const supabase = createAdminClient()

    // ── Check-in rápido (cliente já cadastrado) ───────────────
    let customerId: string | null = quickCustomerId ?? null

    if (customerId) {
      const { data: existing } = await supabase
        .from('customers')
        .select('id, first_name, last_name, whatsapp')
        .eq('id', customerId)
        .single()

      if (!existing) {
        return NextResponse.json({ error: 'Cliente não encontrado.' }, { status: 404 })
      }

      firstName = existing.first_name
      lastName  = existing.last_name
      whatsapp  = existing.whatsapp
    } else if (!firstName || !lastName || !whatsapp) {
      return NextResponse.json({ error: 'Campos obrigatórios ausentes.' }, { status: 400 })
    } else if (!pin || !isValidLoginPin(pin)) {
      return NextResponse.json({ error: 'Informe um PIN de 4 dígitos.' }, { status: 400 })
    }

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
    if (!customerId) {
      customerId = await upsertCustomerRecord(supabase, {
        firstName: firstName!,
        lastName: lastName!,
        whatsapp: whatsappForStorage(whatsapp!),
        documentType,
        cpf: cpf ?? null,
        passport: passport ?? null,
        pin: pin!,
      })
    }

    if (!customerId) {
      return NextResponse.json({ error: 'Erro ao identificar cliente.' }, { status: 500 })
    }

    // ── 3. Resolver mesa (token do QR) ───────────────────────
    const { data: table, error: tableError } = await supabase
      .from('tables')
      .select('id, check_in_token')
      .eq('restaurant_id', restaurant.id)
      .eq('number', mesa)
      .maybeSingle()

    if (tableError?.message?.includes('check_in_token')) {
      return NextResponse.json({ error: 'Migração de tokens pendente no servidor.' }, { status: 503 })
    }

    if (!table || table.check_in_token !== tableToken) {
      return NextResponse.json({ error: 'QR Code inválido. Escaneie o código na mesa.' }, { status: 403 })
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
        { onConflict: 'session_id' },
      )

    return NextResponse.json({ sessionId, customerId: customerId!, isJoining } satisfies CheckInResponse)
  } catch (err) {
    console.error('[CheckIn API Error]', err)
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 })
  }
}
