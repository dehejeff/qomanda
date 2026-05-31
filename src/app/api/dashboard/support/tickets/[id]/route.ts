import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { fetchTicketDetail, uploadSupportAttachment } from '@/lib/support-tickets'

type RouteParams = { params: Promise<{ id: string }> }

async function getOwnerRestaurant() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: NextResponse.json({ error: 'Não autenticado.' }, { status: 401 }) }

  const { data: restaurant } = await supabase
    .from('restaurants')
    .select('id, name')
    .eq('owner_id', user.id)
    .single()

  if (!restaurant) {
    return { error: NextResponse.json({ error: 'Restaurante não encontrado.' }, { status: 404 }) }
  }

  return { user, restaurant, admin: createAdminClient() }
}

/**
 * GET /api/dashboard/support/tickets/[id]
 */
export async function GET(_req: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params
    const ctx = await getOwnerRestaurant()
    if ('error' in ctx && ctx.error) return ctx.error
    const { restaurant, admin } = ctx as Exclude<typeof ctx, { error: NextResponse }>

    const ticket = await fetchTicketDetail(admin, id, restaurant.id)
    if (!ticket) return NextResponse.json({ error: 'Ticket não encontrado.' }, { status: 404 })

    return NextResponse.json({ ticket })
  } catch (err) {
    console.error('[Support ticket GET]', err)
    return NextResponse.json({ error: 'Erro ao carregar ticket.' }, { status: 500 })
  }
}

/**
 * POST /api/dashboard/support/tickets/[id]
 * multipart reply: body, files[]
 */
export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params
    const ctx = await getOwnerRestaurant()
    if ('error' in ctx && ctx.error) return ctx.error
    const { user, restaurant, admin } = ctx as Exclude<typeof ctx, { error: NextResponse }>

    const { data: existing } = await admin
      .from('support_tickets')
      .select('id, status')
      .eq('id', id)
      .eq('restaurant_id', restaurant.id)
      .maybeSingle()

    if (!existing) return NextResponse.json({ error: 'Ticket não encontrado.' }, { status: 404 })
    if (existing.status === 'closed') {
      return NextResponse.json({ error: 'Este ticket está encerrado.' }, { status: 400 })
    }

    const formData = await req.formData()
    const body = String(formData.get('body') ?? '').trim()
    if (!body || body.length < 1) {
      return NextResponse.json({ error: 'Escreva uma mensagem.' }, { status: 400 })
    }

    const now = new Date().toISOString()
    const authorName = user.user_metadata?.full_name ?? user.user_metadata?.name ?? null

    const { data: message, error: msgErr } = await admin
      .from('support_ticket_messages')
      .insert({
        ticket_id: id,
        author_type: 'restaurant',
        author_user_id: user.id,
        author_name: authorName,
        author_email: user.email,
        body,
      })
      .select('*')
      .single()

    if (msgErr) throw msgErr

    const files = formData.getAll('files').filter((f): f is File => f instanceof File && f.size > 0)
    for (const file of files.slice(0, 5)) {
      try {
        await uploadSupportAttachment(admin, {
          restaurantId: restaurant.id,
          ticketId: id,
          file,
          uploadedBy: user.id,
          messageId: message.id,
        })
      } catch (uploadErr) {
        console.error('[Support reply attachment]', uploadErr)
      }
    }

    const ticketPatch: Record<string, unknown> = {
      last_message_at: now,
      updated_at: now,
    }
    if (existing.status === 'waiting_customer' || existing.status === 'resolved') {
      ticketPatch.status = 'open'
    }

    await admin.from('support_tickets').update(ticketPatch).eq('id', id)

    const ticket = await fetchTicketDetail(admin, id, restaurant.id)
    return NextResponse.json({ ok: true, ticket })
  } catch (err) {
    console.error('[Support ticket POST]', err)
    return NextResponse.json({ error: 'Erro ao enviar mensagem.' }, { status: 500 })
  }
}
