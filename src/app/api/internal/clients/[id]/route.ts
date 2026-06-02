import { NextRequest, NextResponse } from 'next/server'
import { StaffAuthError, requireStaff } from '@/lib/staff-auth'
import { fetchClientDetail, resolveEffectiveFees, addDays } from '@/lib/internal-clients'
import {
  businessFieldsToDb,
  validateRestaurantBusiness,
  type RestaurantBusinessInput,
} from '@/lib/restaurant-profile'
import {
  nfeFieldsToDb,
  validateRestaurantNfe,
  type RestaurantNfeInput,
} from '@/lib/restaurant-nfe'
import { getRestaurantModel, restaurantModelPresetToDb, type RestaurantModelId } from '@/lib/restaurant-models'
import type { Plan, SubscriptionStatus } from '@/types/internal'

type RouteParams = { params: Promise<{ id: string }> }

export async function GET(_req: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params
    const { admin } = await requireStaff()
    const client = await fetchClientDetail(admin, id)
    if (!client) return NextResponse.json({ error: 'Cliente não encontrado.' }, { status: 404 })
    return NextResponse.json({ client })
  } catch (err) {
    if (err instanceof StaffAuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    console.error('[Internal client GET]', err)
    return NextResponse.json({ error: 'Erro ao carregar cliente.' }, { status: 500 })
  }
}

type PatchBody = RestaurantBusinessInput & RestaurantNfeInput & {
  restaurantName?: string
  slug?: string
  status?: 'active' | 'inactive'
  planId?: string
  subscriptionStatus?: SubscriptionStatus
  monthlyFeeOverride?: number | null
  platformFeePercentOverride?: number | null
  platformFeeFixedOverride?: number | null
  asaasOnboardingStatus?: 'pending' | 'submitted' | 'approved' | 'rejected'
  subscriptionNotes?: string
  restaurantModel?: RestaurantModelId
}

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params
    const { admin } = await requireStaff()
    const body = (await req.json()) as PatchBody

    const { data: existing } = await admin
      .from('restaurants')
      .select('id, plan_id, nfe_provider_token_encrypted, document_type')
      .eq('id', id)
      .maybeSingle()
    if (!existing) return NextResponse.json({ error: 'Cliente não encontrado.' }, { status: 404 })

    const restaurantPatch: Record<string, unknown> = {}
    if (body.restaurantName != null) restaurantPatch.name = body.restaurantName.trim()
    if (body.slug != null) restaurantPatch.slug = body.slug.trim().toLowerCase()
    if (body.status != null) restaurantPatch.status = body.status
    if (body.asaasOnboardingStatus != null) restaurantPatch.asaas_onboarding_status = body.asaasOnboardingStatus

    // Modelo operacional (salão/balcão/etc) → aplica preset (modo + gateway padrão)
    if (body.restaurantModel != null) {
      if (!getRestaurantModel(body.restaurantModel)) {
        return NextResponse.json({ error: 'Modelo de restaurante inválido.' }, { status: 400 })
      }
      const preset = restaurantModelPresetToDb(body.restaurantModel)
      // Não sobrescreve um gateway já configurado pelo restaurante:
      // só define restaurant_model + operational_mode (e marketplace flag).
      restaurantPatch.restaurant_model = preset.restaurant_model
      restaurantPatch.operational_mode = preset.operational_mode
      restaurantPatch.marketplace_split_enabled = preset.marketplace_split_enabled
    }

    const hasBusinessFields = body.documentType != null || body.documentNumber != null || body.addressStreet != null
    if (hasBusinessFields) {
      const businessError = validateRestaurantBusiness(body)
      if (businessError) return NextResponse.json({ error: businessError }, { status: 400 })
      Object.assign(restaurantPatch, businessFieldsToDb(body))
    } else if (body.phone != null) {
      restaurantPatch.phone = body.phone.replace(/\D/g, '') || null
    }

    const hasNfeFields = body.nfeEnabled != null || body.nfeStatus != null || body.nfeProvider != null
    if (hasNfeFields) {
      const nfeError = validateRestaurantNfe(body, body.documentType ?? existing.document_type)
      if (nfeError) return NextResponse.json({ error: nfeError }, { status: 400 })
      Object.assign(restaurantPatch, nfeFieldsToDb(body, existing.nfe_provider_token_encrypted))
    }

    let plan: Plan | null = null
    const planId = body.planId ?? existing.plan_id
    if (planId) {
      const { data } = await admin.from('plans').select('*').eq('id', planId).single()
      plan = data as Plan | null
      restaurantPatch.plan_id = planId
    }

    const { data: sub } = await admin
      .from('restaurant_subscriptions')
      .select('*')
      .eq('restaurant_id', id)
      .maybeSingle()

    const overrides = {
      platform_fee_percent_override: body.platformFeePercentOverride ?? sub?.platform_fee_percent_override,
      platform_fee_fixed_override: body.platformFeeFixedOverride ?? sub?.platform_fee_fixed_override,
    }

    if (plan || body.platformFeePercentOverride != null || body.platformFeeFixedOverride != null) {
      const fees = resolveEffectiveFees(plan, overrides)
      restaurantPatch.platform_fee_percent = fees.platform_fee_percent
      restaurantPatch.platform_fee_fixed = fees.platform_fee_fixed
    }

    if (Object.keys(restaurantPatch).length) {
      const { error } = await admin.from('restaurants').update(restaurantPatch).eq('id', id)
      if (error) {
        const msg = error.code === '23505' ? 'Slug já em uso.' : 'Erro ao atualizar restaurante.'
        return NextResponse.json({ error: msg }, { status: 400 })
      }
    }

    const subPatch: Record<string, unknown> = { updated_at: new Date().toISOString() }
    if (body.planId != null) subPatch.plan_id = body.planId
    if (body.subscriptionStatus != null) subPatch.status = body.subscriptionStatus
    if (body.monthlyFeeOverride !== undefined) subPatch.monthly_fee_override = body.monthlyFeeOverride
    if (body.platformFeePercentOverride !== undefined) subPatch.platform_fee_percent_override = body.platformFeePercentOverride
    if (body.platformFeeFixedOverride !== undefined) subPatch.platform_fee_fixed_override = body.platformFeeFixedOverride
    if (body.subscriptionNotes !== undefined) subPatch.notes = body.subscriptionNotes?.trim() || null

    if (sub) {
      if (Object.keys(subPatch).length > 1) {
        await admin.from('restaurant_subscriptions').update(subPatch).eq('restaurant_id', id)
      }
    } else if (planId && plan) {
      const now = new Date()
      const trialEnds = addDays(now, plan.trial_days ?? 14)
      await admin.from('restaurant_subscriptions').insert({
        restaurant_id: id,
        plan_id: planId,
        status: body.subscriptionStatus ?? 'trialing',
        trial_ends_at: trialEnds.toISOString(),
        current_period_start: now.toISOString(),
        current_period_end: trialEnds.toISOString(),
        ...subPatch,
      })
    }

    const client = await fetchClientDetail(admin, id)
    return NextResponse.json({ ok: true, client })
  } catch (err) {
    if (err instanceof StaffAuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    console.error('[Internal client PATCH]', err)
    return NextResponse.json({ error: 'Erro ao salvar cliente.' }, { status: 500 })
  }
}
