import type { SupabaseClient } from '@supabase/supabase-js'
import { sendTransactionalEmail } from '@/lib/send-email'
import {
  buildNfeRetentionEmailHtml,
  buildNfeRetentionEmailText,
  buildNfeRetentionNotification,
  formatPurgeDate,
  NFE_RETENTION_REMINDER_DAYS,
  nfeAgeDaysForReminder,
  type NfeRetentionReminderDay,
  type RestaurantNotificationDto,
} from '@/lib/nfe-retention-reminders'

export type NfeReminderRunResult = {
  day: NfeRetentionReminderDay
  restaurantsNotified: number
  emailsSent: number
  emailsFailed: number
}

export type NfeReminderBatchResult = {
  ok: true
  runs: NfeReminderRunResult[]
  totalNotifications: number
}

function brDateKey(d: Date): string {
  return d.toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' })
}

function addDays(d: Date, days: number): Date {
  const out = new Date(d)
  out.setDate(out.getDate() + days)
  return out
}

async function resolveOwnerEmail(
  admin: SupabaseClient,
  restaurant: { owner_id: string; contact_email?: string | null },
): Promise<{ email: string; name: string } | null> {
  const { data: authUser } = await admin.auth.admin.getUserById(restaurant.owner_id)
  const email = authUser.user?.email ?? restaurant.contact_email?.trim()
  if (!email) return null
  const meta = authUser.user?.user_metadata as { name?: string } | undefined
  const name = meta?.name?.split(' ')[0] ?? 'Responsável'
  return { email, name }
}

function brDateKeyFromIso(iso: string): string {
  return new Date(iso).toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' })
}

function resolveAppBaseUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_APP_URL ?? process.env.APP_URL
  if (explicit) return explicit.replace(/\/$/, '')
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`
  return 'http://localhost:3000'
}

async function processReminderDay(
  admin: SupabaseClient,
  today: Date,
  daysBefore: NfeRetentionReminderDay,
  appBaseUrl: string,
): Promise<NfeReminderRunResult> {
  const ageDays = nfeAgeDaysForReminder(daysBefore)
  const targetDate = addDays(today, -ageDays)
  const createdOn = brDateKey(targetDate)
  const purgeOn = formatPurgeDate(daysBefore, today)
  const scheduledFor = brDateKey(today)

  const windowStart = addDays(targetDate, -2).toISOString()
  const windowEnd = addDays(targetDate, 2).toISOString()

  const { data: rawRows } = await admin
    .from('nfe_invoices')
    .select('id, created_at, restaurant_id, restaurant:restaurants(id, name, owner_id, contact_email)')
    .gte('created_at', windowStart)
    .lte('created_at', windowEnd)
    .in('status', ['issued', 'simulated', 'processing'])

  const rows = (rawRows ?? []).filter(r => brDateKeyFromIso(r.created_at) === createdOn)

  const byRestaurant = new Map<string, { count: number; restaurant: { id: string; name: string; owner_id: string; contact_email?: string | null } }>()

  for (const row of rows ?? []) {
    const restRaw = row.restaurant
    const rest = (Array.isArray(restRaw) ? restRaw[0] : restRaw) as {
      id: string
      name: string
      owner_id: string
      contact_email?: string | null
    } | null
    if (!rest) continue
    const existing = byRestaurant.get(rest.id)
    if (existing) {
      existing.count += 1
    } else {
      byRestaurant.set(rest.id, { count: 1, restaurant: rest })
    }
  }

  let restaurantsNotified = 0
  let emailsSent = 0
  let emailsFailed = 0

  for (const [restaurantId, { count, restaurant }] of byRestaurant) {
    const { data: existingLog } = await admin
      .from('nfe_retention_reminder_log')
      .select('id')
      .eq('restaurant_id', restaurantId)
      .eq('days_before', daysBefore)
      .eq('scheduled_for', scheduledFor)
      .maybeSingle()

    if (existingLog) continue

    const copy = buildNfeRetentionNotification(daysBefore, count, purgeOn)

    const { data: notification, error: notifErr } = await admin
      .from('restaurant_notifications')
      .insert({
        restaurant_id: restaurantId,
        type: 'nfe_retention',
        title: copy.title,
        body: copy.body,
        link: copy.link,
        severity: daysBefore === 5 ? 'critical' : daysBefore === 15 ? 'warning' : 'info',
        metadata: {
          daysBefore,
          nfeCount: count,
          purgeOn,
          scheduledFor,
        },
      })
      .select('id')
      .single()

    if (notifErr || !notification) {
      console.error('[nfe retention reminder] notification', notifErr)
      continue
    }

    restaurantsNotified += 1

    const owner = await resolveOwnerEmail(admin, restaurant)
    let emailSent = false
    let emailTo: string | null = null
    let emailError: string | null = null

    if (owner) {
      const settingsUrl = `${appBaseUrl.replace(/\/$/, '')}/dashboard/settings?tab=notas#nfe-notas`
      const subject =
        daysBefore === 5
          ? `[Qomanda] Último aviso: ${count} NF-e serão removidas em 5 dias`
          : `[Qomanda] ${count} NF-e serão removidas em ${daysBefore} dias — ${restaurant.name}`

      const emailResult = await sendTransactionalEmail({
        to: owner.email,
        subject,
        html: buildNfeRetentionEmailHtml({
          restaurantName: restaurant.name,
          ownerName: owner.name,
          daysBefore,
          nfeCount: count,
          purgeOn,
          settingsUrl,
        }),
        text: buildNfeRetentionEmailText({
          restaurantName: restaurant.name,
          ownerName: owner.name,
          daysBefore,
          nfeCount: count,
          purgeOn,
        }),
      })

      emailTo = owner.email
      emailSent = emailResult.ok
      if (emailResult.ok) {
        emailsSent += 1
      } else {
        emailsFailed += 1
        emailError = emailResult.error
      }
    } else {
      emailError = 'E-mail do responsável não encontrado.'
      emailsFailed += 1
    }

    await admin.from('nfe_retention_reminder_log').insert({
      restaurant_id: restaurantId,
      days_before: daysBefore,
      scheduled_for: scheduledFor,
      nfe_count: count,
      purge_on: addDays(today, daysBefore).toISOString().slice(0, 10),
      notification_id: notification.id,
      email_sent: emailSent,
      email_to: emailTo,
      email_error: emailError,
    })
  }

  return { day: daysBefore, restaurantsNotified, emailsSent, emailsFailed }
}

