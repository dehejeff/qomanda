import type { SupabaseClient } from '@supabase/supabase-js'
import { BUSINESS_PROFILE_SELECT, profileFromRow } from '@/lib/restaurant-profile'
import { nfeProfileFromRow } from '@/lib/restaurant-nfe'
import { whatsAppStatusFromRow } from '@/lib/restaurant-whatsapp'
import { fetchPlanChangeHistory } from '@/lib/plan-change-history'
import type {
  BillingInvoice,
  InternalClientDetail,
  InternalClientListItem,
  Plan,
  RestaurantSubscription,
  SubscriptionStatus,
} from '@/types/internal'

function mapDigitalStatus(walletId: string | null, onboarding: string | null): 'inactive' | 'pending' | 'active' {
  if (walletId && onboarding === 'approved') return 'active'
  if (walletId || onboarding === 'submitted') return 'pending'
  return 'inactive'
}

function effectiveMonthlyFee(sub: RestaurantSubscription | null, plan: Plan | null): number {
  if (sub?.monthly_fee_override != null) return Number(sub.monthly_fee_override)
  return plan ? Number(plan.monthly_fee) : 0
}

function effectiveFeePercent(sub: RestaurantSubscription | null, plan: Plan | null, restaurantPercent: number): number {
  if (sub?.platform_fee_percent_override != null) return Number(sub.platform_fee_percent_override)
  if (restaurantPercent > 0) return restaurantPercent
  return plan ? Number(plan.platform_fee_percent) : 0
}

export async function fetchPlans(admin: SupabaseClient): Promise<Plan[]> {
  const { data } = await admin
    .from('plans')
    .select('*')
    .eq('active', true)
    .order('display_order')
  return (data ?? []) as Plan[]
}

export async function fetchClientList(admin: SupabaseClient): Promise<InternalClientListItem[]> {
  const plans = await fetchPlans(admin)
  const plansById = new Map(plans.map(p => [p.id, p]))

  const { data: restaurants, error } = await admin
    .from('restaurants')
    .select(`
      id, name, slug, status, phone, plan_id, created_at, owner_id,
      platform_fee_percent, platform_fee_fixed,
      bank_account, payout_configured_at,
      asaas_wallet_id, asaas_onboarding_status,
      subscription:restaurant_subscriptions (
        id, plan_id, status, trial_ends_at, monthly_fee_override,
        platform_fee_percent_override, platform_fee_fixed_override,
        plan:plans ( id, name, monthly_fee, platform_fee_percent )
      )
    `)
    .order('created_at', { ascending: false })

  if (error) throw error
  if (!restaurants?.length) return []

  // Repara clientes legados sem assinatura/taxas (ex.: criados antes do portal interno)
  for (const r of restaurants) {
    const subRaw = Array.isArray(r.subscription) ? r.subscription[0] : r.subscription
    const needsRepair = !subRaw || !r.plan_id || Number(r.platform_fee_percent ?? 0) === 0
    if (needsRepair) {
      await ensureRestaurantBilling(admin, r.id, r.plan_id ?? 'starter')
    }
  }

  const { data: refreshed, error: refreshErr } = await admin
    .from('restaurants')
    .select(`
      id, name, slug, status, phone, plan_id, created_at, owner_id,
      platform_fee_percent, platform_fee_fixed,
      bank_account, payout_configured_at,
      asaas_wallet_id, asaas_onboarding_status,
      subscription:restaurant_subscriptions (
        id, plan_id, status, trial_ends_at, monthly_fee_override,
        platform_fee_percent_override, platform_fee_fixed_override,
        plan:plans ( id, name, monthly_fee, platform_fee_percent )
      )
    `)
    .order('created_at', { ascending: false })

  if (refreshErr) throw refreshErr
  const rows = refreshed ?? restaurants

  const ownerIds = [...new Set(rows.map(r => r.owner_id))]
  const ownerEmails = new Map<string, string>()
  for (const ownerId of ownerIds) {
    const { data: authUser } = await admin.auth.admin.getUserById(ownerId)
    if (authUser.user?.email) ownerEmails.set(ownerId, authUser.user.email)
  }

  const restaurantIds = rows.map(r => r.id)
  const { data: tableCounts } = await admin
    .from('tables')
    .select('restaurant_id')
    .in('restaurant_id', restaurantIds)
    .neq('number', 'BALCAO') // balcão não conta como mesa

  const countByRestaurant = new Map<string, number>()
  for (const row of tableCounts ?? []) {
    countByRestaurant.set(row.restaurant_id, (countByRestaurant.get(row.restaurant_id) ?? 0) + 1)
  }

  return rows.map(r => mapRestaurantRow(r as Record<string, unknown>, plansById, ownerEmails, countByRestaurant))
}

