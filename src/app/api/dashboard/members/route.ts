import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireOwnerAccess, RestaurantAuthError } from '@/lib/restaurant-auth'

export async function GET() {
  try {
    const access = await requireOwnerAccess()
    const admin = createAdminClient()

    const { data, error } = await admin
      .from('restaurant_members')
      .select('id, email, name, role, active, created_at')
      .eq('restaurant_id', access.restaurantId)
      .order('created_at')

    if (error) throw error
    return NextResponse.json({ members: data ?? [] })
  } catch (err) {
    if (err instanceof RestaurantAuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    return NextResponse.json({ error: 'Erro ao listar equipe.' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const access = await requireOwnerAccess()
    const body = await req.json() as { email?: string; name?: string; role?: string }

    const email = body.email?.trim().toLowerCase()
    if (!email) {
      return NextResponse.json({ error: 'E-mail obrigatório.' }, { status: 400 })
    }

    const role = body.role ?? 'waiter'
    if (!['waiter', 'kitchen', 'manager'].includes(role)) {
      return NextResponse.json({ error: 'Perfil inválido.' }, { status: 400 })
    }

    const admin = createAdminClient()
    const { data, error } = await admin
      .from('restaurant_members')
      .upsert({
        restaurant_id: access.restaurantId,
        email,
        name: body.name?.trim() || null,
        role,
        active: true,
      }, { onConflict: 'restaurant_id,email' })
      .select('id, email, name, role, active, created_at')
      .single()

    if (error) {
      return NextResponse.json({ error: 'Erro ao adicionar membro.' }, { status: 400 })
    }

    return NextResponse.json({ ok: true, member: data })
  } catch (err) {
    if (err instanceof RestaurantAuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    return NextResponse.json({ error: 'Erro ao salvar membro.' }, { status: 500 })
  }
}
