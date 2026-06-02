import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { loadPublicPaymentConfig } from '@/lib/restaurant-payment-config'

/**
 * GET /api/public/payment-config?restaurantId=...
 * Configuração pública de pagamento (sem credenciais sensíveis).
 */
export async function GET(req: NextRequest) {
  try {
    const restaurantId = req.nextUrl.searchParams.get('restaurantId')
    if (!restaurantId) {
      return NextResponse.json({ error: 'Restaurante inválido.' }, { status: 400 })
    }

    const admin = createAdminClient()
    const config = await loadPublicPaymentConfig(admin, restaurantId)

    return NextResponse.json(config)
  } catch (err) {
    console.error('[Public payment config]', err)
    return NextResponse.json({ error: 'Erro ao carregar pagamentos.' }, { status: 500 })
  }
}
