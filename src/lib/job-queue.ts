import type { SupabaseClient } from '@supabase/supabase-js'
import { captureError } from '@/lib/observability'
import { consumeRateLimit } from '@/lib/rate-limit'
import { sendRestaurantWhatsApp } from '@/lib/send-whatsapp'

export type JobType = 'nfe_emit' | 'whatsapp_send'

// Limite de mensagens WhatsApp por restaurante por minuto (limites Meta).
const WHATSAPP_PER_MINUTE = 20

export type AsyncJob = {
  id: string
  type: string
  payload: Record<string, unknown>
  attempts: number
  max_attempts: number
}

/**
 * Enfileira um job assíncrono (best-effort: nunca lança, para não quebrar o
 * fluxo que o disparou — ex.: confirmação de pagamento).
 */
export async function enqueueJob(
  admin: SupabaseClient,
  type: JobType,
  payload: Record<string, unknown>,
): Promise<{ ok: boolean; id?: string }> {
  try {
    const { data, error } = await admin
      .from('async_jobs')
      // run_after no relógio do app (mesmo usado no filtro do worker e no
      // backoff) — evita skew app/DB que atrasaria o primeiro processamento.
      .insert({ type, payload, status: 'pending', run_after: new Date().toISOString() })
      .select('id')
      .single()
    if (error) {
      console.error('[enqueueJob]', type, error.message)
      return { ok: false }
    }
    return { ok: true, id: data.id }
  } catch (err) {
    console.error('[enqueueJob]', type, err)
    return { ok: false }
  }
}

/** Enfileira o envio de um WhatsApp (decoupla do fluxo que o originou). */
export async function enqueueWhatsApp(
  admin: SupabaseClient,
  params: { restaurantId: string; to: string; message: string; invoiceId?: string },
): Promise<{ ok: boolean; id?: string }> {
  return enqueueJob(admin, 'whatsapp_send', { ...params })
}

// Backoff exponencial por tentativa (segundos): 30s, 2min, 8min, 32min...
function backoffSeconds(attempts: number): number {
  return Math.min(30 * Math.pow(4, Math.max(0, attempts - 1)), 3600)
}

/** Resultado opcional de handler: adiar o job sem contar como falha/tentativa. */
type HandlerResult = void | { deferSec: number }

/** Handlers por tipo de job. LANÇAM em falha transitória (retry); retornam
 *  { deferSec } para reagendar sem consumir tentativa (ex.: throttle). */
const HANDLERS: Record<string, (admin: SupabaseClient, payload: Record<string, unknown>) => Promise<HandlerResult>> = {
  nfe_emit: async (admin, payload) => {
    const paymentId = String(payload.paymentId ?? '')
    if (!paymentId) return
    // Import dinâmico evita ciclo emit-nfe ↔ job-queue.
    const { emitNfeForPayment } = await import('@/lib/nfe/emit-nfe')
    const outcome = await emitNfeForPayment(admin, paymentId)
    if (!outcome.emitted && (outcome.reason === 'exception' || outcome.reason === 'db_insert_failed')) {
      throw new Error(`nfe_emit transitório: ${outcome.reason}`)
    }
  },

  whatsapp_send: async (admin, payload) => {
    const restaurantId = String(payload.restaurantId ?? '')
    const to = String(payload.to ?? '')
    const message = String(payload.message ?? '')
    const invoiceId = payload.invoiceId ? String(payload.invoiceId) : null
    if (!restaurantId || !to || !message) return // payload inválido → descarta

    // Throttle por restaurante (limites Meta). Estourou → adia ~20s sem falhar.
    const allowed = await consumeRateLimit(`wa:${restaurantId}`, WHATSAPP_PER_MINUTE, 60)
    if (!allowed) return { deferSec: 20 }

    const sent = await sendRestaurantWhatsApp(admin, restaurantId, to, message)
    if (!sent.ok && !sent.mock) {
      throw new Error(sent.error ?? 'falha ao enviar WhatsApp') // retry/backoff
    }
    if (invoiceId) {
      await admin.from('nfe_invoices').update({ whatsapp_sent_at: new Date().toISOString() }).eq('id', invoiceId)
    }
  },
}

/**
 * Consome jobs prontos (pendentes e vencidos). Reivindica cada job de forma
 * otimista (pending→processing) para evitar processamento duplicado entre
 * execuções concorrentes do cron. Retorna um resumo.
 */
export async function processDueJobs(
  admin: SupabaseClient,
  opts: { limit?: number } = {},
): Promise<{ claimed: number; done: number; failed: number; retried: number; deferred: number }> {
  const limit = opts.limit ?? 20
  const nowIso = new Date().toISOString()

  const { data: due } = await admin
    .from('async_jobs')
    .select('id, type, payload, attempts, max_attempts')
    .eq('status', 'pending')
    .lte('run_after', nowIso)
    .order('run_after', { ascending: true })
    .limit(limit)

  let claimed = 0, done = 0, failed = 0, retried = 0, deferred = 0

  for (const job of (due ?? []) as AsyncJob[]) {
    // Reivindica: só processa se conseguir mover pending→processing.
    const { data: lock } = await admin
      .from('async_jobs')
      .update({ status: 'processing', attempts: job.attempts + 1 })
      .eq('id', job.id)
      .eq('status', 'pending')
      .select('id')
      .maybeSingle()
    if (!lock) continue // outro runner pegou
    claimed++

    const handler = HANDLERS[job.type]
    if (!handler) {
      await admin.from('async_jobs').update({ status: 'error', last_error: `handler ausente: ${job.type}` }).eq('id', job.id)
      failed++
      continue
    }

    try {
      const result = await handler(admin, job.payload ?? {})
      if (result && typeof result === 'object' && 'deferSec' in result) {
        // Adia sem contar como tentativa nem como erro (ex.: throttle).
        const runAfter = new Date(Date.now() + result.deferSec * 1000).toISOString()
        await admin.from('async_jobs').update({ status: 'pending', run_after: runAfter, attempts: job.attempts }).eq('id', job.id)
        deferred++
        continue
      }
      await admin.from('async_jobs').update({ status: 'done', last_error: null }).eq('id', job.id)
      done++
    } catch (err) {
      const attempts = job.attempts + 1
      const message = err instanceof Error ? err.message : String(err)
      if (attempts >= job.max_attempts) {
        await admin.from('async_jobs').update({ status: 'error', last_error: message }).eq('id', job.id)
        // Job esgotou as tentativas → reporta (não passa pelo onRequestError).
        await captureError(err, { scope: `job:${job.type}`, extra: { jobId: job.id, attempts, payload: job.payload } })
        failed++
      } else {
        const runAfter = new Date(Date.now() + backoffSeconds(attempts) * 1000).toISOString()
        await admin.from('async_jobs').update({ status: 'pending', run_after: runAfter, last_error: message }).eq('id', job.id)
        retried++
      }
    }
  }

  return { claimed, done, failed, retried, deferred }
}
