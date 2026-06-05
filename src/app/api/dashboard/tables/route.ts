import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireOwnerAccess, RestaurantAuthError } from '@/lib/restaurant-auth'
import { getRestaurantPlanLimits } from '@/lib/plan-limits'
import { nextTableNumber } from '@/lib/sort-tables'

export async function GET() {
  try {
    const access = await requireOwnerAccess()
    const admin = createAdminClient()
    const limits = await getRestaurantPlanLimits(admin, access.restaurantId)
    return NextResponse.json(limits)
  } catch (err) {
    if (err instanceof RestaurantAuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    console.error('[Tables GET limits]', err)
    return NextResponse.json({ error: 'Erro ao carregar limites.' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const access = await requireOwnerAccess()
    const admin = createAdminClient()

    const body = await req.json().catch(() => ({})) as { number?: string; kind?: 'table' | 'counter' }
    const kind = body.kind === 'counter' ? 'counter' : 'table'

    // Balcão: "mesa" especial (number = BALCAO). Só faz sentido se o modelo
    // inclui balcão; no modo apenas-mesas (dine_in) é bloqueado.
    if (kind === 'counter') {
      if (access.operationalMode === 'dine_in') {
        return NextResponse.json({ error: 'Balcão indisponível no modo apenas mesas.' }, { status: 400 })
      }
      const { data: existing } = await admin
        .from('tables')
        .select('*')
        .eq('restaurant_id', access.restaurantId)
        .eq('number', 'BALCAO')
        .maybeSingle()
      if (existing) return NextResponse.json({ table: existing }, { status: 200 })

      const { data: created, error: counterErr } = await admin
        .from('tables')
        .insert({ restaurant_id: access.restaurantId, number: 'BALCAO', status: 'free' })
        .select()
        .single()
      if (counterErr) return NextResponse.json({ error: 'Erro ao adicionar balcão.' }, { status: 400 })
      return NextResponse.json({ table: created }, { status: 201 })
    }

    const limits = await getRestaurantPlanLimits(admin, access.restaurantId)

    if (!limits.canAddTable) {
      return NextResponse.json({
        error: `Limite de mesas do plano ${limits.planName} (${limits.maxTables}) atingido.`,
        code: 'TABLE_LIMIT_REACHED',
        planId: limits.planId,
        planName: limits.planName,
        maxTables: limits.maxTables,
        currentTableCount: limits.currentTableCount,
      }, { status: 403 })
    }

    let tableNumber = body.number?.trim()

    if (!tableNumber) {
      const { data: existing } = await admin
        .from('tables')
        .select('number')
        .eq('restaurant_id', access.restaurantId)
      tableNumber = nextTableNumber(existing ?? [])
    }

    const { data, error } = await admin
      .from('tables')
      .insert({
        restaurant_id: access.restaurantId,
        number: tableNumber,
        status: 'free',
      })
      .select()
      .single()

    if (error) {
      const msg = error.code === '23505' ? 'Número de mesa já existe.' : 'Erro ao criar mesa.'
      return NextResponse.json({ error: msg }, { status: 400 })
    }

    return NextResponse.json({ table: data }, { status: 201 })
  } catch (err) {
    if (err instanceof RestaurantAuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    console.error('[Tables POST]', err)
    return NextResponse.json({ error: 'Erro ao criar mesa.' }, { status: 500 })
  }
}
