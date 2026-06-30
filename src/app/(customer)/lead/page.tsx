'use client'

import { useState } from 'react'
import { KiComandaLogo } from '@/components/kicomanda-logo'
import { RESTAURANT_TYPE_LABELS, type RestaurantType } from '@/lib/crm-leads'

type FormState = {
  name: string
  whatsapp: string
  email: string
  restaurantName: string
  restaurantType: RestaurantType | ''
}

const RESTAURANT_TYPES = Object.entries(RESTAURANT_TYPE_LABELS) as [RestaurantType, string][]

export default function LeadPage() {
  const [form, setForm]     = useState<FormState>({ name: '', whatsapp: '', email: '', restaurantName: '', restaurantType: '' })
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone]     = useState(false)
  const [error, setError]   = useState<string | null>(null)

  function setField(field: keyof FormState, value: string) {
    setForm(prev => ({ ...prev, [field]: value }))
    setError(null)
  }

  function formatWhatsApp(raw: string) {
    const digits = raw.replace(/\D/g, '').slice(0, 11)
    if (digits.length <= 2)  return digits
    if (digits.length <= 7)  return `(${digits.slice(0,2)}) ${digits.slice(2)}`
    return `(${digits.slice(0,2)}) ${digits.slice(2,7)}-${digits.slice(7)}`
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.restaurantType) { setError('Selecione o tipo de restaurante.'); return }
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name,
          whatsapp: form.whatsapp,
          email: form.email || null,
          restaurantName: form.restaurantName,
          restaurantType: form.restaurantType,
        }),
      })
      const data = await res.json() as { error?: string }
      if (!res.ok) { setError(data.error ?? 'Erro ao enviar.'); return }
      setDone(true)
    } catch {
      setError('Erro de conexão. Tente novamente.')
    } finally {
      setSubmitting(false)
    }
  }

  if (done) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6" style={{ background: 'linear-gradient(135deg, #0b1326 0%, #0f1e3a 100%)' }}>
        <div className="w-full max-w-sm text-center space-y-6">
          <div className="w-20 h-20 rounded-full mx-auto flex items-center justify-center" style={{ background: 'rgba(34,197,94,0.15)', border: '2px solid rgba(34,197,94,0.4)' }}>
            <span className="material-symbols-outlined text-5xl" style={{ color: '#22c55e' }}>check_circle</span>
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Obrigado, {form.name.split(' ')[0]}!</h1>
            <p className="text-sm mt-2" style={{ color: '#94a3b8' }}>
              Recebemos seu interesse. Em breve nossa equipe entrará em contato pelo WhatsApp para apresentar a solução.
            </p>
          </div>
          <div className="rounded-xl p-4 text-left space-y-1" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
            <p className="text-xs font-mono uppercase tracking-widest mb-2" style={{ color: '#64748b' }}>Seus dados</p>
            <p className="text-sm text-white font-medium">{form.restaurantName}</p>
            <p className="text-sm" style={{ color: '#94a3b8' }}>{RESTAURANT_TYPE_LABELS[form.restaurantType as RestaurantType]}</p>
            <p className="text-sm" style={{ color: '#94a3b8' }}>{form.whatsapp}</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6" style={{ background: 'linear-gradient(135deg, #0b1326 0%, #0f1e3a 100%)' }}>
      <div className="w-full max-w-sm space-y-8">
        {/* Header */}
        <div className="text-center space-y-3">
          <div className="flex justify-center">
            <KiComandaLogo size={48} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Quero conhecer a KiComanda</h1>
            <p className="text-sm mt-1.5" style={{ color: '#94a3b8' }}>
              Preencha seus dados e nossa equipe entra em contato pelo WhatsApp.
            </p>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <label className="text-xs font-mono uppercase tracking-widest" style={{ color: '#64748b' }}>Seu nome</label>
            <input
              type="text"
              required
              autoFocus
              value={form.name}
              onChange={e => setField('name', e.target.value)}
              placeholder="João Silva"
              className="w-full rounded-xl px-4 py-3.5 text-sm text-white placeholder-slate-500 outline-none transition-all"
              style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-mono uppercase tracking-widest" style={{ color: '#64748b' }}>WhatsApp</label>
            <input
              type="tel"
              required
              value={form.whatsapp}
              onChange={e => setField('whatsapp', formatWhatsApp(e.target.value))}
              placeholder="(11) 99999-9999"
              className="w-full rounded-xl px-4 py-3.5 text-sm text-white placeholder-slate-500 outline-none transition-all"
              style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-mono uppercase tracking-widest" style={{ color: '#64748b' }}>E-mail <span style={{ color: '#475569' }}>(opcional)</span></label>
            <input
              type="email"
              value={form.email}
              onChange={e => setField('email', e.target.value)}
              placeholder="joao@restaurante.com"
              className="w-full rounded-xl px-4 py-3.5 text-sm text-white placeholder-slate-500 outline-none transition-all"
              style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-mono uppercase tracking-widest" style={{ color: '#64748b' }}>Nome do restaurante</label>
            <input
              type="text"
              required
              value={form.restaurantName}
              onChange={e => setField('restaurantName', e.target.value)}
              placeholder="Restaurante do João"
              className="w-full rounded-xl px-4 py-3.5 text-sm text-white placeholder-slate-500 outline-none transition-all"
              style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-mono uppercase tracking-widest" style={{ color: '#64748b' }}>Tipo do restaurante</label>
            <div className="grid grid-cols-2 gap-2">
              {RESTAURANT_TYPES.map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setField('restaurantType', value)}
                  className="rounded-xl px-3 py-3 text-left text-sm font-medium transition-all"
                  style={{
                    background: form.restaurantType === value ? 'rgba(255,182,144,0.15)' : 'rgba(255,255,255,0.04)',
                    border: form.restaurantType === value ? '1.5px solid #ffb690' : '1px solid rgba(255,255,255,0.08)',
                    color: form.restaurantType === value ? '#ffb690' : '#94a3b8',
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {error && (
            <p className="text-sm text-red-400 text-center">{error}</p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-xl py-4 text-sm font-bold transition-opacity disabled:opacity-60"
            style={{ background: '#ffb690', color: '#0b1326' }}
          >
            {submitting ? 'Enviando...' : 'Quero conhecer a KiComanda →'}
          </button>
        </form>
      </div>
    </div>
  )
}
