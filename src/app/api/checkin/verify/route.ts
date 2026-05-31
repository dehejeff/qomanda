import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export type CheckInVerifyResponse = {
  valid: boolean
  tableNumber?: string
  tableStatus?: string
  restaurantName?: string
  error?: string
}

/**
 * GET /api/checkin/verify?slug=&mesa=&t=
 * Valida token do QR antes de exibir check-in.
 */
export async function GET(req: NextRequest) {
  const slug = req.nextUrl.searchParams.get('slug')
  const mesa = req.nextUrl.searchParams.get('mesa')
  const token = req.nextUrl.searchParams.get('t')

  if (!slug || !mesa || !token) {
    return NextResponse.json({
      valid: false,
      error: 'Escaneie o QR Code da mesa para continuar.',
    } satisfies CheckInVerifyResponse)
  }

  const supabase = createAdminClient()

  const { data: restaurant } = await supabase
    .from('restaurants')
    .select('id, name')
    .eq('slug', slug)
    .eq('status', 'active')
    .single()

  if (!restaurant) {
    return NextResponse.json({ valid: false, error: 'Restaurante não encontrado.' } satisfies CheckInVerifyResponse)
  }

  const { data: table, error } = await supabase
    .from('tables')
    .select('number, status, check_in_token')
    .eq('restaurant_id', restaurant.id)
    .eq('number', mesa)
    .maybeSingle()

  if (error?.message?.includes('check_in_token')) {
    return NextResponse.json({
      valid: false,
      error: 'Sistema de mesas desatualizado. Peça ao restaurante para aplicar a migração de tokens.',
    } satisfies CheckInVerifyResponse)
  }

  if (!table || table.check_in_token !== token) {
    return NextResponse.json({
      valid: false,
      error: 'QR Code inválido ou mesa incorreta. Escaneie o código na mesa.',
    } satisfies CheckInVerifyResponse)
  }

  return NextResponse.json({
    valid: true,
    tableNumber: table.number,
    tableStatus: table.status,
    restaurantName: restaurant.name,
  } satisfies CheckInVerifyResponse)
}