export async function fetchClientDetail(admin: SupabaseClient, id: string): Promise<InternalClientDetail | null> {
  await ensureRestaurantBilling(admin, id)

  const plans = await fetchPlans(admin)
  const plansById = new Map(plans.map(p => [p.id, p]))

  const { data: r, error } = await admin
    .from('restaurants')
    .select(`
      id, name, slug, status, phone, address, plan_id, created_at, owner_id,
      restaurant_model, operational_mode,
      platform_fee_percent, platform_fee_fixed,
      bank_account, payout_configured_at,
      asaas_wallet_id, asaas_onboarding_status,
      business_type, legal_name, document_type, document_number, company_type, owner_cpf,
      contact_email, address_postal_code, address_street, address_number, address_complement,
      address_neighborhood, address_city, address_state, estimated_monthly_revenue,
      nfe_enabled, nfe_status, nfe_provider, nfe_environment,
      nfe_provider_token_encrypted, nfe_provider_company_id,
      nfe_state_registration, nfe_municipal_registration, nfe_tax_regime, nfe_cnae,
      nfe_invoice_series, nfe_next_invoice_number,
      nfe_auto_emit, nfe_split_food_drinks, whatsapp_nfe_enabled,
      nfe_notes, nfe_configured_at,
      whatsapp_phone_id, whatsapp_access_token,
      subscription:restaurant_subscriptions (
        id, restaurant_id, plan_id, status, trial_ends_at,
        current_period_start, current_period_end,
        monthly_fee_override, platform_fee_percent_override, platform_fee_fixed_override,
        notes, created_at, updated_at,
        plan:plans (*)
      )
    `)
    .eq('id', id)
    .maybeSingle()

  if (error) throw error
  if (!r) return null

  const { data: authUser } = await admin.auth.admin.getUserById(r.owner_id)
  const { count: tablesCount } = await admin
    .from('tables')
    .select('*', { count: 'exact', head: true })
    .eq('restaurant_id', id)
    .neq('number', 'BALCAO') // balcão não conta como mesa

  const { data: invoices } = await admin
    .from('billing_invoices')
    .select('*')
    .eq('restaurant_id', id)
    .order('created_at', { ascending: false })
    .limit(12)

  const planChanges = await fetchPlanChangeHistory(admin, id)

  const subRaw = Array.isArray(r.subscription) ? r.subscription[0] : r.subscription
  const planRaw = subRaw?.plan
  const embeddedPlan = (Array.isArray(planRaw) ? planRaw[0] : planRaw) as Plan | null | undefined
  const subTyped = subRaw as unknown as RestaurantSubscription | null | undefined
  const plan = resolveClientPlan({ plan_id: r.plan_id }, subTyped, plansById)
  const sub = subRaw
    ? ({
        ...subRaw,
        plan: embeddedPlan ?? plan ?? undefined,
      } as RestaurantSubscription)
    : null

  const listItem = mapRestaurantRow(
    r as Record<string, unknown>,
    plansById,
    new Map([[r.owner_id, authUser.user?.email ?? '']]),
    new Map([[id, tablesCount ?? 0]]),
  )

  return {
    ...listItem,
    address: r.address,
    owner_id: r.owner_id,
    restaurant_model: (r.restaurant_model as string | null) ?? null,
    operational_mode: (r.operational_mode as string | null) ?? 'both',
    asaas_onboarding_status: r.asaas_onboarding_status,
    subscription: sub,
    recent_invoices: (invoices ?? []) as BillingInvoice[],
    plan_changes: planChanges,
    profile: profileFromRow(r as Record<string, unknown>),
    nfe: nfeProfileFromRow(r as Record<string, unknown>),
    whatsapp: whatsAppStatusFromRow(r as Record<string, unknown>),
  }
}

export function resolveEffectiveFees(
  plan: Plan | null,
  overrides: {
    platform_fee_percent_override?: number | null
    platform_fee_fixed_override?: number | null
  },
) {
  return {
    platform_fee_percent: overrides.platform_fee_percent_override ?? plan?.platform_fee_percent ?? 0,
    platform_fee_fixed: overrides.platform_fee_fixed_override ?? plan?.platform_fee_fixed ?? 0,
  }
}

