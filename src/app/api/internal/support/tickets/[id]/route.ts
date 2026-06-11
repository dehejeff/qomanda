import { NextRequest, NextResponse } from 'next/server'
import { StaffAuthError, requireStaff } from '@/lib/staff-auth'
import {
  fetchTicketDetail,
  isSupportPriority,
  isSupportStatus,
  uploadSupportAttachment,
} from '@/lib/support-tickets'

type RouteParams = { params: Promise<{ id: string }> }

/**
 * GET /api/internal/support/tickets/[id]
 */
export async function GET(_req: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params
    const { admin } = await requireStaff()

    const ticket = await fetchTicketDetail(admin, id)
    if (!ticket) return NextResponse.json({ error: 'Ticket não encontrado.' }, { status: 404 })

    return NextResponse.json({ ticket })
  } catch (err) {
    if (err instanceof StaffAuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    console.error('[Internal support ticket GET]', err)
    return NextResponse.json({ error: 'Erro ao carregar ticket.' }, { status: 500 })
  }
}

type PatchBody = {
  status?: string
  priority?: string
}

/**
 * PATCH /api/internal/support/tickets/[id]
 */
export async function PATCH(req: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params
    const { admin } = await requireStaff()
    const body = (await req.json()) as PatchBody

    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }

    if (body.status != null) {
      if (!isSupportStatus(body.status)) {
        return NextResponse.json({ error: 'Status inválido.' }, { status: 400 })
      }
      patch.status = body.status
      patch.closed_at = body.status === 'closed' ? new Date().toISOString() : null
    }

    if (body.priority != null) {
      if (!isSupportPriority(body.priority)) {
        return NextResponse.json({ error: 'Prioridade inválida.' }, { status: 400 })
      }
      patch.priority = body.priority
    }

    if (Object.keys(patch).length <= 1) {
      return NextResponse.json({ error: 'Nada para atualizar.' }, { status: 400 })
    }

    if (patch.status === 'in_progress' || patch.status === 'waiting_customer') {
      // auto-move to in_progress when staff updates
    }

    const { error } = await admin.from('support_tickets').update(patch).eq('id', id)
    if (error) throw error

    const ticket = await fetchTicketDetail(admin, id)
    return NextResponse.json({ ok: true, ticket })
  } catch (err) {
    if (err instanceof StaffAuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    console.error('[Internal support PATCH]', err)
    return NextResponse.json({ error: 'Erro ao atualizar ticket.' }, { status: 500 })
  }
}

/**
 * POST /api/internal/support/tickets/[id]
 * staff reply — multipart: body, files[]
 */
export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params
    const { admin, user } = await requireStaff()

    const { data: existing } = await admin
      .from('support_tickets')
      .select('id, restaurant_id, status')
      .eq('id', id)
      .maybeSingle()

    if (!existing) return NextResponse.json({ error: 'Ticket não encontrado.' }, { status: 404 })

    const formData = await req.formData()
    const body = String(formData.get('body') ?? '').trim()
    if (!body) return NextResponse.json({ error: 'Escreva uma resposta.' }, { status: 400 })

    const now = new Date().toISOString()
    const authorName = user.user_metadata?.full_name ?? user.user_metadata?.name ?? user.email ?? 'Equipe KiComanda'

    const { data: message, error: msgErr } = await admin
      .from('support_ticket_messages')
      .insert({
        ticket_id: id,
        author_type: 'staff',
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
          restaurantId: existing.restaurant_id,
          ticketId: id,
          file,
          uploadedBy: user.id,
          messageId: message.id,
        })
      } catch (uploadErr) {
        console.error('[Staff support attachment]', uploadErr)
      }
    }

    const ticketPatch: Record<string, unknown> = {
      last_message_at: now,
      updated_at: now,
      status: 'waiting_customer',
    }
    if (existing.status === 'open') ticketPatch.status = 'in_progress'

    await admin.from('support_tickets').update(ticketPatch).eq('id', id)

    const ticket = await fetchTicketDetail(admin, id)
    return NextResponse.json({ ok: true, ticket })
  } catch (err) {
    if (err instanceof StaffAuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    console.error('[Internal support POST]', err)
    return NextResponse.json({ error: 'Erro ao responder ticket.' }, { status: 500 })
  }
}
