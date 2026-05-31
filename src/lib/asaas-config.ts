import { createAdminClient } from '@/lib/supabase/admin'
import { decryptSecret } from '@/lib/secret-crypto'

export type AsaasEnvironment = 'sandbox' | 'production'

export type ResolvedAsaasConfig = {
  environment: AsaasEnvironment
  apiKey: string | null
  webhookToken: string | null
  paymentBypass: boolean
  source: 'database' | 'environment' | 'none'
}

type DbRow = {
  environment: AsaasEnvironment
  api_key_encrypted: string | null
  webhook_token_encrypted: string | null
  payment_bypass: boolean
}

let cache: { value: ResolvedAsaasConfig; expires: number } | null = null
const CACHE_TTL_MS = 30_000

function fromEnv(): ResolvedAsaasConfig {
  const env = process.env.ASAAS_ENVIRONMENT === 'production' ? 'production' : 'sandbox'
  const apiKey = process.env.ASAAS_API_KEY?.trim() || null
  const webhookToken = process.env.ASAAS_WEBHOOK_TOKEN?.trim() || null
  let paymentBypass = false
  if (process.env.PAYMENT_BYPASS === 'true') paymentBypass = true
  else if (process.env.PAYMENT_BYPASS === 'false') paymentBypass = false
  else paymentBypass = !apiKey

  return {
    environment: env,
    apiKey,
    webhookToken,
    paymentBypass,
    source: apiKey || webhookToken ? 'environment' : 'none',
  }
}

async function fromDatabase(): Promise<ResolvedAsaasConfig | null> {
  try {
    const admin = createAdminClient()
    const { data, error } = await admin
      .from('platform_asaas_config')
      .select('environment, api_key_encrypted, webhook_token_encrypted, payment_bypass')
      .eq('id', 1)
      .maybeSingle()

    if (error || !data) return null

    const row = data as DbRow
    let apiKey: string | null = null
    let webhookToken: string | null = null

    if (row.api_key_encrypted) {
      try {
        apiKey = decryptSecret(row.api_key_encrypted)
      } catch {
        apiKey = null
      }
    }

    if (row.webhook_token_encrypted) {
      try {
        webhookToken = decryptSecret(row.webhook_token_encrypted)
      } catch {
        webhookToken = null
      }
    }

    const hasDbSecrets = Boolean(row.api_key_encrypted || row.webhook_token_encrypted || row.payment_bypass)

    return {
      environment: row.environment,
      apiKey,
      webhookToken,
      paymentBypass: row.payment_bypass,
      source: hasDbSecrets ? 'database' : 'none',
    }
  } catch {
    return null
  }
}

/** Config efetiva: banco tem prioridade sobre .env quando há API key no banco. */
export async function getAsaasConfig(): Promise<ResolvedAsaasConfig> {
  const now = Date.now()
  if (cache && cache.expires > now) return cache.value

  const db = await fromDatabase()
  const env = fromEnv()

  let resolved: ResolvedAsaasConfig

  if (db?.apiKey) {
    resolved = {
      environment: db.environment,
      apiKey: db.apiKey,
      webhookToken: db.webhookToken ?? env.webhookToken,
      paymentBypass: db.paymentBypass,
      source: 'database',
    }
  } else if (env.apiKey) {
    resolved = env
  } else if (db) {
    resolved = {
      ...db,
      apiKey: null,
      webhookToken: db.webhookToken ?? env.webhookToken,
      source: db.source,
    }
  } else {
    resolved = { ...env, source: 'none' }
  }

  cache = { value: resolved, expires: now + CACHE_TTL_MS }
  return resolved
}

export function clearAsaasConfigCache() {
  cache = null
}

export function asaasBaseUrl(environment: AsaasEnvironment): string {
  return environment === 'production'
    ? 'https://www.asaas.com/api/v3'
    : 'https://sandbox.asaas.com/api/v3'
}

export function appWebhookUrl(): string {
  const base = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '') ?? 'https://qomanda-mu.vercel.app'
  return `${base}/api/asaas/webhook`
}
