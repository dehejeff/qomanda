import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireOwnerAccess, RestaurantAuthError } from '@/lib/restaurant-auth'
import { previewRestaurantMonthlyBill } from '@/lib/commission-billing'
import { COMMISSION_TIERS, SETUP_FEE_PILOT } from '@/lib/commission-tiers'
import { fetchPlanChangeHistory, type PlanChangeDto } from '@/lib/plan-change-history'

export type { PlanChangeDto }

export type BillingInvoiceDto = {
  id: string
  periodStart: string
  periodEnd: string
  periodYear: number | null
  periodMonth: number | null
  amount: number
  status: string
  dueDate: string | null
  paidAt: string | null
  notes: string | null
  invoiceUrl: string | null
  chargeMethod: string | null
  createdAt: string
}

export type BillingSubscriptionDto = {
  planId: string
  planName: string
  monthlyFee: number
  maxTables: number | null
  status: string
  trialEndsAt: string | null
  currentPeriodEnd: string | null
}

function mapInvoice(row: Record<string, unknown>): BillingInvoiceDto {
  return {
    id: String(row.id),
    periodStart: String(row.period_start),
    periodEnd: String(row.period_end),
    periodYear: row.period_year != null ? Number(row.period_year) : null,
    periodMonth: row.period_month != null ? Number(row.period_month) : null,
    amount: Number(row.amount),
    status: String(row.status),
    dueDate: row.due_date ? String(row.due_date) : null,
    paidAt: row.paid_at ? String(row.paid_at) : null,
    notes: row.notes ? String(row.notes) : null,
    invoiceUrl: row.invoice_url ? String(row.invoice_url) : null,
    chargeMethod: row.charge_method ? String(row.charge_method) : null,
    createdAt: String(row.created_at),
  }
}

export async function GET() {
  try {
    const access = await requireOwnerAccess()
    const admin = createAdminClient()

    const now = new Date()
    const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    const year = prev.getFullYear()
    const month = prev.getMonth() + 1

    const [currentMonth, previousMonth, restaurantRes, invoicesRes, planChanges] = await Promise.all([
      previewRestaurantMonthlyBill(admin, access.restaurantId, now.getFullYear(), now.getMonth() + 1),
      previewRestaurantMonthlyBill(admin, access.restaurantId, year, month),
      admin
        .from('restaurants')
        .select(`
          plan_id,
          subscription:restaurant_subscriptions (
            status, trial_ends_at, current_period_end, monthly_fee_override,
            plan:plans ( id, name, monthly_fee, max_tables )
          )
        `)
        .eq('id', access.restaurantId)
        .single(),
      admin
        .from('billing_invoices')
        .select(`
          id, period_start, period_end, period_year, period_month,
          amount, status, due_date, paid_at, notes, invoice_url, charge_method, created_at
        `)
        .eq('restaurant_id', access.restaurantId)
        .order('period_start', { ascending: false })
        .limit(24),
      fetchPlanChangeHistory(admin, access.restaurantId),
    ])

    const subRaw = restaurantRes.data?.subscription
    const sub = Array.isArray(subRaw) ? subRaw[0] : subRaw
    const planRaw = (sub as { plan?: unknown } | null)?.plan
    const plan = (Array.isArray(planRaw) ? planRaw[0] : planRaw) as {
      id?: string
      name?: string
      monthly_fee?: number
      max_tables?: number
    } | null

    const monthlyFee = Number(
      (sub as { monthly_fee_override?: number } | null)?.monthly_fee_override
      ?? plan?.monthly_fee
      ?? 199,
    )

    const subscription: BillingSubscriptionDto | null = sub
      ? {
          planId: plan?.id ?? restaurantRes.data?.plan_id ?? 'starter',
          planName: plan?.name ?? 'Starter',
          monthlyFee,
          maxTables: plan?.max_tables ?? null,
          status: String((sub as { status?: string }).status ?? 'trialing'),
          trialEndsAt: (sub as { trial_ends_at?: string | null }).trial_ends_at ?? null,
          currentPeriodEnd: (sub as { current_period_end?: string | null }).current_period_end ?? null,
        }
      : null

    const invoices = (invoicesRes.data ?? []).map(row => mapInvoice(row as Record<string, unknown>))
    const openInvoice = invoices.find(inv =>
      (inv.status === 'sent' || inv.status === 'overdue') && inv.amount > 0,
    ) ?? null

    return NextResponse.json({
      setupFeePilot: SETUP_FEE_PILOT,
      commissionTiers: COMMISSION_TIERS,
      currentMonth,
      previousMonth,
      billingDay: 5,
      model: 'restaurant_account',
      subscription,
      invoices,
      openInvoice,
      planChanges,
      note: 'Pagamentos digitais caem 100% na sua conta. Mensalidade + comissão faturadas todo dia 5.',
    })
  } catch (err) {
    if (err instanceof RestaurantAuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    console.error('[Billing preview]', err)
    return NextResponse.json({ error: 'Erro ao carregar faturamento.' }, { status: 500 })
  }
}
