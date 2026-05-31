import { NextRequest, NextResponse } from 'next/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import { StaffAuthError, requireStaff } from '@/lib/staff-auth'
import {
  appWebhookUrl,
  clearAsaasConfigCache,
  getAsaasConfig,
} from '@/lib/asaas-config'
import { encryptSecret, maskSecret } from '@/lib/secret-crypto'
import { testAsaasConnection } from '@/lib/asaas'

export type GatewayConfigDto = {
  environment: 'sandbox' | 'production'
  apiKeyMasked: string | null
  webhookTokenMasked: string | null
  paymentBypass: boolean
  configured: boolean
  webhookUrl: string
  configSource: 'database' | 'environment' | 'none'
  envHasApiKey: boolean
  updatedAt: string | null
}

async function buildDto(admin: SupabaseClient): Promise<GatewayConfigDto> {
  const config = await getAsaasConfig()
  const envApiKey = Boolean(process.env.ASAAS_API_KEY?.trim())

  const { data: row } = await admin
    .from('platform_asaas_config')
    .select('updated_at')
    .eq('id', 1)
    .maybeSingle()

  return {
    environment: config.environment,
    apiKeyMasked: maskSecret(config.apiKey),
    webhookTokenMasked: maskSecret(config.webhookToken),
    paymentBypass: config.paymentBypass,
    configured: Boolean(config.apiKey),
    webhookUrl: appWebhookUrl(),
    configSource: config.source,
    envHasApiKey: envApiKey,
    updatedAt: row?.updated_at ?? null,
  }
}

export async function GET() {
  try {
    const { admin } = await requireStaff()
    const dto = await buildDto(admin)
    return NextResponse.json({ config: dto })
  } catch (err) {
    if (err instanceof StaffAuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    console.error('[Internal gateway GET]', err)
    return NextResponse.json({ error: 'Erro ao carregar configuração.' }, { status: 500 })
  }
}

type PatchBody = {
  environment?: 'sandbox' | 'production'
  apiKey?: string
  webhookToken?: string
  paymentBypass?: boolean
}

export async function PATCH(req: NextRequest) {
  try {
    const { admin, user } = await requireStaff()
    const body = (await req.json()) as PatchBody

    const { data: existing } = await admin
      .from('platform_asaas_config')
      .select('*')
      .eq('id', 1)
      .maybeSingle()

    const patch: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
      updated_by: user.id !== 'dev-staff' ? user.id : null,
    }

    if (body.environment != null) {
      if (body.environment !== 'sandbox' && body.environment !== 'production') {
        return NextResponse.json({ error: 'Ambiente inválido.' }, { status: 400 })
      }
      patch.environment = body.environment
    }

    if (body.paymentBypass != null) patch.payment_bypass = Boolean(body.paymentBypass)

    const apiKeyInput = body.apiKey?.trim()
    if (apiKeyInput) {
      if (!apiKeyInput.startsWith('$')) {
        return NextResponse.json({ error: 'A API key Asaas costuma começar com $.' }, { status: 400 })
      }
      patch.api_key_encrypted = encryptSecret(apiKeyInput)
    }

    const webhookInput = body.webhookToken?.trim()
    if (webhookInput) {
      patch.webhook_token_encrypted = encryptSecret(webhookInput)
    }

    if (!existing) {
      const { error } = await admin.from('platform_asaas_config').insert({
        id: 1,
        environment: (patch.environment as string) ?? 'sandbox',
        payment_bypass: (patch.payment_bypass as boolean) ?? false,
        api_key_encrypted: patch.api_key_encrypted ?? null,
        webhook_token_encrypted: patch.webhook_token_encrypted ?? null,
        updated_at: patch.updated_at,
        updated_by: patch.updated_by,
      })
      if (error) throw error
    } else {
      const { error } = await admin.from('platform_asaas_config').update(patch).eq('id', 1)
      if (error) throw error
    }

    clearAsaasConfigCache()
    const dto = await buildDto(admin)
    return NextResponse.json({ ok: true, config: dto })
  } catch (err) {
    if (err instanceof StaffAuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    console.error('[Internal gateway PATCH]', err)
    return NextResponse.json({ error: 'Erro ao salvar configuração.' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    await requireStaff()
    const body = await req.json().catch(() => ({}))
    if (body.action !== 'test') {
      return NextResponse.json({ error: 'Ação inválida.' }, { status: 400 })
    }

    clearAsaasConfigCache()
    const result = await testAsaasConnection()
    return NextResponse.json({
      ok: true,
      balance: result.balance,
      environment: result.environment,
    })
  } catch (err) {
    if (err instanceof StaffAuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    const message = err instanceof Error ? err.message : 'Falha no teste de conexão.'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
