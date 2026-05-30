'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { Restaurant } from '@/types'
import { mockRestaurant, mockTables } from '@/lib/dev-mock'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'

function formatWhatsApp(value: string) {
  const d = value.replace(/\D/g, '').slice(0, 11)
  if (d.length <= 2) return d.length ? `(${d}` : ''
  if (d.length <= 7) return `(${d.slice(0, 2)}) ${d.slice(2)}`
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`
}

export default function CheckInPage() {
  const params = useParams<{ slug: string }>()
  const router = useRouter()
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null)
  const [loading, setLoading] = useState(true)
  const [checkingIn, setCheckingIn] = useState(false)
  const [checkedIn, setCheckedIn] = useState(false)
  const [tableNumber, setTableNumber] = useState('1')

  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [whatsapp, setWhatsapp] = useState('')

  useEffect(() => {
    setTableNumber(new URLSearchParams(window.location.search).get('mesa') ?? '1')
  }, [])

  useEffect(() => {
    if (params.slug === 'demo') {
      setRestaurant(mockRestaurant)
      setLoading(false)
      return
    }

    async function loadRestaurant() {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('restaurants')
        .select('*')
        .eq('slug', params.slug)
        .eq('status', 'active')
        .single()

      if (error || !data) {
        toast.error('Restaurante não encontrado.')
        setLoading(false)
        return
      }
      setRestaurant(data)
      setLoading(false)
    }
    loadRestaurant()
  }, [params.slug])

  async function handleCheckIn() {
    if (!restaurant) return

    const name = firstName.trim()
    const surname = lastName.trim()
    const phone = whatsapp.replace(/\D/g, '')

    if (!name || !surname) {
      toast.error('Informe seu nome e sobrenome.')
      return
    }
    if (phone.length < 10) {
      toast.error('Informe um WhatsApp válido.')
      return
    }

    setCheckingIn(true)
    const mesa = new URLSearchParams(window.location.search).get('mesa') ?? '1'

    if (params.slug === 'demo') {
      await new Promise(r => setTimeout(r, 600))
      const fakeSessionId = `demo-session-${Date.now()}`
      localStorage.setItem('qomanda_session_id', fakeSessionId)
      localStorage.setItem('qomanda_customer_name', `${name} ${surname}`)
      setCheckedIn(true)
      setCheckingIn(false)
      toast.success(`Bem-vindo, ${name}!`)
      setTimeout(() => router.push(`/demo/home?session=${fakeSessionId}`), 700)
      return
    }

    const supabase = createClient()

    // Upsert customer por whatsapp (identidade única)
    const { data: customer, error: customerError } = await supabase
      .from('customers')
      .upsert({ first_name: name, last_name: surname, whatsapp: phone }, { onConflict: 'whatsapp' })
      .select()
      .single()

    if (customerError || !customer) {
      toast.error('Erro ao salvar seus dados. Tente novamente.')
      setCheckingIn(false)
      return
    }

    const { data: table } = await supabase
      .from('tables')
      .select('*')
      .eq('restaurant_id', restaurant.id)
      .eq('number', mesa)
      .single()

    if (!table) {
      toast.error('Mesa não encontrada.')
      setCheckingIn(false)
      return
    }

    const { data: session, error: sessionError } = await supabase
      .from('sessions')
      .insert({ table_id: table.id, restaurant_id: restaurant.id, customer_id: customer.id, status: 'open' })
      .select()
      .single()

    if (sessionError || !session) {
      toast.error('Erro ao realizar check-in. Tente novamente.')
      setCheckingIn(false)
      return
    }

    // Registra visita para fidelidade
    await supabase.from('customer_visits').insert({
      customer_id: customer.id,
      restaurant_id: restaurant.id,
      session_id: session.id,
    })

    localStorage.setItem('qomanda_session_id', session.id)
    localStorage.setItem('qomanda_customer_name', `${name} ${surname}`)
    setCheckedIn(true)
    setCheckingIn(false)
    toast.success(`Bem-vindo, ${name}!`)
    setTimeout(() => router.push(`/${params.slug}/home?session=${session.id}`), 700)
  }

  const tableLabel = tableNumber.padStart(2, '0')
  const formValid = firstName.trim() && lastName.trim() && whatsapp.replace(/\D/g, '').length >= 10

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#0b1326' }}>
        <Loader2 className="h-8 w-8 animate-spin" style={{ color: '#f97316' }} />
      </div>
    )
  }

  if (!restaurant) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-8 text-center" style={{ background: '#0b1326', color: '#dae2fd' }}>
        <span className="material-symbols-outlined mb-4" style={{ fontSize: 64, color: '#584237' }}>no_meals</span>
        <h1 className="text-xl font-semibold">Restaurante não encontrado</h1>
        <p className="mt-2 text-sm" style={{ color: '#e0c0b1' }}>Verifique o QR Code e tente novamente.</p>
      </div>
    )
  }

  return (
    <div
      className="min-h-screen flex flex-col items-center relative"
      style={{ background: '#0b1326', color: '#dae2fd' }}
    >
      {/* Ambient glow */}
      <div className="pointer-events-none fixed top-[-10%] left-[-10%] w-[50%] h-[40%] rounded-full" style={{ background: 'rgba(255,182,144,0.07)', filter: 'blur(120px)' }} />
      <div className="pointer-events-none fixed bottom-[-5%] right-[-5%] w-[40%] h-[30%] rounded-full" style={{ background: 'rgba(123,208,255,0.07)', filter: 'blur(100px)' }} />

      <div className="relative z-10 w-full max-w-md px-6 pb-10 flex flex-col">
        {/* Header */}
        <header className="pt-8 flex flex-col items-center gap-5 mb-7">
          <div className="flex justify-center items-center h-16">
            {restaurant.logo_url ? (
              <img src={restaurant.logo_url} alt={`${restaurant.name} logo`} className="max-w-[160px] max-h-14 object-contain" />
            ) : (
              <span className="text-2xl font-bold" style={{ color: '#ffb690' }}>{restaurant.name}</span>
            )}
          </div>
          <div className="text-center space-y-1">
            <h1 className="text-[26px] font-semibold leading-tight tracking-tight">
              Bem-vindo à{' '}
              <span className="font-bold" style={{ color: '#ffb690' }}>{restaurant.name}</span>
            </h1>
            <p className="text-sm leading-relaxed" style={{ color: '#e0c0b1' }}>
              Confirme seus dados para começar
            </p>
          </div>
        </header>

        {/* Bento grid */}
        <div className="grid grid-cols-2 gap-3 mb-6">
          <div className="col-span-2 p-4 rounded-xl flex items-center justify-between relative overflow-hidden" style={{ background: '#1e293b', border: '1px solid #334155' }}>
            <div className="absolute inset-0" style={{ background: 'linear-gradient(180deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0) 100%)' }} />
            <div className="relative z-10">
              <span className="text-xs font-mono uppercase tracking-wider block mb-1" style={{ color: '#e0c0b1' }}>MESA ATUAL</span>
              <span className="font-bold leading-none" style={{ fontSize: 36, color: '#ffb690' }}>{tableLabel}</span>
            </div>
            <div className="relative z-10 flex flex-col items-end gap-2">
              <span className="material-symbols-outlined" style={{ fontSize: 36, color: '#ffb690' }}>table_restaurant</span>
              <span className="text-xs font-mono px-2 py-0.5 rounded" style={{ color: '#34d399', background: 'rgba(52,211,153,0.12)' }}>DISPONÍVEL</span>
            </div>
          </div>
          <div className="p-4 rounded-xl flex flex-col justify-between" style={{ background: '#1e293b', border: '1px solid #334155' }}>
            <span className="material-symbols-outlined" style={{ fontSize: 20, color: '#e0c0b1' }}>timer</span>
            <div className="mt-2">
              <span className="text-[10px] font-mono uppercase tracking-wider block mb-0.5" style={{ color: '#e0c0b1' }}>TEMPO MÉDIO</span>
              <span className="text-lg font-semibold">-- min</span>
            </div>
          </div>
          <div className="p-4 rounded-xl flex flex-col justify-between" style={{ background: '#1e293b', border: '1px solid #334155' }}>
            <span className="material-symbols-outlined" style={{ fontSize: 20, color: '#e0c0b1' }}>person_check</span>
            <div className="mt-2">
              <span className="text-[10px] font-mono uppercase tracking-wider block mb-0.5" style={{ color: '#e0c0b1' }}>ATENDIMENTO</span>
              <span className="text-lg font-semibold">Ativo</span>
            </div>
          </div>
        </div>

        {/* Form */}
        <div className="rounded-xl p-5 flex flex-col gap-4 mb-6" style={{ background: '#1e293b', border: '1px solid #334155' }}>
          <div className="flex items-center gap-2 mb-1">
            <span className="material-symbols-outlined text-[20px]" style={{ color: '#ffb690' }}>person</span>
            <span className="text-sm font-semibold">Seus dados</span>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-mono uppercase tracking-wider" style={{ color: '#e0c0b1' }}>Nome</label>
              <input
                type="text"
                value={firstName}
                onChange={e => setFirstName(e.target.value)}
                placeholder="João"
                autoComplete="given-name"
                className="w-full h-11 px-3 rounded-lg text-sm outline-none transition-all"
                style={{
                  background: '#0b1326',
                  border: '1px solid #584237',
                  color: '#dae2fd',
                }}
                onFocus={e => (e.target.style.borderColor = '#f97316')}
                onBlur={e => (e.target.style.borderColor = '#584237')}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-mono uppercase tracking-wider" style={{ color: '#e0c0b1' }}>Sobrenome</label>
              <input
                type="text"
                value={lastName}
                onChange={e => setLastName(e.target.value)}
                placeholder="Silva"
                autoComplete="family-name"
                className="w-full h-11 px-3 rounded-lg text-sm outline-none transition-all"
                style={{
                  background: '#0b1326',
                  border: '1px solid #584237',
                  color: '#dae2fd',
                }}
                onFocus={e => (e.target.style.borderColor = '#f97316')}
                onBlur={e => (e.target.style.borderColor = '#584237')}
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-mono uppercase tracking-wider" style={{ color: '#e0c0b1' }}>WhatsApp</label>
            <div className="relative">
              <span
                className="absolute left-3 top-1/2 -translate-y-1/2 material-symbols-outlined text-[18px]"
                style={{ color: '#a78b7d' }}
              >
                phone
              </span>
              <input
                type="tel"
                inputMode="numeric"
                value={whatsapp}
                onChange={e => setWhatsapp(formatWhatsApp(e.target.value))}
                placeholder="(11) 99999-9999"
                autoComplete="tel"
                className="w-full h-11 pl-9 pr-3 rounded-lg text-sm outline-none transition-all"
                style={{
                  background: '#0b1326',
                  border: '1px solid #584237',
                  color: '#dae2fd',
                }}
                onFocus={e => (e.target.style.borderColor = '#f97316')}
                onBlur={e => (e.target.style.borderColor = '#584237')}
              />
            </div>
            <p className="text-[11px]" style={{ color: '#a78b7d' }}>
              Usado para divisão de conta e nota fiscal
            </p>
          </div>
        </div>

        {/* CTA */}
        <button
          onClick={handleCheckIn}
          disabled={checkingIn || checkedIn || !formValid}
          className="w-full py-5 rounded-xl text-xl font-semibold flex items-center justify-center gap-3 transition-all active:scale-[0.97] disabled:opacity-50"
          style={{
            background: checkedIn ? '#22c55e' : '#f97316',
            color: checkedIn ? '#fff' : '#582200',
            boxShadow: formValid ? '0 16px 32px rgba(249,115,22,0.2)' : 'none',
          }}
        >
          {checkingIn ? (
            <Loader2 className="h-6 w-6 animate-spin" />
          ) : checkedIn ? (
            <>
              <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
              Mesa {tableLabel} Ativada
            </>
          ) : (
            <>
              Fazer Check-in
              <span className="material-symbols-outlined">login</span>
            </>
          )}
        </button>

        <p className="text-center text-xs font-mono uppercase tracking-widest mt-4" style={{ color: 'rgba(218,226,253,0.35)' }}>
          Toque para iniciar o pedido
        </p>

        {/* Footer */}
        <div className="mt-10 text-center">
          <div className="flex items-center justify-center gap-3 mb-1" style={{ color: 'rgba(218,226,253,0.25)' }}>
            <span className="material-symbols-outlined text-base">wifi</span>
            <span className="text-xs font-mono">Free Wi-Fi: QOMANDA_GUEST</span>
          </div>
          <p className="text-xs font-mono" style={{ color: 'rgba(218,226,253,0.18)' }}>Powered by Qomanda</p>
        </div>
      </div>
    </div>
  )
}
