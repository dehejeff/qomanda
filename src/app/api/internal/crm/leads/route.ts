import { NextResponse } from 'next/server'
import { StaffAuthError, requireStaff } from '@/lib/staff-auth'
import { mapLeadRow, type Lead, type LeadStatus } from '@/lib/crm-leads'

export async function GET() {
  try {
    const { admin } = await requireStaff()

    const { data, error } = await admin
      .from('leads')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(500)

    if (error) throw error

    const leads = (data ?? []).map(row => mapLeadRow(row as Record<string, unknown>))

    const grouped = leads.reduce<Record<LeadStatus, Lead[]>>((acc, lead) => {
      if (!acc[lead.status]) acc[lead.status] = []
      acc[lead.status].push(lead)
      return acc
    }, {} as Record<LeadStatus, Lead[]>)

    return NextResponse.json({ leads, grouped, total: leads.length })
  } catch (err) {
    if (err instanceof StaffAuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    console.error('[CRM leads GET]', err)
    return NextResponse.json({ error: 'Erro ao carregar leads.' }, { status: 500 })
  }
}
