import { NextRequest, NextResponse } from 'next/server'
import { StaffAuthError, requireStaff } from '@/lib/staff-auth'
import { isLeadStatus } from '@/lib/crm-leads'

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { admin } = await requireStaff()
    const { id } = await params
    const body = await req.json() as Record<string, unknown>

    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }

    if ('status' in body) {
      if (!isLeadStatus(String(body.status))) {
        return NextResponse.json({ error: 'Status inválido.' }, { status: 400 })
      }
      patch.status = body.status
    }

    if ('notes' in body) {
      patch.notes = typeof body.notes === 'string' ? body.notes || null : null
    }

    const { error } = await admin
      .from('leads')
      .update(patch)
      .eq('id', id)

    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (err) {
    if (err instanceof StaffAuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    console.error('[CRM leads PATCH]', err)
    return NextResponse.json({ error: 'Erro ao atualizar lead.' }, { status: 500 })
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { admin } = await requireStaff()
    const { id } = await params

    const { error } = await admin.from('leads').delete().eq('id', id)
    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (err) {
    if (err instanceof StaffAuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    console.error('[CRM leads DELETE]', err)
    return NextResponse.json({ error: 'Erro ao remover lead.' }, { status: 500 })
  }
}
