'use client'

import { useEffect, useState } from 'react'
import { useParams, useSearchParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { CustomerBottomNav } from '@/components/customer/bottom-nav'
import { QomandaLogo } from '@/components/qomanda-logo'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'

type Prefs = {
  notifications: boolean
  shareHistory: boolean
  newsletter: boolean
}

export default function ProfilePage() {
  const params = useParams<{ slug: string }>()
  const searchParams = useSearchParams()
  const router = useRouter()
  const sessionId = searchParams.get('session')

  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName]   = useState('')
  const [whatsapp, setWhatsapp]   = useState('')
  const [visits, setVisits]       = useState(0)
  const [nextReward, setNextReward] = useState<{ visit_count: number; benefit_value: string } | null>(null)
  const [loading, setLoading]     = useState(true)
  const [saving, setSaving]       = useState(false)
  const [editing, setEditing]     = useState(false)
  const [prefs, setPrefs]         = useState<Prefs>({ notifications: true, shareHistory: true, newsletter: false })

  useEffect(() => {
    if (!sessionId) { router.replace(`/${params.slug}`); return }

    // Load name from localStorage (set during check-in)
    const stored = localStorage.getItem('qomanda_customer_name') ?? ''
    const [fn = '', ...rest] = stored.split(' ')
    setFirstName(fn)
    setLastName(rest.join(' '))

    if (params.slug === 'demo') {
      setWhatsapp('(11) 99999-9999')
      setVisits(3)
      setNextReward({ visit_count: 5, benefit_value: 'Chope ou refrigerante grátis' })
      setLoading(false)
      return
    }

    async function load() {
      const supabase = createClient()
      const { data: session } = await supabase
        .from('sessions')
        .select('customer_id, restaurant_id')
        .eq('id', sessionId)
        .single()

      if (!session?.customer_id) { setLoading(false); return }

      // Customer data
      const { data: customer } = await supabase
        .from('customers')
        .select('first_name, last_name, whatsapp')
        .eq('id', session.customer_id)
        .single()

      if (customer) {
        setFirstName(customer.first_name)
        setLastName(customer.last_name)
        setWhatsapp(formatDisplay(customer.whatsapp))
      }

      // Visit count
      const { count } = await supabase
        .from('customer_visits')
        .select('id', { count: 'exact', head: true })
        .eq('customer_id', session.customer_id)
        .eq('restaurant_id', session.restaurant_id)

      setVisits(count ?? 0)

      // Next loyalty reward
      const { data: rules } = await supabase
        .from('loyalty_rules')
        .select('visit_count, benefit_value')
        .eq('restaurant_id', session.restaurant_id)
        .eq('active', true)
        .gt('visit_count', count ?? 0)
        .order('visit_count', { ascending: true })
        .limit(1)

      if (rules && rules.length > 0) setNextReward(rules[0])
      setLoading(false)
    }
    load()
  }, [sessionId, params.slug, router])

  function formatDisplay(phone: string) {
    const d = phone.replace(/\D/g, '')
    if (d.length === 11) return `(${d.slice(0,2)}) ${d.slice(2,7)}-${d.slice(7)}`
    return phone
  }

  async function handleSave() {
    if (!firstName.trim()) { toast.error('Informe seu nome.'); return }
    setSaving(true)

    localStorage.setItem('qomanda_customer_name', `${firstName.trim()} ${lastName.trim()}`)

    if (params.slug !== 'demo') {
      const supabase = createClient()
      const { data: session } = await supabase
        .from('sessions').select('customer_id').eq('id', sessionId).single()

      if (session?.customer_id) {
        await supabase.from('customers').update({
          first_name: firstName.trim(),
          last_name: lastName.trim(),
        }).eq('id', session.customer_id)
      }
    }

    setSaving(false)
    setEditing(false)
    toast.success('Dados atualizados!')
  }

  function togglePref(key: keyof Prefs) {
    setPrefs(p => ({ ...p, [key]: !p[key] }))
  }

  const initials = `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase() || '?'
  const rewardProgress = nextReward ? Math.min(100, (visits / nextReward.visit_count) * 100) : 100

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#0b1326' }}>
        <Loader2 className="h-8 w-8 animate-spin" style={{ color: '#f97316' }} />
      </div>
    )
  }

  return (
    <div className="min-h-screen pb-24" style={{ background: '#0b1326', color: '#dae2fd' }}>
      {/* Ambient */}
      <div className="pointer-events-none fixed top-[-5%] left-[-5%] w-[50%] h-[35%] rounded-full" style={{ background: 'rgba(249,115,22,0.06)', filter: 'blur(100px)' }} />

      {/* Header */}
      <header
        className="sticky top-0 z-40 flex justify-between items-center px-6 h-16"
        style={{ background: 'rgba(11,19,38,0.9)', borderBottom: '1px solid rgba(88,66,55,0.35)', backdropFilter: 'blur(12px)' }}
      >
        <button onClick={() => router.back()} className="p-2 -ml-2 rounded-full" style={{ color: '#ffb690' }}>
          <span className="material-symbols-outlined">arrow_back</span>
        </button>
        <h1 className="text-base font-semibold" style={{ fontFamily: 'Geist, sans-serif' }}>Meu Perfil</h1>
        <button
          onClick={() => editing ? handleSave() : setEditing(true)}
          className="text-sm font-mono px-3 py-1.5 rounded-lg transition-all active:scale-95"
          style={{
            background: editing ? '#f97316' : 'transparent',
            color: editing ? '#582200' : '#ffb690',
            border: editing ? 'none' : '1px solid rgba(249,115,22,0.3)',
            fontWeight: editing ? 700 : 400,
          }}
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : editing ? 'Salvar' : 'Editar'}
        </button>
      </header>

      <main className="px-6 pt-6 space-y-5 relative z-10">
        {/* Avatar + name */}
        <div className="flex flex-col items-center gap-4 py-4">
          <div
            className="w-20 h-20 rounded-full flex items-center justify-center text-2xl font-black"
            style={{ background: 'linear-gradient(135deg, #f97316, #d63400)', color: '#fff', boxShadow: '0 0 24px rgba(249,115,22,0.3)' }}
          >
            {initials}
          </div>
          {!editing ? (
            <div className="text-center">
              <p className="text-xl font-semibold" style={{ fontFamily: 'Geist, sans-serif' }}>{firstName} {lastName}</p>
              <p className="text-sm font-mono mt-0.5" style={{ color: '#a78b7d' }}>{whatsapp}</p>
            </div>
          ) : null}
        </div>

        {/* Edit form */}
        {editing && (
          <div className="rounded-xl p-5 space-y-4" style={{ background: '#1e293b', border: '1px solid #334155' }}>
            <p className="text-[10px] font-mono uppercase tracking-widest mb-1" style={{ color: '#a78b7d' }}>Dados pessoais</p>
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: 'Nome', value: firstName, set: setFirstName, placeholder: 'João' },
                { label: 'Sobrenome', value: lastName, set: setLastName, placeholder: 'Silva' },
              ].map(f => (
                <div key={f.label} className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-mono uppercase tracking-wider" style={{ color: '#e0c0b1' }}>{f.label}</label>
                  <input
                    value={f.value}
                    onChange={e => f.set(e.target.value)}
                    placeholder={f.placeholder}
                    className="h-11 px-3 rounded-lg text-sm outline-none"
                    style={{ background: '#0b1326', border: '1px solid #584237', color: '#dae2fd' }}
                    onFocus={e => (e.target.style.borderColor = '#f97316')}
                    onBlur={e => (e.target.style.borderColor = '#584237')}
                  />
                </div>
              ))}
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-mono uppercase tracking-wider" style={{ color: '#e0c0b1' }}>WhatsApp</label>
              <input
                value={whatsapp}
                readOnly
                className="h-11 px-3 rounded-lg text-sm opacity-50 cursor-not-allowed"
                style={{ background: '#0b1326', border: '1px solid #584237', color: '#dae2fd' }}
              />
              <p className="text-[10px] font-mono" style={{ color: '#584237' }}>
                O WhatsApp é sua identidade e não pode ser alterado aqui.
              </p>
            </div>
          </div>
        )}

        {/* Loyalty card */}
        <div
          className="rounded-xl p-5 relative overflow-hidden"
          style={{ background: 'linear-gradient(135deg, #1e293b, #0f172a)', border: '1px solid #334155' }}
        >
          <div className="absolute top-0 right-0 opacity-5 pointer-events-none">
            <span className="material-symbols-outlined text-[120px]" style={{ color: '#f97316' }}>workspace_premium</span>
          </div>
          <div className="flex items-start justify-between mb-4">
            <div>
              <p className="text-[10px] font-mono uppercase tracking-widest mb-1" style={{ color: '#a78b7d' }}>Programa de Fidelidade</p>
              <p className="text-2xl font-black" style={{ fontFamily: 'Geist, sans-serif', color: '#ffb690' }}>
                {visits} {visits === 1 ? 'visita' : 'visitas'}
              </p>
            </div>
            <span
              className="material-symbols-outlined text-[28px]"
              style={{ color: '#f97316', fontVariationSettings: "'FILL' 1" }}
            >
              workspace_premium
            </span>
          </div>
          {nextReward ? (
            <>
              <div className="h-1.5 rounded-full overflow-hidden mb-2" style={{ background: '#2d3449' }}>
                <div
                  className="h-full rounded-full transition-all duration-1000"
                  style={{ width: `${rewardProgress}%`, background: 'linear-gradient(90deg, #f97316, #ffb690)' }}
                />
              </div>
              <div className="flex justify-between items-center">
                <p className="text-xs" style={{ color: '#e0c0b1' }}>
                  Faltam <span className="font-semibold" style={{ color: '#ffb690' }}>{nextReward.visit_count - visits}</span> {nextReward.visit_count - visits === 1 ? 'visita' : 'visitas'} para:
                </p>
              </div>
              <div
                className="mt-2 flex items-center gap-2 px-3 py-2 rounded-lg"
                style={{ background: 'rgba(249,115,22,0.1)', border: '1px solid rgba(249,115,22,0.2)' }}
              >
                <span className="material-symbols-outlined text-[16px]" style={{ color: '#f97316' }}>redeem</span>
                <span className="text-xs font-semibold" style={{ color: '#ffb690' }}>{nextReward.benefit_value}</span>
              </div>
            </>
          ) : (
            <p className="text-xs" style={{ color: '#34d399' }}>
              🎉 Você conquistou todos os benefícios disponíveis!
            </p>
          )}
        </div>

        {/* Preferences */}
        <div className="rounded-xl overflow-hidden" style={{ background: '#1e293b', border: '1px solid #334155' }}>
          <p className="text-[10px] font-mono uppercase tracking-widest px-5 pt-4 pb-3" style={{ color: '#a78b7d' }}>
            Preferências
          </p>
          {[
            { key: 'notifications' as keyof Prefs, icon: 'notifications', label: 'Notificações de pedido', desc: 'Status em tempo real dos seus pedidos' },
            { key: 'shareHistory'  as keyof Prefs, icon: 'history',       label: 'Histórico de visitas',  desc: 'Permitir uso para programa de fidelidade' },
            { key: 'newsletter'    as keyof Prefs, icon: 'campaign',      label: 'Novidades e promoções', desc: 'Receber ofertas via WhatsApp' },
          ].map((item, i, arr) => (
            <div
              key={item.key}
              className="flex items-center justify-between px-5 py-4"
              style={{ borderTop: i > 0 ? '1px solid rgba(88,66,55,0.25)' : 'none' }}
            >
              <div className="flex items-center gap-3">
                <span className="material-symbols-outlined text-[20px]" style={{ color: '#a78b7d' }}>{item.icon}</span>
                <div>
                  <p className="text-sm font-medium" style={{ color: '#dae2fd' }}>{item.label}</p>
                  <p className="text-xs mt-0.5" style={{ color: '#a78b7d' }}>{item.desc}</p>
                </div>
              </div>
              <button
                onClick={() => togglePref(item.key)}
                className="relative w-11 h-6 rounded-full transition-colors shrink-0 ml-4"
                style={{ background: prefs[item.key] ? '#f97316' : '#334155' }}
              >
                <span
                  className="absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all"
                  style={{ left: prefs[item.key] ? '1.375rem' : '0.125rem' }}
                />
              </button>
            </div>
          ))}
        </div>

        {/* Powered by */}
        <div className="flex flex-col items-center gap-3 py-4">
          <div className="flex items-center gap-2 opacity-40">
            <QomandaLogo size={20} />
            <span className="text-xs font-mono" style={{ color: '#a78b7d' }}>Powered by Qomanda</span>
          </div>
          <button
            onClick={() => { localStorage.clear(); router.push('/') }}
            className="text-xs font-mono underline transition-colors"
            style={{ color: '#584237' }}
          >
            Encerrar sessão
          </button>
        </div>
      </main>

      <CustomerBottomNav slug={params.slug} sessionId={sessionId ?? ''} />
    </div>
  )
}
