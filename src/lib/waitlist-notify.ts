import type { SupabaseClient } from '@supabase/supabase-js'
import { sendRestaurantWhatsApp } from '@/lib/send-whatsapp'
import {
  DEFAULT_WAITLIST_READY_TEMPLATE,
  DEFAULT_WAITLIST_RESERVE_TEMPLATE,
  formatTableLabel,
  formatTablesLabel,
  primaryGreeting,
  renderWaitlistTemplate,
  secondaryGreeting,
  type WaitlistMessageVars,
} from '@/lib/waitlist-messages'

type RestaurantTemplates = {
  name?: string
  waitlist_tolerance_minutes?: number
  waitlist_ready_whatsapp_template?: string | null
  waitlist_reserve_whatsapp_template?: string | null
}

function buildReadyMessage(
  template: string | null | undefined,
  vars: WaitlistMessageVars,
): string {
  return renderWaitlistTemplate(template, vars, DEFAULT_WAITLIST_READY_TEMPLATE)
}

function buildReserveMessage(
  template: string | null | undefined,
  vars: WaitlistMessageVars,
): string {
  return renderWaitlistTemplate(template, vars, DEFAULT_WAITLIST_RESERVE_TEMPLATE)
}

async function loadEntryRecipients(
  admin: SupabaseClient,
  entryId: string,
): Promise<{
  restaurantId: string
  customerName: string
  whatsapp: string
  secondaryWhatsapp: string | null
  restaurant: RestaurantTemplates
  featureLabel: string
  tableNumber: string | null
  tableNumbers: string[]
  partySize: number
} | null> {
  const { data: entry } = await admin
    .from('table_waitlist')
    .select(`
      id, restaurant_id, name, whatsapp, whatsapp_secondary, party_size,
      feature:table_features(name, emoji),
      table:tables!notified_table_id(number),
      restaurant:restaurants(
        name, waitlist_tolerance_minutes,
        waitlist_ready_whatsapp_template, waitlist_reserve_whatsapp_template
      )
    `)
    .eq('id', entryId)
    .maybeSingle()

  if (!entry || !entry.whatsapp?.trim()) return null

  const { data: allocs } = await admin
    .from('table_waitlist_allocations')
    .select('table:tables(number)')
    .eq('waitlist_id', entryId)

  const tableNumbers: string[] = []
  for (const a of allocs ?? []) {
    const t = Array.isArray(a.table) ? a.table[0] : a.table
    const num = (t as { number?: string } | null)?.number
    if (num) tableNumbers.push(num)
  }

  const feat = Array.isArray(entry.feature) ? entry.feature[0] : entry.feature
  const tbl = Array.isArray(entry.table) ? entry.table[0] : entry.table
  const rest = Array.isArray(entry.restaurant) ? entry.restaurant[0] : entry.restaurant
  const featureLabel = `${(feat as { emoji?: string | null })?.emoji ?? ''} ${(feat as { name?: string })?.name ?? 'Mesa'}`.trim()

  return {
    restaurantId: entry.restaurant_id as string,
    customerName: entry.name as string,
    whatsapp: entry.whatsapp as string,
    secondaryWhatsapp: (entry.whatsapp_secondary as string | null)?.trim() || null,
    restaurant: (rest ?? {}) as RestaurantTemplates,
    featureLabel,
    tableNumber: (tbl as { number?: string } | null)?.number ?? null,
    tableNumbers,
    partySize: Number(entry.party_size) || 1,
  }
}

function baseVars(
  ctx: NonNullable<Awaited<ReturnType<typeof loadEntryRecipients>>>,
  forSecondary: boolean,
): WaitlistMessageVars {
  const tolerance = Number(ctx.restaurant.waitlist_tolerance_minutes ?? 10)
  const mesa = formatTableLabel(ctx.tableNumber)
  const mesas = formatTablesLabel(ctx.tableNumbers)
  return {
    saudacao: forSecondary ? secondaryGreeting(ctx.customerName) : primaryGreeting(ctx.customerName),
    nome: ctx.customerName,
    restaurante: ctx.restaurant.name ?? 'Restaurante',
    mesa,
    mesas: mesas !== '—' ? mesas : mesa,
    secao: ctx.featureLabel,
    prazo: String(tolerance),
    pessoas: String(ctx.partySize),
  }
}

async function enqueueForRecipients(
  admin: SupabaseClient,
  ctx: NonNullable<Awaited<ReturnType<typeof loadEntryRecipients>>>,
  messageFor: (forSecondary: boolean) => string,
): Promise<void> {
  const recipients: { to: string; forSecondary: boolean }[] = [
    { to: ctx.whatsapp, forSecondary: false },
  ]
  if (ctx.secondaryWhatsapp) {
    recipients.push({ to: ctx.secondaryWhatsapp, forSecondary: true })
  }

  for (const r of recipients) {
    await sendRestaurantWhatsApp(admin, ctx.restaurantId, r.to, messageFor(r.forSecondary))
  }
}

/** Enfileira WhatsApp quando a mesa é chamada na fila (status notified). */
export async function enqueueWaitlistReadyNotifications(
  admin: SupabaseClient,
  entryId: string,
): Promise<void> {
  try {
    const { data: entry } = await admin
      .from('table_waitlist')
      .select('id, status, whatsapp_notified_at')
      .eq('id', entryId)
      .maybeSingle()

    if (!entry || entry.status !== 'notified' || entry.whatsapp_notified_at) return

    const ctx = await loadEntryRecipients(admin, entryId)
    if (!ctx) return

    await enqueueForRecipients(admin, ctx, (forSecondary) =>
      buildReadyMessage(ctx.restaurant.waitlist_ready_whatsapp_template, baseVars(ctx, forSecondary)),
    )

    await admin
      .from('table_waitlist')
      .update({ whatsapp_notified_at: new Date().toISOString() })
      .eq('id', entryId)
  } catch (err) {
    console.error('[waitlist-notify ready]', entryId, err)
  }
}

/** Enfileira WhatsApp de confirmação ao reservar mesas (grid ou fila). */
export async function enqueueWaitlistReserveNotifications(
  admin: SupabaseClient,
  entryId: string,
): Promise<void> {
  try {
    const ctx = await loadEntryRecipients(admin, entryId)
    if (!ctx) return

    await enqueueForRecipients(admin, ctx, (forSecondary) =>
      buildReserveMessage(ctx.restaurant.waitlist_reserve_whatsapp_template, baseVars(ctx, forSecondary)),
    )
  } catch (err) {
    console.error('[waitlist-notify reserve]', entryId, err)
  }
}
