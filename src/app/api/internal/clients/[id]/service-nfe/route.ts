import { NextRequest, NextResponse } from 'next/server'
import { StaffAuthError, requireStaff } from '@/lib/staff-auth'
import { emitServiceNfeForInvoice } from '@/lib/nfe/emit-service-nfe'
import { getQomandaFiscalConfig } from '@/lib/nfe/qomanda-fiscal'

type RouteParams = { params: Promise<{ id: string }> }

/** GET — lista as NF-e de serviço (Qomanda → restaurante) deste cliente. */
export async function GET(_req: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params
    const { admin } = await requireStaff()
    const { data, error } = await admin
      .from('service_nfe_invoices')
      .select('*')
      .eq('restaurant_id', id)
      .order('created_at', { ascending: false })

    if (error) throw error
    return NextResponse.json({ serviceNotes: data ?? [], simulated: !getQomandaFiscalConfig().hasCredentials })
  } catch (err) {
    if (err instanceof StaffAuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    console.error('[Internal service-nfe GET]', err)
    return NextResponse.json({ error: 'Erro ao listar notas de serviço.' }, { status: 500 })
  }
}

/** POST { billingInvoiceId } — emite manualmente a NF-e de serviço da fatura. */
export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params
    const { admin } = await requireStaff()
    const body = (await req.json().catch(() => ({}))) as { billingInvoiceId?: string }
    if (!body.billingInvoiceId) {
      return NextResponse.json({ error: 'billingInvoiceId é obrigatório.' }, { status: 400 })
    }

    // Garante que a fatura pertence a este restaurante (evita emissão cruzada).
    const { data: invoice } = await admin
      .from('billing_invoices')
      .select('id, restaurant_id')
      .eq('id', body.billingInvoiceId)
      .maybeSingle()
    if (!invoice || invoice.restaurant_id !== id) {
      return NextResponse.json({ error: 'Fatura não encontrada para este cliente.' }, { status: 404 })
    }

    const outcome = await emitServiceNfeForInvoice(admin, body.billingInvoiceId, { requirePaid: false })
    if (!outcome.emitted && outcome.reason && outcome.reason !== 'already_emitted') {
      return NextResponse.json({ ok: false, ...outcome }, { status: 422 })
    }
    return NextResponse.json({ ok: true, ...outcome })
  } catch (err) {
    if (err instanceof StaffAuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    console.error('[Internal service-nfe POST]', err)
    return NextResponse.json({ error: 'Erro ao emitir nota de serviço.' }, { status: 500 })
  }
}
