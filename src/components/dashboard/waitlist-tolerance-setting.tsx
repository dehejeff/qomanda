'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { WAITLIST_TEMPLATE_PLACEHOLDERS } from '@/lib/waitlist-messages'

/** Tolerância e mensagens WhatsApp da fila / reserva de mesas. */
export function WaitlistToleranceSetting() {
  const [minutes, setMinutes] = useState('10')
  const [readyTemplate, setReadyTemplate] = useState('')
  const [reserveTemplate, setReserveTemplate] = useState('')
  const [defaultReady, setDefaultReady] = useState('')
  const [defaultReserve, setDefaultReserve] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetch('/api/dashboard/table-features')
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (!d) return
        if (d.toleranceMinutes != null) setMinutes(String(d.toleranceMinutes))
        setReadyTemplate(d.readyWhatsappTemplate ?? '')
        setReserveTemplate(d.reserveWhatsappTemplate ?? '')
        setDefaultReady(d.defaultReadyWhatsappTemplate ?? '')
        setDefaultReserve(d.defaultReserveWhatsappTemplate ?? '')
      })
      .catch(() => {})
  }, [])

  async function save() {
    const m = Math.max(1, Math.min(120, Math.round(Number(minutes) || 10)))
    setMinutes(String(m))
    setSaving(true)
    try {
      const res = await fetch('/api/dashboard/table-features', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          minutes: m,
          readyWhatsappTemplate: readyTemplate.trim() || null,
          reserveWhatsappTemplate: reserveTemplate.trim() || null,
        }),
      })
      if (!res.ok) throw new Error()
      toast.success('Configurações da fila salvas!')
    } catch {
      toast.error('Erro ao salvar.')
    } finally { setSaving(false) }
  }

  function restoreReady() { setReadyTemplate('') }
  function restoreReserve() { setReserveTemplate('') }

  return (
    <div className="bg-surface-container border border-outline-variant rounded-xl p-5 space-y-5">
      <div>
        <h3 className="text-base font-bold text-on-surface">Fila de espera</h3>
        <p className="text-xs text-on-surface-variant mt-1 leading-relaxed">
          Tolerância após chamar o cliente e textos do WhatsApp. Deixe em branco para usar o padrão do KiComanda.
        </p>
      </div>

      <div>
        <p className="text-xs font-semibold text-on-surface mb-2">Tolerância (minutos)</p>
        <div className="flex items-center gap-3 flex-wrap">
          <input
            type="number" min={1} max={120} value={minutes}
            onChange={e => setMinutes(e.target.value)}
            className="h-10 w-20 px-3 text-center rounded-lg bg-surface-container-low border border-outline-variant text-on-surface text-sm outline-none"
          />
          <span className="text-sm text-on-surface-variant">min para ocupar a mesa</span>
        </div>
      </div>

      <TemplateField
        label="Mesa pronta (fila)"
        hint="Enviado quando a mesa é chamada — fila de espera."
        value={readyTemplate}
        defaultPreview={defaultReady}
        onChange={setReadyTemplate}
        onRestore={restoreReady}
      />

      <TemplateField
        label="Confirmação de reserva"
        hint="Enviado ao reservar mesas pelo painel (grid ou apontar mesas na fila)."
        value={reserveTemplate}
        defaultPreview={defaultReserve}
        onChange={setReserveTemplate}
        onRestore={restoreReserve}
      />

      <p className="text-[11px] text-on-surface-variant leading-relaxed">
        Variáveis: {WAITLIST_TEMPLATE_PLACEHOLDERS.join(' ')}
        {' '}· <code className="text-[10px]">{'{saudacao}'}</code> muda automaticamente para o 2º contato.
      </p>

      <button type="button" onClick={save} disabled={saving}
        className="px-4 h-10 rounded-lg bg-primary-container text-on-primary-container font-bold text-sm disabled:opacity-50">
        {saving ? 'Salvando…' : 'Salvar fila e mensagens'}
      </button>
    </div>
  )
}

function TemplateField({
  label, hint, value, defaultPreview, onChange, onRestore,
}: {
  label: string
  hint: string
  value: string
  defaultPreview: string
  onChange: (v: string) => void
  onRestore: () => void
}) {
  return (
    <div>
      <div className="flex items-center justify-between gap-2 mb-1">
        <p className="text-xs font-semibold text-on-surface">{label}</p>
        {value.trim() && (
          <button type="button" onClick={onRestore}
            className="text-[11px] text-primary font-mono hover:opacity-80">
            Restaurar padrão
          </button>
        )}
      </div>
      <p className="text-[11px] text-on-surface-variant mb-2">{hint}</p>
      <textarea
        value={value}
        onChange={e => onChange(e.target.value)}
        rows={6}
        placeholder={defaultPreview || 'Texto padrão do KiComanda…'}
        className="w-full px-3 py-2 rounded-lg bg-surface-container-low border border-outline-variant text-on-surface text-xs font-mono leading-relaxed outline-none resize-y min-h-[120px]"
      />
    </div>
  )
}
