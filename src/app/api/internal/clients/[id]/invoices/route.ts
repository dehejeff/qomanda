import { NextRequest, NextResponse } from 'next/server'
import { StaffAuthError, requireStaff } from '@/lib/staff-auth'
import { fetchClientDetail } from '@/lib/internal-clients'

type RouteParams = { params: Promise<{ id: string }> }

export async function GET(_req: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params
    const { admin } = await requireStaff()
    const { data: invoices, error } = await admin
      .from('billing_invoices')
      .select('*')
      .eq('restaurant_id', id)
      .order('created_at', { ascending: false })

    if (error) throw error
    return NextResponse.json({ invoices: invoices ?? [] })
  } catch (err) {
    if (err instanceof StaffAuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    console.error('[Internal invoices GET]', err)
    return NextResponse.json({ error: 'Erro ao listar faturas.' }, { status: 500 })
  }
}

type CreateInvoiceBody = {
  periodStart?: string
  periodEnd?: string
  amount?: number
  dueDate?: string
  status?: 'draft' | 'sent' | 'paid' | 'overdue'
  notes?: string
  markPaid?: boolean
}

export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params
    const { admin, user } = await requireStaff()
    const body = (await req.json()) as CreateInvoiceBody

    const client = await fetchClientDetail(admin, id)
    if (!client) return NextResponse.json({ error: 'Cliente não encontrado.' }, { status: 404 })

    const amount = body.amount ?? client.monthly_fee
    if (amount == null || amount < 0) {
      return NextResponse.json({ error: 'Valor da fatura inválido.' }, { status: 400 })
    }

    const now = new Date()
    const periodStart = body.periodStart ?? new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10)
    const periodEnd = body.periodEnd ?? new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10)
    const dueDate = body.dueDate ?? periodEnd
    const status = body.markPaid ? 'paid' : (body.status ?? 'sent')

    const { data: invoice, error } = await admin
      .from('billing_invoices')
      .insert({
        restaurant_id: id,
        subscription_id: client.subscription?.id ?? null,
        period_start: periodStart,
        period_end: periodEnd,
        amount,
        status,
        due_date: dueDate,
        paid_at: body.markPaid ? now.toISOString() : null,
        notes: body.notes?.trim() || null,
        created_by: user.id !== 'dev-staff' ? user.id : null,
      })
      .select('*')
      .single()

    if (error) throw error
    return NextResponse.json({ ok: true, invoice }, { status: 201 })
  } catch (err) {
    if (err instanceof StaffAuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    console.error('[Internal invoices POST]', err)
    return NextResponse.json({ error: 'Erro ao gerar fatura.' }, { status: 500 })
  }
}
