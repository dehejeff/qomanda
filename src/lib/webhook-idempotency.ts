import type { SupabaseClient } from '@supabase/supabase-js'

export type WebhookProvider = 'asaas' | 'mercado_pago' | 'stripe'

export type WebhookClaim = {
  /** true = deve processar (evento novo ou retry de erro); false = já processado, ignorar. */
  proceed: boolean
  eventRowId: string | null
}

/**
 * Reivindica um evento de webhook para processamento idempotente.
 * - Evento novo → grava 'processing' e retorna proceed=true.
 * - Já 'processed' → proceed=false (entrega duplicada, ignora).
 * - Já existente mas 'error'/'processing' → reprocessa (proceed=true), incrementa attempts.
 */
export async function claimWebhookEvent(
  admin: SupabaseClient,
  params: { provider: WebhookProvider; eventId: string; eventType?: string | null; payload?: unknown },
): Promise<WebhookClaim> {
  const { provider, eventId, eventType = null, payload = null } = params

  // Tenta inserir; ignoreDuplicates não retorna linha em conflito.
  const { data: inserted } = await admin
    .from('webhook_events')
    .upsert(
      { provider, event_id: eventId, event_type: eventType, payload, status: 'processing' },
      { onConflict: 'provider,event_id', ignoreDuplicates: true },
    )
    .select('id')

  if (inserted && inserted.length > 0) {
    return { proceed: true, eventRowId: inserted[0].id }
  }

  // Conflito: já existe. Decide pelo status atual.
  const { data: existing } = await admin
    .from('webhook_events')
    .select('id, status')
    .eq('provider', provider)
    .eq('event_id', eventId)
    .maybeSingle()

  if (!existing) return { proceed: true, eventRowId: null } // corrida rara — processa
  if (existing.status === 'processed') return { proceed: false, eventRowId: existing.id }

  // Estava em erro/processing — reprocessa e marca tentativa.
  await admin
    .from('webhook_events')
    .update({ status: 'processing', attempts: await nextAttempts(admin, existing.id) })
    .eq('id', existing.id)
  return { proceed: true, eventRowId: existing.id }
}

async function nextAttempts(admin: SupabaseClient, id: string): Promise<number> {
  const { data } = await admin.from('webhook_events').select('attempts').eq('id', id).maybeSingle()
  return (data?.attempts ?? 1) + 1
}

export async function finishWebhookEvent(
  admin: SupabaseClient,
  eventRowId: string | null,
  status: 'processed' | 'error' | 'ignored',
  errorMessage?: string,
): Promise<void> {
  if (!eventRowId) return
  await admin
    .from('webhook_events')
    .update({ status, error_message: errorMessage ?? null })
    .eq('id', eventRowId)
}
