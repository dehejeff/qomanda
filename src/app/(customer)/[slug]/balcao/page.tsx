'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

export default function BalcaoPage() {
  const params = useParams()
  const router = useRouter()
  const slug = params.slug as string

  const [modeLoading, setModeLoading] = useState(true)
  const [dineInOnly, setDineInOnly] = useState(false)
  const [restaurantName, setRestaurantName] = useState('')
  const [restaurantModel, setRestaurantModel] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [whatsapp, setWhatsapp] = useState('')
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    async function loadMode() {
      const supabase = createClient()
      const { data } = await supabase
        .from('restaurants')
        .select('name, operational_mode, restaurant_model')
        .eq('slug', slug)
        .eq('status', 'active')
        .maybeSingle()

      setRestaurantName(data?.name ?? '')
      setRestaurantModel(data?.restaurant_model ?? null)
      setDineInOnly(data?.operational_mode === 'dine_in')
      setModeLoading(false)
    }
    loadMode()
  }, [slug])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/checkin/counter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug, firstName, lastName, whatsapp, pin }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Erro no check-in.')
        return
      }
      localStorage.setItem('qomanda_session_id', data.sessionId)
      localStorage.setItem('qomanda_customer_id', data.customerId)
      localStorage.setItem('qomanda_service_mode', 'counter')
      router.push(`/${slug}/menu?balcao=1`)
    } finally {
      setLoading(false)
    }
  }

  if (modeLoading) {
    return (
      <div className="min-h-screen bg-background px-4 py-8 max-w-md mx-auto">
        <p className="text-sm text-on-surface-variant font-mono">Carregando…</p>
      </div>
    )
  }

  if (dineInOnly) {
    return (
      <div className="min-h-screen bg-background px-4 py-8 max-w-md mx-auto">
        <Link href={`/${slug}`} className="text-xs font-mono text-on-surface-variant">← Voltar</Link>
        <h1 className="text-2xl font-black text-on-surface mt-4">Salão com mesas</h1>
        <p className="text-sm text-on-surface-variant mt-3">
          {restaurantName ? `${restaurantName} atende` : 'Este restaurante atende'} apenas pelo{' '}
          <strong className="text-on-surface">QR Code na mesa</strong>. Escaneie o código na sua mesa para fazer pedidos e pagar.
        </p>
        <Link
          href={`/${slug}`}
          className="mt-8 inline-flex w-full justify-center py-3 rounded-xl bg-primary text-on-primary font-bold"
        >
          Entendi
        </Link>
      </div>
    )
  }

  const isFoodHall = restaurantModel === 'food_hall'
  const counterTitle = isFoodHall ? 'Praça de alimentação' : 'Pedido no balcão'
  const counterSubtitle = isFoodHall
    ? 'Um cardápio, pedido com número e aviso “pronto” no celular — ideal para shopping ou mercado gastronômico.'
    : 'Faça seu pedido pelo celular. Você recebe o número e avisamos quando ficar pronto.'

  return (
    <div className="min-h-screen bg-background px-4 py-8 max-w-md mx-auto">
      <Link href={`/${slug}`} className="text-xs font-mono text-on-surface-variant">← Voltar</Link>
      <h1 className="text-2xl font-black text-on-surface mt-4">{counterTitle}</h1>
      {restaurantName && (
        <p className="text-xs font-mono text-on-surface-variant mt-1">{restaurantName}</p>
      )}
      <p className="text-sm text-on-surface-variant mt-2">{counterSubtitle}</p>

      <form onSubmit={submit} className="mt-8 space-y-4">
        <input
          className="w-full px-4 py-3 rounded-xl bg-surface-container border border-outline-variant text-on-surface"
          placeholder="Nome"
          value={firstName}
          onChange={e => setFirstName(e.target.value)}
          required
        />
        <input
          className="w-full px-4 py-3 rounded-xl bg-surface-container border border-outline-variant text-on-surface"
          placeholder="Sobrenome"
          value={lastName}
          onChange={e => setLastName(e.target.value)}
          required
        />
        <input
          className="w-full px-4 py-3 rounded-xl bg-surface-container border border-outline-variant text-on-surface"
          placeholder="WhatsApp"
          value={whatsapp}
          onChange={e => setWhatsapp(e.target.value.replace(/\D/g, ''))}
          required
        />
        <input
          className="w-full px-4 py-3 rounded-xl bg-surface-container border border-outline-variant text-on-surface font-mono"
          placeholder="PIN 4 dígitos"
          maxLength={4}
          value={pin}
          onChange={e => setPin(e.target.value.replace(/\D/g, ''))}
          required
        />
        {error && <p className="text-sm text-red-400">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="w-full py-3 rounded-xl bg-primary text-on-primary font-bold"
        >
          {loading ? 'Entrando…' : 'Ver cardápio'}
        </button>
      </form>
    </div>
  )
}
