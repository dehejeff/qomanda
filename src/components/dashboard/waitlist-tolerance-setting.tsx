'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'

/** Tolerância (minutos) para o cliente ocupar a mesa após ser chamado na fila. */
export function WaitlistToleranceSetting() {
  const [minutes, setMinutes] = useState('10')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetch('/api/dashboard/table-features')
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.toleranceMinutes != null) setMinutes(String(d.toleranceMinutes)) })
      .catch(() => {})
  }, [])

  async function save() {
    const m = Math.max(1, Math.min(120, Math.round(Number(minutes) || 10)))
    setMinutes(String(m))
    setSaving(true)
    try {
      const res = await fetch('/api/dashboard/table-features', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ minutes: m }),
      })
      if (!res.ok) throw new Error()
      toast.success('Tolerância da fila salva!')
    } catch {
      toast.error('Erro ao salvar.')
    } finally { setSaving(false) }
  }

  return (
    <div className="bg-surface-container border border-outline-variant rounded-xl p-5">
      <h3 className="text-base font-bold text-on-surface">Fila de espera</h3>
      <p className="text-xs text-on-surface-variant mt-1 leading-relaxed">
        Tempo de tolerância para o cliente ocupar a mesa depois de ser chamado na fila. Ao esgotar, o próximo da fila é chamado.
      </p>
      <div className="flex items-center gap-3 mt-3 flex-wrap">
        <input
          type="number" min={1} max={120} value={minutes}
          onChange={e => setMinutes(e.target.value)}
          className="h-10 w-20 px-3 text-center rounded-lg bg-surface-container-low border border-outline-variant text-on-surface text-sm outline-none"
        />
        <span className="text-sm text-on-surface-variant">minutos</span>
        <button type="button" onClick={save} disabled={saving}
          className="px-4 h-10 rounded-lg bg-primary-container text-on-primary-container font-bold text-sm disabled:opacity-50">
          {saving ? 'Salvando…' : 'Salvar'}
        </button>
      </div>
    </div>
  )
}
