import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireOwnerAccess, RestaurantAuthError } from '@/lib/restaurant-auth'
import { gatewayFieldsToDb, loadRestaurantGateway } from '@/lib/restaurant-gateway'
import { manualFieldsToDb } from '@/lib/restaurant-payment-config'
import { asaasBaseUrl } from '@/lib/asaas-config'
import { testMercadoPagoConnection } from '@/lib/mercadopago'

export async function GET() {
  try {
    const access = await requireOwnerAccess()
    const admin = createAdminClient()
    const cfg = await loadRestaurantGateway(admin, access.restaurantId)

    const { data: r } = await admin
      .from('restaurants')
      .select('operational_mode, marketplace_split_enabled')
      .eq('id', access.restaurantId)
      .single()

    return NextResponse.json({
      gateway: cfg,
      operationalMode: r?.operational_mode ?? 'both',
      marketplaceSplitEnabled: Boolean(r?.marketplace_split_enabled),
    })
  } catch (err) {
    if (err instanceof RestaurantAuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    console.error('[Gateway GET]', err)
    return NextResponse.json({ error: 'Erro ao carregar gateway.' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const access = await requireOwnerAccess()
    const body = await req.json() as {
      provider?: 'manual' | 'asaas' | 'mercado_pago' | null
      apiKey?: string | null
      environment?: 'sandbox' | 'production'
      operationalMode?: 'dine_in' | 'counter' | 'both'
      testConnection?: boolean
      manualPixKey?: string | null
      manualPixKeyType?: 'cpf' | 'cnpj' | 'email' | 'phone' | 'random' | null
      manualPaymentHolderName?: string | null
      manualPaymentNotes?: string | null
    }

    const admin = createAdminClient()
    const existing = await loadRestaurantGateway(admin, access.restaurantId)

    const patch: Record<string, unknown> = {}

    if (body.operationalMode) patch.operational_mode = body.operationalMode

    if (
      body.manualPixKey !== undefined
      || body.manualPixKeyType !== undefined
      || body.manualPaymentHolderName !== undefined
      || body.manualPaymentNotes !== undefined
    ) {
      Object.assign(patch, manualFieldsToDb({
        pixKey: body.manualPixKey,
        pixKeyType: body.manualPixKeyType,
        holderName: body.manualPaymentHolderName,
        notes: body.manualPaymentNotes,
      }))
    }

    // Sem chave PIX, o provider manual fica "não configurado" (só dinheiro no checkout),
    // mas NÃO bloqueamos o save — senão o dono não consegue nem mudar o modo operacional.
    // O painel já mostra "Informe a chave PIX para ativar".

    if (body.provider !== undefined) {
      Object.assign(patch, gatewayFieldsToDb({
        provider: body.provider,
        environment: body.environment ?? existing.environment,
        apiKey: body.apiKey === '' ? null : body.apiKey,
        existingEncrypted: existing.apiKey ? 'set' : null,
      }))
    } else if (body.apiKey?.trim()) {
      Object.assign(patch, gatewayFieldsToDb({
        provider: existing.provider ?? 'asaas',
        environment: body.environment ?? existing.environment,
        apiKey: body.apiKey,
      }))
    } else if (body.environment) {
      patch.payment_gateway_environment = body.environment
    }

    if (Object.keys(patch).length) {
      await admin.from('restaurants').update(patch).eq('id', access.restaurantId)
    }

    if (body.testConnection) {
      const refreshed = await loadRestaurantGateway(admin, access.restaurantId)
      if (!refreshed.apiKey) {
        const label = refreshed.provider === 'mercado_pago' ? 'access token do Mercado Pago' : 'API key do Asaas'
        return NextResponse.json({ error: `Informe o ${label}.` }, { status: 400 })
      }

      if (refreshed.provider === 'mercado_pago') {
        const result = await testMercadoPagoConnection({
          accessToken: refreshed.apiKey,
          environment: refreshed.environment,
        })
        return NextResponse.json({
          ok: true,
          nickname: result.nickname,
          publicKey: result.publicKey,
        })
      }

      const res = await fetch(`${asaasBaseUrl(refreshed.environment)}/finance/balance`, {
        headers: { access_token: refreshed.apiKey },
      })
      const data = await res.json()
      if (!res.ok) {
        const msg = data?.errors?.[0]?.description ?? 'Falha ao conectar.'
        return NextResponse.json({ error: msg }, { status: 400 })
      }
      return NextResponse.json({ ok: true, balance: Number(data.balance ?? 0) })
    }

    const cfg = await loadRestaurantGateway(admin, access.restaurantId)
    return NextResponse.json({ ok: true, gateway: cfg })
  } catch (err) {
    if (err instanceof RestaurantAuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    console.error('[Gateway POST]', err)
    return NextResponse.json({ error: 'Erro ao salvar gateway.' }, { status: 500 })
  }
}
