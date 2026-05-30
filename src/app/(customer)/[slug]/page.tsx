'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { Restaurant, RestaurantTable, Session } from '@/types'
import { toast } from 'sonner'
import { Loader2, UtensilsCrossed } from 'lucide-react'
import { Button } from '@/components/ui/button'

export default function CheckInPage() {
  const params = useParams<{ slug: string }>()
  const router = useRouter()
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null)
  const [loading, setLoading] = useState(true)
  const [checkingIn, setCheckingIn] = useState(false)

  useEffect(() => {
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
    setCheckingIn(true)

    const tableNumber = new URLSearchParams(window.location.search).get('mesa') ?? '1'
    const supabase = createClient()

    const { data: table } = await supabase
      .from('tables')
      .select('*')
      .eq('restaurant_id', restaurant.id)
      .eq('number', tableNumber)
      .single()

    if (!table) {
      toast.error('Mesa não encontrada.')
      setCheckingIn(false)
      return
    }

    const { data: session, error } = await supabase
      .from('sessions')
      .insert({
        table_id: table.id,
        restaurant_id: restaurant.id,
        status: 'open',
      })
      .select()
      .single()

    if (error || !session) {
      toast.error('Erro ao realizar check-in. Tente novamente.')
      setCheckingIn(false)
      return
    }

    localStorage.setItem('qomanda_session_id', session.id)
    toast.success('Check-in realizado!')
    router.push(`/${params.slug}/menu?session=${session.id}`)
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
      </div>
    )
  }

  if (!restaurant) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-8 text-center">
        <UtensilsCrossed className="h-16 w-16 text-slate-300 mb-4" />
        <h1 className="text-xl font-semibold text-slate-700">Restaurante não encontrado</h1>
        <p className="text-slate-500 mt-2">Verifique o QR Code e tente novamente.</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-900 p-8 text-white">
      <div className="text-center space-y-6 max-w-sm w-full">
        <div className="space-y-2">
          <div className="text-4xl font-black text-orange-500">Qomanda</div>
          <h1 className="text-2xl font-bold">{restaurant.name}</h1>
          <p className="text-slate-400">
            Mesa {new URLSearchParams(window.location.search).get('mesa') ?? '1'}
          </p>
        </div>

        <div className="bg-slate-800 rounded-2xl p-6 space-y-3">
          <p className="text-slate-300 text-sm">
            Faça seu check-in para acessar o cardápio digital e realizar pedidos diretamente do seu celular.
          </p>
        </div>

        <Button
          onClick={handleCheckIn}
          disabled={checkingIn}
          className="w-full bg-orange-500 hover:bg-orange-600 text-white font-semibold py-4 text-lg rounded-xl h-auto"
        >
          {checkingIn ? (
            <><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Aguarde...</>
          ) : (
            'Fazer Check-in'
          )}
        </Button>
      </div>
    </div>
  )
}