export async function runNfeRetentionReminders(
  admin: SupabaseClient,
  opts: { appBaseUrl?: string; now?: Date } = {},
): Promise<NfeReminderBatchResult> {
  const today = opts.now ?? new Date()
  const appBaseUrl = opts.appBaseUrl ?? resolveAppBaseUrl()

  const runs: NfeReminderRunResult[] = []

  for (const daysBefore of NFE_RETENTION_REMINDER_DAYS) {
    runs.push(await processReminderDay(admin, today, daysBefore, appBaseUrl))
  }

  return {
    ok: true,
    runs,
    totalNotifications: runs.reduce((s, r) => s + r.restaurantsNotified, 0),
  }
}

export type { RestaurantNotificationDto }

export async function fetchRestaurantNotifications(
  admin: SupabaseClient,
  restaurantId: string,
  limit = 20,
): Promise<RestaurantNotificationDto[]> {
  const { data, error } = await admin
    .from('restaurant_notifications')
    .select('*')
    .eq('restaurant_id', restaurantId)
    .is('dismissed_at', null)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error || !data?.length) return []

  return data.map(row => ({
    id: row.id,
    type: row.type,
    title: row.title,
    body: row.body,
    link: row.link,
    severity: row.severity as RestaurantNotificationDto['severity'],
    readAt: row.read_at,
    createdAt: row.created_at,
    metadata: (row.metadata ?? {}) as Record<string, unknown>,
  }))
}

export async function markNotificationRead(
  admin: SupabaseClient,
  restaurantId: string,
  notificationId: string,
): Promise<boolean> {
  const { error } = await admin
    .from('restaurant_notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('id', notificationId)
    .eq('restaurant_id', restaurantId)

  return !error
}

export async function markAllNotificationsRead(
  admin: SupabaseClient,
  restaurantId: string,
): Promise<void> {
  const now = new Date().toISOString()
  await admin
    .from('restaurant_notifications')
    .update({ read_at: now })
    .eq('restaurant_id', restaurantId)
    .is('read_at', null)
    .is('dismissed_at', null)
}

export async function countUnreadNotifications(
  admin: SupabaseClient,
  restaurantId: string,
): Promise<number> {
  const { count } = await admin
    .from('restaurant_notifications')
    .select('*', { count: 'exact', head: true })
    .eq('restaurant_id', restaurantId)
    .is('read_at', null)
    .is('dismissed_at', null)

  return count ?? 0
}
