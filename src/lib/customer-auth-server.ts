import type { SupabaseClient } from '@supabase/supabase-js'

export type CustomerActiveSession = {
  sessionId: string
  slug: string
  restaurantName: string
  logoUrl: string | null
  tableNumber: string
  status: string
}

type SessionRow = {
  id: string
  status: string
  table: { number: string } | { number: string }[] | null
  restaurant: { name: string; slug: string; logo_url: string | null } | { name: string; slug: string; logo_url: string | null }[] | null
}

/** Sessão aberta mais recente do cliente (open / closing). */
export async function findCustomerActiveSession(
  supabase: SupabaseClient,
  customerId: string,
): Promise<CustomerActiveSession | null> {
  const { data: participations } = await supabase
    .from('session_participants')
    .select(`
      joined_at,
      session_id,
      sessions(
        id,
        status,
        table:tables(number),
        restaurant:restaurants(name, slug, logo_url)
      )
    `)
    .eq('customer_id', customerId)
    .order('joined_at', { ascending: false })
    .limit(10)

  for (const row of participations ?? []) {
    const sessRaw = row.sessions as SessionRow | SessionRow[] | null
    const sess = Array.isArray(sessRaw) ? sessRaw[0] : sessRaw
    if (!sess || !['open', 'closing'].includes(sess.status)) continue

    const tableRaw = sess.table
    const table = Array.isArray(tableRaw) ? tableRaw[0] : tableRaw
    const restRaw = sess.restaurant
    const rest = Array.isArray(restRaw) ? restRaw[0] : restRaw

    return {
      sessionId: sess.id,
      slug: rest?.slug ?? '',
      restaurantName: rest?.name ?? 'Restaurante',
      logoUrl: rest?.logo_url ?? null,
      tableNumber: table?.number ?? '—',
      status: sess.status,
    }
  }

  return null
}
