'use client'

import { useEffect, useState } from 'react'
import { useParams, useSearchParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { CustomerBottomNav } from '@/components/customer/bottom-nav'
import { QomandaLogo } from '@/components/qomanda-logo'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { formatCurrency } from '@/lib/utils'
import { formatWhatsAppDisplay } from '@/lib/customer-form'

type Prefs = { notifications: boolean; shareHistory: boolean; newsletter: boolean }

type ProfileData = {
  firstName: string
  lastName: string
  whatsapp: string
  documentType: 'cpf' | 'passport' | null
  hasCpf: boolean
  visits: number
  nextReward: { visit_count: number; benefit_value: string } | null
}


export default function ProfilePage() {
  const params      = useParams<{ slug: string }>()
  const searchParams = useSearchParams()
  const router      = useRouter()
  const sessionId   = searchParams.get('session')

  const [data, setData]         = useState<ProfileData | null>(null)
  const [loading, setLoading]   = useState(true)
  const [editing, setEditing]   = useState(false)
  const [saving, setSaving]     = useState(false)
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName]   = useState('')
  const [prefs, setPrefs]       = useState<Prefs>({ notifications: true, shareHistory: true, newsletter: false })
  const [receiptCount, setReceiptCount] = useState(0)

  useEffect(() => {
    if (!sessionId) { router.replace(`/${params.slug}`); return }

    const customerId = typeof window !== 'undefined' ? localStorage.getItem('qomanda_customer_id') : null
    const profileUrl = customerId
      ? `/api/customer/profile?session=${sessionId}&customer=${customerId}`
      : `/api/customer/profile?session=${sessionId}`

    fetch(profileUrl)
      .then(r => r.json())
      .then((profile: ProfileData) => {
        setData(profile)
        setFirstName(profile.firstName)
        setLastName(profile.lastName)
        setLoading(false)
      })
      .catch(() => { toast.error('Erro ao carregar perfil.'); setLoading(false) })

    fetch(`/api/customer/payments?session=${sessionId}`)
      .then(r => r.json())
      .then(d => setReceiptCount((d.payments ?? []).length))
      .catch(() => {})
  }, [sessionId, params.slug, router])

  async function handleSave() {
    if (!firstName.trim()) { toast.error('Informe seu nome.'); return }
    setSaving(true)

    const res = await fetch('/api/customer/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId, firstName, lastName }),
    })

    if (res.ok) {
      localStorage.setItem('qomanda_customer_name', `${firstName.trim()} ${lastName.trim()}`)
      setData(prev => prev ? { ...prev, firstName: firstName.trim(), lastName: lastName.trim() } : prev)
      toast.success('Dados atualizados!')
      setEditing(false)
    } else {
      toast.error('Erro ao salvar.')
    }
    setSaving(false)
  }

  function togglePref(key: keyof Prefs) {
    setPrefs(p => ({ ...p, [key]: !p[key] }))
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#0b1326' }}>
        <Loader2 className="h-8 w-8 animate-spin" style={{ color: '#f97316' }} />
      </div>
    )
  }

  const name         = data ? `${data.firstName} ${data.lastName}` : ''
  const initials     = name.trim() ? name.split(' ').map(w => w[0]).filter(Boolean).slice(0, 2).join('').toUpperCase() : '?'
  const rewardPct    = data?.nextReward ? Math.min(100, ((data.visits / data.nextReward.visit_count) * 100)) : 100

  return (
    <div className="min-h-screen pb-24" style={{ background: '#0b1326', color: '#dae2fd' }}>
      <div className="pointer-events-none fixed top-[-5%] left-[-5%] w-[50%] h-[35%] rounded-full"
        style={{ background: 'rgba(249,115,22,0.06)', filter: 'blur(100px)' }} />

      {/* Header */}
      <header className="sticky top-0 z-40 flex justify-between items-center px-6 h-16"
        style={{ background: 'rgba(11,19,38,0.9)', borderBottom: '1px solid rgba(88,66,55,0.35)', backdropFilter: 'blur(12px)' }}>
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
          }}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : editing ? 'Salvar' : 'Editar'}
        </button>
      </header>

      <main className="px-6 pt-6 space-y-5 relative z-10">
        {/* Avatar */}
        <div className="flex flex-col items-center gap-4 py-4">
          <div className="w-20 h-20 rounded-full flex items-center justify-center text-2xl font-black"
            style={{ background: 'linear-gradient(135deg,#f97316,#d63400)', color: '#fff', boxShadow: '0 0 24px rgba(249,115,22,0.3)' }}>
            {initials}
          </div>
          {!editing && (
            <div className="text-center">
              <p className="text-xl font-semibold" style={{ fontFamily: 'Geist, sans-serif' }}>{name}</p>
              <p className="text-sm font-mono mt-0.5" style={{ color: '#a78b7d' }}>
                {formatWhatsAppDisplay(data?.whatsapp ?? '')}
              </p>
              {data?.hasCpf && (
                <span className="inline-flex items-center gap-1 mt-2 text-[10px] font-mono uppercase tracking-wider px-2 py-1 rounded"
                  style={{ background: 'rgba(52,211,153,0.1)', color: '#34d399', border: '1px solid rgba(52,211,153,0.2)' }}>
                  <span className="material-symbols-outlined text-[12px]" style={{ fontVariationSettings: "'FILL' 1" }}>verified_user</span>
                  CPF cadastrado
                </span>
              )}
            </div>
          )}
        </div>

        {/* Edit form */}
        {editing && (
          <div className="rounded-xl p-5 space-y-4" style={{ background: '#1e293b', border: '1px solid #334155' }}>
            <p className="text-[10px] font-mono uppercase tracking-widest" style={{ color: '#a78b7d' }}>Dados pessoais</p>
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: 'Nome', value: firstName, set: setFirstName, placeholder: 'João' },
                { label: 'Sobrenome', value: lastName, set: setLastName, placeholder: 'Silva' },
              ].map(f => (
                <div key={f.label} className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-mono uppercase tracking-wider" style={{ color: '#e0c0b1' }}>{f.label}</label>
                  <input value={f.value} onChange={e => f.set(e.target.value)} placeholder={f.placeholder}
                    className="h-11 px-3 rounded-lg text-sm outline-none"
                    style={{ background: '#0b1326', border: '1px solid #584237', color: '#dae2fd' }}
                    onFocus={e => (e.target.style.borderColor = '#f97316')}
                    onBlur={e => (e.target.style.borderColor = '#584237')} />
                </div>
              ))}
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-mono uppercase tracking-wider" style={{ color: '#e0c0b1' }}>WhatsApp</label>
              <input value={formatWhatsAppDisplay(data?.whatsapp ?? '')} readOnly
                className="h-11 px-3 rounded-lg text-sm opacity-50 cursor-not-allowed"
                style={{ background: '#0b1326', border: '1px solid #584237', color: '#dae2fd' }} />
              <p className="text-[10px] font-mono" style={{ color: '#584237' }}>
                O WhatsApp é sua identidade e não pode ser alterado.
              </p>
            </div>
          </div>
        )}

        {/* Recibos */}
        <Link
          href={`/${params.slug}/receipts?session=${sessionId}`}
          className="block rounded-xl overflow-hidden transition-all active:scale-[0.98]"
          style={{ background: '#1e293b', border: '1px solid #334155' }}
        >
          <div className="flex items-center justify-between px-5 py-4">
            <div className="flex items-center gap-3">
              <span className="material-symbols-outlined text-[22px]" style={{ color: '#34d399' }}>receipt_long</span>
              <div>
                <p className="text-sm font-medium" style={{ color: '#dae2fd' }}>Meus recibos</p>
                <p className="text-xs mt-0.5" style={{ color: '#a78b7d' }}>
                  {receiptCount > 0
                    ? `${receiptCount} pagamento${receiptCount !== 1 ? 's' : ''} nesta visita`
                    : 'Códigos e comprovantes de pagamento'}
                </p>
              </div>
            </div>
            <span className="material-symbols-outlined text-[20px]" style={{ color: '#584237' }}>chevron_right</span>
          </div>
        </Link>

        {/* Loyalty */}
        <div className="rounded-xl p-5"
          style={{ background: 'linear-gradient(145deg,#1e293b,#0f172a)', border: '1px solid #334155' }}>
          <div className="flex items-start justify-between mb-4">
            <div>
              <p className="text-[10px] font-mono uppercase tracking-widest mb-1" style={{ color: '#a78b7d' }}>Programa de Fidelidade</p>
              <p className="text-2xl font-black" style={{ fontFamily: 'Geist, sans-serif', color: '#ffb690' }}>
                {data?.visits ?? 0} {(data?.visits ?? 0) === 1 ? 'visita' : 'visitas'}
              </p>
            </div>
            <span className="material-symbols-outlined text-[28px] shrink-0"
              style={{ color: '#f97316', fontVariationSettings: "'FILL' 1" }}>workspace_premium</span>
          </div>
          {data?.nextReward ? (
            <>
              <div className="h-1.5 rounded-full overflow-hidden mb-2" style={{ background: '#2d3449' }}>
                <div className="h-full rounded-full"
                  style={{ width: `${rewardPct}%`, background: 'linear-gradient(90deg,#f97316,#ffb690)' }} />
              </div>
              <p className="text-xs mb-2" style={{ color: '#e0c0b1' }}>
                Faltam <strong style={{ color: '#ffb690' }}>{data.nextReward.visit_count - (data.visits ?? 0)}</strong> visitas para:
              </p>
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg"
                style={{ background: 'rgba(249,115,22,0.1)', border: '1px solid rgba(249,115,22,0.2)' }}>
                <span className="material-symbols-outlined text-[16px]" style={{ color: '#f97316' }}>redeem</span>
                <span className="text-xs font-semibold" style={{ color: '#ffb690' }}>{data.nextReward.benefit_value}</span>
              </div>
            </>
          ) : (
            <p className="text-xs" style={{ color: '#34d399' }}>🎉 Você conquistou todos os benefícios disponíveis!</p>
          )}
        </div>

        {/* Preferences */}
        <div className="rounded-xl overflow-hidden" style={{ background: '#1e293b', border: '1px solid #334155' }}>
          <p className="text-[10px] font-mono uppercase tracking-widest px-5 pt-4 pb-3" style={{ color: '#a78b7d' }}>Preferências</p>
          {[
            { key: 'notifications' as keyof Prefs, icon: 'notifications', label: 'Notificações de pedido', desc: 'Status em tempo real dos seus pedidos' },
            { key: 'shareHistory'  as keyof Prefs, icon: 'history',       label: 'Histórico de visitas',  desc: 'Permitir uso para programa de fidelidade' },
            { key: 'newsletter'    as keyof Prefs, icon: 'campaign',      label: 'Novidades e promoções', desc: 'Receber ofertas via WhatsApp' },
          ].map((item, i) => (
            <div key={item.key} className="flex items-center justify-between px-5 py-4"
              style={{ borderTop: i > 0 ? '1px solid rgba(88,66,55,0.25)' : 'none' }}>
              <div className="flex items-center gap-3">
                <span className="material-symbols-outlined text-[20px]" style={{ color: '#a78b7d' }}>{item.icon}</span>
                <div>
                  <p className="text-sm font-medium" style={{ color: '#dae2fd' }}>{item.label}</p>
                  <p className="text-xs mt-0.5" style={{ color: '#a78b7d' }}>{item.desc}</p>
                </div>
              </div>
              <button onClick={() => togglePref(item.key)}
                className="relative w-11 h-6 rounded-full transition-colors shrink-0 ml-4"
                style={{ background: prefs[item.key] ? '#f97316' : '#334155' }}>
                <span className="absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all"
                  style={{ left: prefs[item.key] ? '1.375rem' : '0.125rem' }} />
              </button>
            </div>
          ))}
        </div>

        {/* Logout */}
        <button onClick={() => {
          localStorage.removeItem('qomanda_customer_id')
          localStorage.removeItem('qomanda_customer_name')
          localStorage.removeItem('qomanda_session_id')
          sessionStorage.clear()
          router.push('/login?perfil=cliente')
        }}
          className="w-full h-12 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-all active:scale-95"
          style={{ background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.25)', color: '#f87171' }}>
          <span className="material-symbols-outlined text-[18px]">logout</span>
          Encerrar sessão
        </button>

        <div className="flex flex-col items-center gap-2 py-2">
          <div className="flex items-center gap-2 opacity-30">
            <QomandaLogo size={16} />
            <span className="text-[10px] font-mono" style={{ color: '#a78b7d' }}>Powered by Qomanda</span>
          </div>
        </div>
      </main>

      <CustomerBottomNav slug={params.slug} sessionId={sessionId ?? ''} />
    </div>
  )
}
