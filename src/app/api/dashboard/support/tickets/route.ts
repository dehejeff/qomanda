import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import {
  fetchTicketDetail,
  isSupportCategory,
  mapTicketRow,
  uploadSupportAttachment,
} from '@/lib/support-tickets'

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
 * GET /api/dashboard/support/tickets
 */
export async function GET() {
  try {
    const ctx = await getOwnerRestaurant()
    if ('error' in ctx && ctx.error) return ctx.error
    const { restaurant, admin } = ctx as Exclude<typeof ctx, { error: NextResponse }>

    const { data, error } = await admin
      .from('support_tickets')
      .select('*')
      .eq('restaurant_id', restaurant.id)
      .order('last_message_at', { ascending: false })
      .limit(50)

    if (error) throw error

    const tickets = (data ?? []).map(row => mapTicketRow(row as Record<string, unknown>, restaurant.name))
    return NextResponse.json({ tickets })
  } catch (err) {
    console.error('[Support tickets GET]', err)
    return NextResponse.json({ error: 'Erro ao carregar tickets.' }, { status: 500 })
  }
}

/**
 * POST /api/dashboard/support/tickets
 * multipart: subject, category, body, files[]
 */
export async function POST(req: NextRequest) {
  try {
    const ctx = await getOwnerRestaurant()
    if ('error' in ctx && ctx.error) return ctx.error
    const { user, restaurant, admin } = ctx as Exclude<typeof ctx, { error: NextResponse }>

    const formData = await req.formData()
    const subject = String(formData.get('subject') ?? '').trim()
    const category = String(formData.get('category') ?? 'other')
    const body = String(formData.get('body') ?? '').trim()

    if (!subject || subject.length < 3) {
      return NextResponse.json({ error: 'Informe um assunto com pelo menos 3 caracteres.' }, { status: 400 })
    }
    if (!body || body.length < 5) {
      return NextResponse.json({ error: 'Descreva sua solicitação com pelo menos 5 caracteres.' }, { status: 400 })
    }
    if (!isSupportCategory(category)) {
      return NextResponse.json({ error: 'Categoria inválida.' }, { status: 400 })
    }

    const now = new Date().toISOString()
    const authorName = user.user_metadata?.full_name ?? user.user_metadata?.name ?? null

    const { data: ticket, error: ticketErr } = await admin
      .from('support_tickets')
      .insert({
        restaurant_id: restaurant.id,
        subject,
        category,
        status: 'open',
        priority: 'normal',
        created_by: user.id,
        created_by_email: user.email,
        created_by_name: authorName,
        last_message_at: now,
        updated_at: now,
      })
      .select('*')
      .single()

    if (ticketErr) throw ticketErr

    const { data: message, error: msgErr } = await admin
      .from('support_ticket_messages')
      .insert({
        ticket_id: ticket.id,
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
    const attachments = []
    for (const file of files.slice(0, 5)) {
      try {
        const att = await uploadSupportAttachment(admin, {
          restaurantId: restaurant.id,
          ticketId: ticket.id,
          file,
          uploadedBy: user.id,
          messageId: message.id,
        })
        attachments.push(att)
      } catch (uploadErr) {
        console.error('[Support ticket attachment]', uploadErr)
      }
    }

    const detail = await fetchTicketDetail(admin, ticket.id, restaurant.id)
    return NextResponse.json({ ok: true, ticket: detail, attachmentsUploaded: attachments.length })
  } catch (err) {
    console.error('[Support tickets POST]', err)
    return NextResponse.json({ error: 'Erro ao abrir ticket.' }, { status: 500 })
  }
}
