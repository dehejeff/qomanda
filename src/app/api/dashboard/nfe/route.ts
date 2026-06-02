import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireOwnerAccess, RestaurantAuthError } from '@/lib/restaurant-auth'

export type NfeInvoiceDto = {
  id: string
  paymentId: string | null
  noteType: 'nfce' | 'nfse'
  status: string
  amount: number
  number: string | null
  danfeUrl: string | null
  environment: string
  whatsappSentAt: string | null
  errorMessage: string | null
  createdAt: string
  customerName: string | null
}

/**
 * GET /api/dashboard/nfe — últimas notas fiscais emitidas do restaurante.
 */
export async function GET() {
  try {
    const access = await requireOwnerAccess()
    const admin = createAdminClient()

    const { data, error } = await admin
      .from('nfe_invoices')
      .select('id, payment_id, note_type, status, amount, number, danfe_url, environment, whatsapp_sent_at, error_message, created_at, customer:customers(first_name, last_name)')
      .eq('restaurant_id', access.restaurantId)
      .order('created_at', { ascending: false })
      .limit(100)

    if (error) throw error

    const invoices: NfeInvoiceDto[] = (data ?? []).map(row => {
      const c = Array.isArray(row.customer) ? row.customer[0] : row.customer
      const name = c ? `${c.first_name ?? ''} ${c.last_name ?? ''}`.trim() || null : null
      return {
        id: row.id,
        paymentId: row.payment_id,
        noteType: row.note_type,
        status: row.status,
        amount: Number(row.amount),
        number: row.number,
        danfeUrl: row.danfe_url,
        environment: row.environment,
        whatsappSentAt: row.whatsapp_sent_at,
        errorMessage: row.error_message,
        createdAt: row.created_at,
        customerName: name,
      }
    })

    return NextResponse.json({ invoices })
  } catch (err) {
    if (err instanceof RestaurantAuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    console.error('[NFe list]', err)
    return NextResponse.json({ error: 'Erro ao carregar notas.' }, { status: 500 })
  }
}
