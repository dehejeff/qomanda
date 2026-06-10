import type { SupabaseClient } from '@supabase/supabase-js'
import { enqueueWhatsApp } from '@/lib/job-queue'

function buildWaitlistReadyMessage(params: {
  restaurantName: string
  customerName: string
  featureLabel: string
  tableNumber: string | null
  toleranceMinutes: number
  forSecondary: boolean
}): string {
  const mesa = params.tableNumber ? `Mesa ${params.tableNumber}` : 'Sua mesa'
  const prazo = params.toleranceMinutes
  const greeting = params.forSecondary
    ? `Olá! A mesa do grupo de *${params.customerName}* está pronta.`
    : `Olá *${params.customerName}*!`
  return [
    `${greeting}`,
    ``,
    `*${params.restaurantName}* — ${params.featureLabel}`,
    `${mesa} disponível agora.`,
    ``,
    `Dirija-se ao restaurante em até *${prazo} min* para ocupar.`,
    `Se não puder vir, avise a recepção para liberarmos a vaga.`,
  ].join('\n')
}

/** Enfileira WhatsApp para titular e contato secundário (best-effort). */
export async function enqueueWaitlistReadyNotifications(
  admin: SupabaseClient,
  entryId: string,
): Promise<void> {
  try {
    const { data: entry } = await admin
      .from('table_waitlist')
      .select(`
        id, restaurant_id, name, whatsapp, whatsapp_secondary, secondary_name,
        whatsapp_notified_at, status,
        feature:table_features(name, emoji),
        table:tables!notified_table_id(number),
        restaurant:restaurants(name, waitlist_tolerance_minutes)
      `)
      .eq('id', entryId)
      .maybeSingle()

    if (!entry || entry.status !== 'notified' || entry.whatsapp_notified_at) return
    if (!entry.whatsapp?.trim()) return

    const feat = Array.isArray(entry.feature) ? entry.feature[0] : entry.feature
    const tbl = Array.isArray(entry.table) ? entry.table[0] : entry.table
    const rest = Array.isArray(entry.restaurant) ? entry.restaurant[0] : entry.restaurant
    const restaurantName = (rest as { name?: string })?.name ?? 'Restaurante'
    const tolerance = Number((rest as { waitlist_tolerance_minutes?: number })?.waitlist_tolerance_minutes ?? 10)
    const featureLabel = `${(feat as { emoji?: string | null })?.emoji ?? ''} ${(feat as { name?: string })?.name ?? 'Mesa'}`.trim()
    const tableNumber = (tbl as { number?: string } | null)?.number ?? null
    const customerName = entry.name as string

    const recipients: { to: string; forSecondary: boolean }[] = [
      { to: entry.whatsapp as string, forSecondary: false },
    ]
    if (entry.whatsapp_secondary?.trim()) {
      recipients.push({ to: entry.whatsapp_secondary as string, forSecondary: true })
    }

    for (const r of recipients) {
      await enqueueWhatsApp(admin, {
        restaurantId: entry.restaurant_id as string,
        to: r.to,
        message: buildWaitlistReadyMessage({
          restaurantName,
          customerName,
          featureLabel,
          tableNumber,
          toleranceMinutes: tolerance,
          forSecondary: r.forSecondary,
        }),
      })
    }

    await admin
      .from('table_waitlist')
      .update({ whatsapp_notified_at: new Date().toISOString() })
      .eq('id', entryId)
  } catch (err) {
    console.error('[waitlist-notify]', entryId, err)
  }
}
