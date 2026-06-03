import { NextResponse } from 'next/server'
import { StaffAuthError, requireStaff } from '@/lib/staff-auth'
import { fetchClientList, addDays, resolveEffectiveFees } from '@/lib/internal-clients'
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
import type { Plan } from '@/types/internal'
import {
  getRestaurantModel,
  restaurantModelPresetToDb,
  seedDefaultTablesForModel,
  type RestaurantModelId,
} from '@/lib/restaurant-models'

function slugify(v: string) {
  return v.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
}

export async function GET() {
  try {
    const { admin } = await requireStaff()
    const clients = await fetchClientList(admin)
    return NextResponse.json({ clients })
  } catch (err) {
    if (err instanceof StaffAuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    console.error('[Internal clients GET]', err)
    return NextResponse.json({ error: 'Erro ao listar clientes.' }, { status: 500 })
  }
}

type CreateClientBody = RestaurantBusinessInput & RestaurantNfeInput & {
  ownerName?: string
  ownerEmail?: string
  ownerPassword?: string
  restaurantName?: string
  slug?: string
  planId?: string
  status?: 'active' | 'inactive'
  notes?: string
  restaurantModel?: RestaurantModelId
}

export async function POST(req: Request) {
  try {
    const { admin, user } = await requireStaff()
    const body = (await req.json()) as CreateClientBody

    const ownerEmail = String(body.ownerEmail ?? '').trim().toLowerCase()
    const ownerPassword = String(body.ownerPassword ?? '')
    const restaurantName = String(body.restaurantName ?? '').trim()
    const slug = slugify(String(body.slug ?? restaurantName))
    const planId = String(body.planId ?? 'starter')

    if (!ownerEmail) return NextResponse.json({ error: 'E-mail do responsável é obrigatório.' }, { status: 400 })
    if (ownerPassword.length < 6) return NextResponse.json({ error: 'Senha com no mínimo 6 caracteres.' }, { status: 400 })
    if (!restaurantName) return NextResponse.json({ error: 'Nome fantasia é obrigatório.' }, { status: 400 })
    if (!slug) return NextResponse.json({ error: 'Slug inválido.' }, { status: 400 })

    const modelId = body.restaurantModel
    if (!modelId) {
      return NextResponse.json({ error: 'Selecione o modelo operacional.' }, { status: 400 })
    }
    const modelDef = getRestaurantModel(modelId)
    if (!modelDef) {
      return NextResponse.json({ error: 'Modelo operacional inválido.' }, { status: 400 })
    }
    if (modelDef.status !== 'available') {
      return NextResponse.json({ error: 'Este modelo ainda não está disponível.' }, { status: 400 })
    }
    const modelPreset = restaurantModelPresetToDb(modelId)

    const businessError = validateRestaurantBusiness(body)
    if (businessError) return NextResponse.json({ error: businessError }, { status: 400 })

    const nfeError = validateRestaurantNfe(body, body.documentType)
    if (nfeError) return NextResponse.json({ error: nfeError }, { status: 400 })

    const businessDb = businessFieldsToDb(body)
    const nfeDb = nfeFieldsToDb(body)

    const { data: plan } = await admin.from('plans').select('*').eq('id', planId).single()
    if (!plan) return NextResponse.json({ error: 'Plano não encontrado.' }, { status: 400 })

    const { data: authData, error: authErr } = await admin.auth.admin.createUser({
      email: ownerEmail,
      password: ownerPassword,
      email_confirm: true,
      user_metadata: { name: body.ownerName ?? restaurantName },
    })

    if (authErr || !authData.user) {
      const msg = authErr?.message?.includes('already') ? 'E-mail já cadastrado.' : (authErr?.message ?? 'Erro ao criar usuário.')
      return NextResponse.json({ error: msg }, { status: 400 })
    }

    const fees = resolveEffectiveFees(plan as Plan, {})
    const now = new Date()
    const trialEnds = addDays(now, (plan as Plan).trial_days ?? 14)

    const { data: restaurant, error: restErr } = await admin
      .from('restaurants')
      .insert({
        owner_id: authData.user.id,
        name: restaurantName,
        slug,
        status: body.status ?? 'active',
        plan_id: planId,
        platform_fee_percent: fees.platform_fee_percent,
        platform_fee_fixed: fees.platform_fee_fixed,
        ...modelPreset,
        ...businessDb,
        ...nfeDb,
      })
      .select('id')
      .single()

    if (restErr || !restaurant) {
      await admin.auth.admin.deleteUser(authData.user.id)
      const msg = restErr?.code === '23505' ? 'Slug já em uso.' : 'Erro ao criar restaurante.'
      return NextResponse.json({ error: msg }, { status: 400 })
    }

    const { error: subErr } = await admin.from('restaurant_subscriptions').insert({
      restaurant_id: restaurant.id,
      plan_id: planId,
      status: 'trialing',
      trial_ends_at: trialEnds.toISOString(),
      current_period_start: now.toISOString(),
      current_period_end: trialEnds.toISOString(),
      notes: body.notes?.trim() || null,
    })

    if (subErr) {
      await admin.from('restaurants').delete().eq('id', restaurant.id)
      await admin.auth.admin.deleteUser(authData.user.id)
      return NextResponse.json({ error: 'Erro ao criar assinatura.' }, { status: 500 })
    }

    await seedDefaultTablesForModel(admin, restaurant.id, modelId)

    return NextResponse.json({
      ok: true,
      restaurantId: restaurant.id,
      slug,
      ownerEmail,
      restaurantModel: modelId,
      createdBy: user.id,
    }, { status: 201 })
  } catch (err) {
    if (err instanceof StaffAuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    console.error('[Internal clients POST]', err)
    return NextResponse.json({ error: 'Erro ao cadastrar cliente.' }, { status: 500 })
  }
}
