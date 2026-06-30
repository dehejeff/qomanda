import { requireStaff, StaffAuthError } from '@/lib/staff-auth'
import { mapLeadRow } from '@/lib/crm-leads'
import { CrmBoard } from '@/components/internal/crm/CrmBoard'
import { redirect } from 'next/navigation'

export const metadata = { title: 'CRM — Qomanda' }

export default async function CrmPage() {
  let staffCtx
  try {
    staffCtx = await requireStaff()
  } catch (err) {
    if (err instanceof StaffAuthError) redirect('/internal/login')
    throw err
  }

  const { data, error } = await staffCtx.admin
    .from('leads')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(500)

  if (error) console.error('[CRM page]', error)

  const leads = (data ?? []).map(row => mapLeadRow(row as Record<string, unknown>))

  return (
    <div className="flex-1 p-6 md:p-8 overflow-hidden">
      <div className="mb-8">
        <h1 className="text-2xl font-black text-white tracking-tight">CRM</h1>
        <p className="text-sm mt-1 font-mono" style={{ color: '#475569' }}>
          Pipeline de leads comerciais · <span style={{ color: '#64748b' }}>acesso via <code className="text-xs">/lead</code></span>
        </p>
      </div>

      <CrmBoard initialLeads={leads} />
    </div>
  )
}
