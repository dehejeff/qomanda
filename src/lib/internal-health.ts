import type { SupabaseClient } from '@supabase/supabase-js'
import { brToday } from '@/lib/date-tz'

export type HealthLevel = 'ok' | 'warn' | 'critical'

export type RecentError = {
  source: 'job' | 'webhook' | 'nfe'
  label: string
  message: string
  at: string
}

export type SystemHealth = {
  status: HealthLevel
  generatedAt: string
  jobs: {
    pending: number
    processing: number
    done24h: number
    error: number
    oldestPendingMinutes: number | null
  }
  webhooks: {
    error: number
    processed24h: number
    processing: number
  }
  nfe: { error: number }
  billing: { overdue: number }
  recentErrors: RecentError[]
}

const WINDOW_MS = 24 * 60 * 60 * 1000
const STUCK_QUEUE_MIN = 15 // fila pendente parada há mais que isso = crítico

type JobRow = { id: string; type: string; status: string; last_error: string | null; created_at: string; updated_at: string }
type WebhookRow = { id: string; provider: string; event_type: string | null; status: string; error_message: string | null; created_at: string; updated_at: string }
type NfeRow = { id: string; status: string; error_message: string | null; updated_at: string }

function minutesSince(iso: string): number {
  return Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000))
}

/** Agrega sinais operacionais (fila, webhooks, NF-e, atraso) para o painel de saúde. */
export async function fetchSystemHealth(admin: SupabaseClient): Promise<SystemHealth> {
  const sinceIso = new Date(Date.now() - WINDOW_MS).toISOString()
  const today = brToday()

  const [jobsRes, oldestPendingRes, webhooksRes, nfeErrRes, overdueRes] = await Promise.all([
    admin.from('async_jobs').select('id, type, status, last_error, created_at, updated_at').gte('created_at', sinceIso),
    admin.from('async_jobs').select('created_at').eq('status', 'pending').order('created_at', { ascending: true }).limit(1).maybeSingle(),
    admin.from('webhook_events').select('id, provider, event_type, status, error_message, created_at, updated_at').gte('created_at', sinceIso),
    admin.from('nfe_invoices').select('id, status, error_message, updated_at').eq('status', 'error').gte('updated_at', sinceIso),
    admin.from('billing_invoices').select('id', { count: 'exact', head: true }).in('status', ['sent', 'overdue', 'draft']).lt('due_date', today),
  ])

  const jobs = (jobsRes.data ?? []) as JobRow[]
  const webhooks = (webhooksRes.data ?? []) as WebhookRow[]
  const nfeErrors = (nfeErrRes.data ?? []) as NfeRow[]

  // Conta pendentes/processando reais (qualquer idade), não só na janela:
  const [pendingCountRes, processingJobsRes, processingWhRes] = await Promise.all([
    admin.from('async_jobs').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
    admin.from('async_jobs').select('id', { count: 'exact', head: true }).eq('status', 'processing'),
    admin.from('webhook_events').select('id', { count: 'exact', head: true }).eq('status', 'processing'),
  ])

  const jobsError = jobs.filter(j => j.status === 'error').length
  const jobsDone24h = jobs.filter(j => j.status === 'done').length
  const webhooksError = webhooks.filter(w => w.status === 'error').length
  const webhooksProcessed24h = webhooks.filter(w => w.status === 'processed').length

  const oldestPendingMinutes = oldestPendingRes.data ? minutesSince(oldestPendingRes.data.created_at) : null

  // Feed de erros recentes unificado
  const recentErrors: RecentError[] = [
    ...jobs.filter(j => j.status === 'error').map(j => ({
      source: 'job' as const, label: `Job ${j.type}`, message: j.last_error ?? 'erro', at: j.updated_at,
    })),
    ...webhooks.filter(w => w.status === 'error').map(w => ({
      source: 'webhook' as const, label: `Webhook ${w.provider}`, message: w.error_message ?? 'erro', at: w.updated_at,
    })),
    ...nfeErrors.map(n => ({
      source: 'nfe' as const, label: 'NF-e', message: n.error_message ?? 'erro', at: n.updated_at,
    })),
  ].sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime()).slice(0, 20)

  // Status geral
  const queueStuck = oldestPendingMinutes != null && oldestPendingMinutes > STUCK_QUEUE_MIN
  let status: HealthLevel = 'ok'
  if (webhooksError > 0 || queueStuck) status = 'critical'
  else if (jobsError > 0 || nfeErrors.length > 0 || (overdueRes.count ?? 0) > 0) status = 'warn'

  return {
    status,
    generatedAt: new Date().toISOString(),
    jobs: {
      pending: pendingCountRes.count ?? 0,
      processing: processingJobsRes.count ?? 0,
      done24h: jobsDone24h,
      error: jobsError,
      oldestPendingMinutes,
    },
    webhooks: {
      error: webhooksError,
      processed24h: webhooksProcessed24h,
      processing: processingWhRes.count ?? 0,
    },
    nfe: { error: nfeErrors.length },
    billing: { overdue: overdueRes.count ?? 0 },
    recentErrors,
  }
}
