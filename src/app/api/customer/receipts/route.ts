import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  fetchCustomerReceipts,
  groupReceiptsByRestaurant,
  groupReceiptsByDay,
} from '@/lib/customer-receipts-server'

/**
 * GET /api/customer/receipts?customer=UUID[&slug=...&date=YYYY-MM-DD]
 */
export async function GET(req: NextRequest) {
  const customerId = req.nextUrl.searchParams.get('customer')
  const slug = req.nextUrl.searchParams.get('slug')
  const date = req.nextUrl.searchParams.get('date')

  if (!customerId) {
    return NextResponse.json({ error: 'customer obrigatório.' }, { status: 400 })
  }

  try {
    const supabase = createAdminClient()
    const receipts = await fetchCustomerReceipts(supabase, customerId)

    if (slug) {
      const detail = groupReceiptsByDay(receipts, slug, date ?? undefined)
      if (!detail) {
        return NextResponse.json({ error: 'Restaurante não encontrado.' }, { status: 404 })
      }
      return NextResponse.json(detail)
    }

    const restaurants = groupReceiptsByRestaurant(receipts)
    return NextResponse.json({
      totalReceipts: receipts.length,
      restaurants,
    })
  } catch (err) {
    console.error('[Customer Receipts Error]', err)
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 })
  }
}