export function addDays(date: Date, days: number): Date {
  const d = new Date(date)
  d.setDate(d.getDate() + days)
  return d
}

function resolveClientPlan(
  restaurant: { plan_id?: string | null },
  sub: RestaurantSubscription | null | undefined,
  plansById: Map<string, Plan>,
): Plan | null {
  const embedded = sub?.plan
  if (embedded) return embedded
  const planId = restaurant.plan_id ?? sub?.plan_id
  if (planId && plansById.has(planId)) return plansById.get(planId)!
  return null
}

/** Repara plano/assinatura/taxas quando o restaurante foi criado sem billing completo. */
export async function ensureRestaurantBilling(
  admin: SupabaseClient,
  restaurantId: string,
  fallbackPlanId = 'starter',
): Promise<void> {
  const { data: r } = await admin
    .from('restaurants')
    .select('id, plan_id, platform_fee_percent, platform_fee_fixed')
    .eq('id', restaurantId)
    .maybeSingle()

  if (!r) return

  const planId = r.plan_id ?? fallbackPlanId
  const { data: plan } = await admin.from('plans').select('*').eq('id', planId).maybeSingle()
  if (!plan) return

  const fees = resolveEffectiveFees(plan as Plan, {})
  const needsRestaurantUpdate =
    !r.plan_id
    || Number(r.platform_fee_percent ?? 0) === 0

  if (needsRestaurantUpdate) {
    const { error: updateErr } = await admin.from('restaurants').update({
      plan_id: planId,
      platform_fee_percent: fees.platform_fee_percent,
      platform_fee_fixed: fees.platform_fee_fixed,
    }).eq('id', restaurantId)
    if (updateErr) {
      console.error('[ensureRestaurantBilling] restaurant update', restaurantId, updateErr.message)
      return
    }
  }

  const { data: sub } = await admin
    .from('restaurant_subscriptions')
    .select('id')
    .eq('restaurant_id', restaurantId)
    .maybeSingle()

  if (!sub) {
    const now = new Date()
    const trialEnds = addDays(now, (plan as Plan).trial_days ?? 14)
    const { error: insertErr } = await admin.from('restaurant_subscriptions').insert({
      restaurant_id: restaurantId,
      plan_id: planId,
      status: 'trialing',
      trial_ends_at: trialEnds.toISOString(),
      current_period_start: now.toISOString(),
      current_period_end: trialEnds.toISOString(),
    })
    if (insertErr) {
      console.error('[ensureRestaurantBilling] subscription insert', restaurantId, insertErr.message)
    }
  }
}

function mapRestaurantRow(
  r: Record<string, unknown>,
  plansById: Map<string, Plan>,
  ownerEmails: Map<string, string>,
  countByRestaurant: Map<string, number>,
): InternalClientListItem {
  const subRaw = Array.isArray(r.subscription) ? r.subscription[0] : r.subscription
  const planRaw = (subRaw as { plan?: unknown } | null)?.plan
  const embeddedPlan = (Array.isArray(planRaw) ? planRaw[0] : planRaw) as Plan | null | undefined
  const sub = subRaw as unknown as RestaurantSubscription | null | undefined
  const plan = resolveClientPlan(
    { plan_id: r.plan_id as string | null },
    sub ? { ...sub, plan: embeddedPlan ?? sub.plan } : null,
    plansById,
  )

  return {
    id: String(r.id),
    name: String(r.name),
    slug: String(r.slug),
    status: r.status as 'active' | 'inactive',
    phone: (r.phone as string | null) ?? null,
    plan_id: (r.plan_id as string | null) ?? sub?.plan_id ?? plan?.id ?? null,
    plan_name: plan?.name ?? null,
    subscription_status: (sub?.status as SubscriptionStatus | undefined) ?? null,
    platform_fee_percent: effectiveFeePercent(sub ?? null, plan, Number(r.platform_fee_percent ?? 0)),
    monthly_fee: effectiveMonthlyFee(sub ?? null, plan),
    owner_email: ownerEmails.get(String(r.owner_id)) ?? null,
    created_at: String(r.created_at),
    tables_count: countByRestaurant.get(String(r.id)) ?? 0,
    payout_configured: Boolean(r.bank_account || r.payout_configured_at),
    digital_status: mapDigitalStatus(
      r.asaas_wallet_id as string | null,
      r.asaas_onboarding_status as string | null,
    ),
  }
}
