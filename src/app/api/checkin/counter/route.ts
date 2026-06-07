import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { upsertCustomerRecord } from '@/lib/customer-upsert'
import { whatsappForStorage } from '@/lib/customer-lookup'
import { isValidLoginPin } from '@/lib/customer-pin-shared'

export type CounterCheckInRequest = {
  slug: string
  firstName?: string
  lastName?: string
  whatsapp?: string
  pin?: string
  customerId?: string
  documentType?: 'cpf' | 'passport' | null
  cpf?: string | null
}

export type CounterCheckInResponse = {
  sessionId: string
  customerId: string
}

/** Check-in balcão — sem QR de mesa. */
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as CounterCheckInRequest
    const { slug, pin, customerId: quickCustomerId, documentType, cpf } = body
    let { firstName, lastName, whatsapp } = body

    if (!slug) {
      return NextResponse.json({ error: 'Restaurante inválido.' }, { status: 400 })
    }

    const supabase = createAdminClient()

    const { data: restaurant } = await supabase
      .from('restaurants')
      .select('id, operational_mode')
      .eq('slug', slug)
      .eq('status', 'active')
      .single()

    if (!restaurant) {
      return NextResponse.json({ error: 'Restaurante não encontrado.' }, { status: 404 })
    }

    if (restaurant.operational_mode === 'dine_in') {
      return NextResponse.json({ error: 'Balcão não disponível neste estabelecimento.' }, { status: 403 })
    }

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
      lastName = existing.last_name
      whatsapp = existing.whatsapp
    } else if (!firstName || !lastName || !whatsapp) {
      return NextResponse.json({ error: 'Campos obrigatórios ausentes.' }, { status: 400 })
    } else if (!pin || !isValidLoginPin(pin)) {
      return NextResponse.json({ error: 'Informe um PIN de 4 dígitos.' }, { status: 400 })
    }

    if (!customerId) {
      customerId = await upsertCustomerRecord(supabase, {
        firstName: firstName!,
        lastName: lastName!,
        whatsapp: whatsappForStorage(whatsapp!),
        documentType: documentType ?? null,
        cpf: cpf ?? null,
        passport: null,
        pin: pin!,
      })
    }

    if (!customerId) {
      return NextResponse.json({ error: 'Erro ao identificar cliente.' }, { status: 500 })
    }

    // Mesa virtual de balcão
    let { data: counterTable } = await supabase
      .from('tables')
      .select('id')
      .eq('restaurant_id', restaurant.id)
      .eq('number', 'BALCAO')
      .maybeSingle()

    if (!counterTable) {
      const { data: created } = await supabase
        .from('tables')
        .insert({
          restaurant_id: restaurant.id,
          number: 'BALCAO',
          status: 'occupied',
        })
        .select('id')
        .single()
      counterTable = created
    }

    if (!counterTable) {
      return NextResponse.json({ error: 'Erro ao preparar balcão.' }, { status: 500 })
    }

    const { data: newSession, error: sessionError } = await supabase
      .from('sessions')
      .insert({
        table_id: counterTable.id,
        restaurant_id: restaurant.id,
        customer_id: customerId,
        status: 'open',
        service_mode: 'counter',
      })
      .select('id')
      .single()

    if (sessionError || !newSession) {
      return NextResponse.json({ error: 'Erro ao criar sessão.' }, { status: 500 })
    }

    await supabase.from('session_participants').upsert(
      { session_id: newSession.id, customer_id: customerId },
      { onConflict: 'session_id,customer_id' },
    )

    // 1 visita por CLIENTE por sessão (mesas compartilhadas).
    const { error: visitError } = await supabase.from('customer_visits').upsert(
      { customer_id: customerId, restaurant_id: restaurant.id, session_id: newSession.id },
      { onConflict: 'customer_id,session_id' },
    )
    if (visitError) console.error('[Counter check-in] Falha ao registrar visita:', visitError.message)

    return NextResponse.json({
      sessionId: newSession.id,
      customerId,
    } satisfies CounterCheckInResponse)
  } catch (err) {
    console.error('[Counter check-in]', err)
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 })
  }
}
