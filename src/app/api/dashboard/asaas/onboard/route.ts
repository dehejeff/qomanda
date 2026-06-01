import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createSubAccount, getSubAccountInfo } from '@/lib/asaas'

export type OnboardStatusDto = {
  status: 'inactive' | 'submitted' | 'approved' | 'rejected' | null
  walletId: string | null
  accountId: string | null
  refreshed: boolean
  asaasApproval: string | null
}

/**
 * GET /api/dashboard/asaas/onboard
 * Consulta o status de aprovação da subconta no Asaas e atualiza o DB se aprovada.
 */
export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })

    const { data: restaurant } = await supabase
      .from('restaurants')
      .select('id, asaas_account_id, asaas_wallet_id, asaas_onboarding_status')
      .eq('owner_id', user.id)
      .single()

    if (!restaurant) return NextResponse.json({ error: 'Restaurante não encontrado.' }, { status: 404 })

    const dto: OnboardStatusDto = {
      status: (restaurant.asaas_onboarding_status as OnboardStatusDto['status']) ?? 'inactive',
      walletId: restaurant.asaas_wallet_id,
      accountId: restaurant.asaas_account_id,
      refreshed: false,
      asaasApproval: null,
    }

    if (!restaurant.asaas_account_id) {
      return NextResponse.json(dto)
    }

    if (restaurant.asaas_onboarding_status === 'approved') {
      return NextResponse.json(dto)
    }

    try {
      const subInfo = await getSubAccountInfo(restaurant.asaas_account_id)
      dto.asaasApproval = subInfo.generalApproval ?? null
      dto.refreshed = true

      if (subInfo.generalApproval === 'APPROVED') {
        await supabase
          .from('restaurants')
          .update({ asaas_onboarding_status: 'approved' })
          .eq('id', restaurant.id)
        dto.status = 'approved'
      } else if (subInfo.generalApproval === 'REJECTED') {
        await supabase
          .from('restaurants')
          .update({ asaas_onboarding_status: 'rejected' })
          .eq('id', restaurant.id)
        dto.status = 'rejected'
      }
    } catch (pollErr) {
      console.error('[Asaas onboard status poll]', pollErr)
    }

    return NextResponse.json(dto)
  } catch (err) {
    console.error('[Asaas onboard GET]', err)
    return NextResponse.json({ error: 'Erro ao verificar status.' }, { status: 500 })
  }
}

/**
 * POST /api/dashboard/asaas/onboard
 * Cria a subconta Asaas do restaurante autenticado (onboarding do marketplace)
 * e salva asaas_account_id + asaas_wallet_id. A partir daí o split passa a
 * enviar a parte do restaurante para a subconta dele.
 */
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })

    const { data: restaurant } = await supabase
      .from('restaurants')
      .select('id, name, asaas_wallet_id')
      .eq('owner_id', user.id)
      .single()

    if (!restaurant) return NextResponse.json({ error: 'Restaurante não encontrado.' }, { status: 404 })

    if (restaurant.asaas_wallet_id) {
      return NextResponse.json({ error: 'Restaurante já possui subconta Asaas.' }, { status: 409 })
    }

    const body = await req.json() as {
      email?: string
      cpfCnpj?: string
      mobilePhone?: string
      incomeValue?: number
      address?: string
      addressNumber?: string
      province?: string
      postalCode?: string
      companyType?: 'MEI' | 'LIMITED' | 'INDIVIDUAL' | 'ASSOCIATION'
    }

    const required: (keyof typeof body)[] = ['email', 'cpfCnpj', 'mobilePhone', 'incomeValue', 'address', 'addressNumber', 'province', 'postalCode']
    const missing = required.filter(k => !body[k])
    if (missing.length > 0) {
      return NextResponse.json({ error: `Campos obrigatórios: ${missing.join(', ')}.` }, { status: 400 })
    }

    const sub = await createSubAccount({
      name: restaurant.name,
      email: body.email!,
      cpfCnpj: body.cpfCnpj!,
      mobilePhone: body.mobilePhone!,
      incomeValue: Number(body.incomeValue),
      address: body.address!,
      addressNumber: body.addressNumber!,
      province: body.province!,
      postalCode: body.postalCode!,
      companyType: body.companyType,
      externalReference: restaurant.id,
    })

    const { error: updateErr } = await supabase
      .from('restaurants')
      .update({
        asaas_account_id: sub.id,
        asaas_wallet_id: sub.walletId,
        asaas_onboarding_status: 'submitted',
      })
      .eq('id', restaurant.id)

    if (updateErr) {
      console.error('[Asaas onboard update]', updateErr)
      return NextResponse.json({ error: 'Subconta criada, mas falha ao salvar. Contate o suporte.' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      walletId: sub.walletId,
      accountId: sub.id,
      status: 'submitted',
    })
  } catch (err) {
    console.error('[Asaas onboard]', err)
    const msg = err instanceof Error ? err.message : 'Erro ao criar subconta.'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
