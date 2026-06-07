import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { ensureCouvertMenuItem } from '@/lib/couvert'

export type CouvertConfigDto = {
  couvertEnabled: boolean
  couvertPrice: number | null
  couvertLabel: string
  artisticoEnabled: boolean
  artisticoPrice: number | null
  artisticoLabel: string | null
  artisticoDays: number[]
  artisticoStartTime: string | null
  artisticoEndTime: string | null
}

const COUVERT_COLS =
  'couvert_enabled, couvert_price, couvert_label, couvert_artistico_enabled, couvert_artistico_price, couvert_artistico_label, couvert_artistico_days, couvert_artistico_start_time, couvert_artistico_end_time'

function toDto(r: Record<string, unknown>): CouvertConfigDto {
  return {
    couvertEnabled: Boolean(r.couvert_enabled),
    couvertPrice: r.couvert_price != null ? Number(r.couvert_price) : null,
    couvertLabel: (r.couvert_label as string) ?? 'Couvert',
    artisticoEnabled: Boolean(r.couvert_artistico_enabled),
    artisticoPrice: r.couvert_artistico_price != null ? Number(r.couvert_artistico_price) : null,
    artisticoLabel: (r.couvert_artistico_label as string) ?? null,
    artisticoDays: Array.isArray(r.couvert_artistico_days) ? (r.couvert_artistico_days as number[]) : [],
    artisticoStartTime: (r.couvert_artistico_start_time as string) ?? null,
    artisticoEndTime: (r.couvert_artistico_end_time as string) ?? null,
  }
}

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })

    const { data } = await supabase
      .from('restaurants')
      .select(COUVERT_COLS)
      .eq('owner_id', user.id)
      .single()
    if (!data) return NextResponse.json({ error: 'Restaurante não encontrado.' }, { status: 404 })

    return NextResponse.json({ config: toDto(data) })
  } catch (err) {
    console.error('[couvert GET]', err)
    return NextResponse.json({ error: 'Erro ao carregar.' }, { status: 500 })
  }
}

type PatchBody = Partial<{
  couvertEnabled: boolean
  couvertPrice: number | null
  couvertLabel: string
  artisticoEnabled: boolean
  artisticoPrice: number | null
  artisticoLabel: string | null
  artisticoDays: number[]
  artisticoStartTime: string | null
  artisticoEndTime: string | null
}>

function cleanTime(v: string | null | undefined): string | null {
  if (!v) return null
  return /^\d{2}:\d{2}(:\d{2})?$/.test(v) ? v : null
}

export async function PATCH(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })

    const body = (await req.json()) as PatchBody

    const admin = createAdminClient()
    const { data: restaurant } = await admin
      .from('restaurants').select('id').eq('owner_id', user.id).single()
    if (!restaurant) return NextResponse.json({ error: 'Restaurante não encontrado.' }, { status: 404 })

    const patch: Record<string, unknown> = {}
    if (body.couvertEnabled !== undefined) patch.couvert_enabled = Boolean(body.couvertEnabled)
    if (body.couvertPrice !== undefined) patch.couvert_price = body.couvertPrice != null ? Math.max(0, Number(body.couvertPrice)) : null
    if (body.couvertLabel !== undefined) patch.couvert_label = body.couvertLabel.trim() || 'Couvert'
    if (body.artisticoEnabled !== undefined) patch.couvert_artistico_enabled = Boolean(body.artisticoEnabled)
    if (body.artisticoPrice !== undefined) patch.couvert_artistico_price = body.artisticoPrice != null ? Math.max(0, Number(body.artisticoPrice)) : null
    if (body.artisticoLabel !== undefined) patch.couvert_artistico_label = body.artisticoLabel?.trim() || null
    if (body.artisticoDays !== undefined) {
      patch.couvert_artistico_days = Array.isArray(body.artisticoDays)
        ? [...new Set(body.artisticoDays.filter(d => Number.isInteger(d) && d >= 0 && d <= 6))].sort()
        : []
    }
    if (body.artisticoStartTime !== undefined) patch.couvert_artistico_start_time = cleanTime(body.artisticoStartTime)
    if (body.artisticoEndTime !== undefined) patch.couvert_artistico_end_time = cleanTime(body.artisticoEndTime)

    if (Object.keys(patch).length === 0) {
      return NextResponse.json({ error: 'Nenhum campo para atualizar.' }, { status: 400 })
    }

    const { error } = await admin.from('restaurants').update(patch).eq('id', restaurant.id)
    if (error) throw error

    // Sincroniza os itens de sistema (nome/preço) quando habilitado e com preço.
    const { data: fresh } = await admin
      .from('restaurants').select(COUVERT_COLS).eq('id', restaurant.id).single()
    if (fresh) {
      if (fresh.couvert_enabled && Number(fresh.couvert_price) > 0) {
        await ensureCouvertMenuItem(admin, restaurant.id, 'couvert', Number(fresh.couvert_price), fresh.couvert_label as string)
      }
      if (fresh.couvert_artistico_enabled && Number(fresh.couvert_artistico_price) > 0) {
        await ensureCouvertMenuItem(admin, restaurant.id, 'artistico', Number(fresh.couvert_artistico_price), fresh.couvert_artistico_label as string)
      }
    }

    return NextResponse.json({ ok: true, config: fresh ? toDto(fresh) : null })
  } catch (err) {
    console.error('[couvert PATCH]', err)
    return NextResponse.json({ error: 'Erro ao salvar.' }, { status: 500 })
  }
}
