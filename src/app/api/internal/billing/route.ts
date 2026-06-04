import { NextRequest, NextResponse } from 'next/server'
import { StaffAuthError, requireStaff } from '@/lib/staff-auth'
import { fetchInternalBilling } from '@/lib/internal-billing'
import { generateMonthlyInvoice, chargeInvoice, type SaasBillingType } from '@/lib/monthly-billing'
import { brToday } from '@/lib/date-tz'

export async function GET() {
  try {
    const { admin } = await requireStaff()
    const data = await fetchInternalBilling(admin)
    return NextResponse.json(data)
  } catch (err) {
    if (err instanceof StaffAuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    console.error('[Internal billing GET]', err)
    return NextResponse.json({ error: 'Erro ao carregar cobrança.' }, { status: 500 })
  }
}

type Body = {
  action?: 'generate' | 'charge' | 'mark_paid'
  restaurantId?: string
  invoiceId?: string
  billingType?: SaasBillingType
}

export async function POST(req: NextRequest) {
  try {
    const { admin } = await requireStaff()
    const body = (await req.json().catch(() => ({}))) as Body
    const billingType: SaasBillingType = body.billingType === 'PIX' ? 'PIX' : 'BOLETO'

    if (body.action === 'generate') {
      if (!body.restaurantId) return NextResponse.json({ error: 'restaurantId obrigatório.' }, { status: 400 })
      const [year, month] = brToday().split('-').map(Number)
      const gen = await generateMonthlyInvoice(admin, body.restaurantId, { year, month, charge: true, billingType })
      if (!gen.ok || !gen.invoiceId) {
        return NextResponse.json({ error: reasonLabel(gen.reason) }, { status: 422 })
      }
      // Fatura já existia sem cobrança → emite a cobrança agora.
      let invoiceUrl: string | null = null
      if (!gen.charged) {
        const ch = await chargeInvoice(admin, gen.invoiceId, billingType)
        invoiceUrl = ch.invoiceUrl ?? null
      }
      return NextResponse.json({ ok: true, invoiceId: gen.invoiceId, invoiceUrl })
    }

    if (body.action === 'charge') {
      if (!body.invoiceId) return NextResponse.json({ error: 'invoiceId obrigatório.' }, { status: 400 })
      const ch = await chargeInvoice(admin, body.invoiceId, billingType)
      if (!ch.ok) return NextResponse.json({ error: reasonLabel(ch.reason) }, { status: 422 })
      return NextResponse.json({ ok: true, invoiceUrl: ch.invoiceUrl ?? null })
    }

    if (body.action === 'mark_paid') {
      if (!body.invoiceId) return NextResponse.json({ error: 'invoiceId obrigatório.' }, { status: 400 })
      const { error } = await admin
        .from('billing_invoices')
        .update({ status: 'paid', paid_at: new Date().toISOString() })
        .eq('id', body.invoiceId)
        .neq('status', 'paid')
      if (error) return NextResponse.json({ error: 'Erro ao marcar como paga.' }, { status: 500 })
      // Pagamento registrado → emite NF-e de serviço (degradável/idempotente).
      const { emitServiceNfeForInvoice } = await import('@/lib/nfe/emit-service-nfe')
      await emitServiceNfeForInvoice(admin, body.invoiceId, { requirePaid: true })
      return NextResponse.json({ ok: true })
    }

    return NextResponse.json({ error: 'Ação inválida.' }, { status: 400 })
  } catch (err) {
    if (err instanceof StaffAuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    console.error('[Internal billing POST]', err)
    return NextResponse.json({ error: 'Erro ao processar cobrança.' }, { status: 500 })
  }
}

function reasonLabel(reason?: string): string {
  const map: Record<string, string> = {
    zero_amount: 'Fatura sem valor a cobrar.',
    restaurant_not_found: 'Restaurante não encontrado.',
    invoice_not_found: 'Fatura não encontrada.',
    already_paid: 'Fatura já está paga.',
    billing_customer_failed: 'Não foi possível criar o cliente no Asaas (verifique CNPJ/CPF).',
    db_insert_failed: 'Erro ao gravar a fatura.',
    exception: 'Erro inesperado ao gerar a cobrança.',
  }
  return (reason && map[reason]) ?? 'Não foi possível processar a cobrança.'
}
