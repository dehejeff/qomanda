import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export type RestaurantProfileDto = {
  id: string
  name: string
  slug: string
  logoUrl: string | null
  phone: string | null
  address: string | null
}

/**
 * GET /api/dashboard/profile
 * Retorna o perfil básico do restaurante autenticado.
 */
export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })

    const { data } = await supabase
      .from('restaurants')
      .select('id, name, slug, logo_url, phone, address')
      .eq('owner_id', user.id)
      .single()

    if (!data) return NextResponse.json({ error: 'Restaurante não encontrado.' }, { status: 404 })

    const dto: RestaurantProfileDto = {
      id: data.id,
      name: data.name,
      slug: data.slug,
      logoUrl: data.logo_url ?? null,
      phone: data.phone ?? null,
      address: data.address ?? null,
    }
    return NextResponse.json({ profile: dto })
  } catch (err) {
    console.error('[Profile GET]', err)
    return NextResponse.json({ error: 'Erro ao carregar perfil.' }, { status: 500 })
  }
}

/**
 * PATCH /api/dashboard/profile
 * Atualiza nome e telefone do restaurante.
 */
export async function PATCH(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })

    const body = await req.json() as { name?: string; phone?: string; address?: string }

    const patch: Record<string, string> = {}
    if (body.name?.trim()) patch.name = body.name.trim()
    if (body.phone !== undefined) patch.phone = body.phone.trim()
    if (body.address !== undefined) patch.address = body.address.trim()

    if (Object.keys(patch).length === 0) {
      return NextResponse.json({ error: 'Nenhum campo para atualizar.' }, { status: 400 })
    }

    const admin = createAdminClient()
    const { data: restaurant } = await admin
      .from('restaurants').select('id').eq('owner_id', user.id).single()
    if (!restaurant) return NextResponse.json({ error: 'Restaurante não encontrado.' }, { status: 404 })

    const { error } = await admin.from('restaurants').update(patch).eq('id', restaurant.id)
    if (error) throw error

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[Profile PATCH]', err)
    return NextResponse.json({ error: 'Erro ao salvar.' }, { status: 500 })
  }
}
