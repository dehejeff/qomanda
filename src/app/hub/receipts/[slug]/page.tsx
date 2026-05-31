'use client'

import { Suspense, useEffect, useMemo, useState } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { HubBottomNav } from '@/components/customer/hub-bottom-nav'
import { HubPageHeader, RestaurantAvatar } from '@/components/customer/hub-chrome'
import { PaymentReceiptCard } from '@/components/payment-receipt-card'
import type { ReceiptDayGroup } from '@/lib/customer-receipts-server'
import { formatCurrency } from '@/lib/utils'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'

function formatDayLabel(dateStr: string) {
  const d = new Date(`${dateStr}T12:00:00`)
  const today = new Date()
  const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)
  const yesterdayKey = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, '0')}-${String(yesterday.getDate()).padStart(2, '0')}`

  if (dateStr === todayKey) return 'Hoje'
  if (dateStr === yesterdayKey) return 'Ontem'
  return d.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
}

function HubReceiptsRestaurantContent() {
  const params = useParams<{ slug: string }>()
  const searchParams = useSearchParams()
  const router = useRouter()
  const selectedDate = searchParams.get('date')

  const [loading, setLoading] = useState(true)
  const [restaurantName, setRestaurantName] = useState('')
  const [logoUrl, setLogoUrl] = useState<string | null>(null)
  const [days, setDays] = useState<ReceiptDayGroup[]>([])

  useEffect(() => {
    const cid = localStorage.getItem('qomanda_customer_id')
    if (!cid) {
      router.replace('/login?perfil=cliente')
      return
    }

    const qs = new URLSearchParams({ customer: cid, slug: params.slug })
    if (selectedDate) qs.set('date', selectedDate)

    fetch(`/api/customer/receipts?${qs}`)
      .then(r => r.json())
      .then(data => {
        if (data.error) throw new Error(data.error)
        setRestaurantName(data.restaurant?.name ?? params.slug)
        setLogoUrl(data.restaurant?.logoUrl ?? null)
        setDays(data.days ?? [])
        setLoading(false)
      })
      .catch(() => {
        toast.error('Erro ao carregar recibos.')
        setLoading(false)
      })
  }, [params.slug, router, selectedDate])

  const availableDates = useMemo(() => {
    if (selectedDate) return []
    return days.map(d => d.date)
  }, [days, selectedDate])

  function setDateFilter(date: string | null) {
    const url = date
      ? `/hub/receipts/${params.slug}?date=${date}`
      : `/hub/receipts/${params.slug}`
    router.push(url)
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#0b1326' }}>
        <Loader2 className="h-8 w-8 animate-spin" style={{ color: '#f97316' }} />
      </div>
    )
  }

  const totalShown = days.reduce((s, d) => s + d.totalAmount, 0)

  return (
    <div className="min-h-screen pb-24" style={{ background: '#0b1326', color: '#dae2fd' }}>
      <HubPageHeader title="Recibos" backHref="/hub/receipts" />
      <main className="px-5 pt-6 space-y-5 max-w-lg mx-auto">
        <div className="flex items-center gap-3 p-4 rounded-xl" style={{ background: '#131b2e', border: '1px solid #334155' }}>
          <RestaurantAvatar name={restaurantName} logoUrl={logoUrl} size={52} />
          <div className="flex-1 min-w-0">
            <p className="text-base font-bold truncate">{restaurantName}</p>
            <p className="text-xs mt-0.5" style={{ color: '#a78b7d' }}>
              {days.reduce((n, d) => n + d.receipts.length, 0)} recibo(s)
              {selectedDate ? ` em ${formatDayLabel(selectedDate).toLowerCase()}` : ''}
            </p>
          </div>
          {totalShown > 0 && (
            <p className="text-lg font-black shrink-0" style={{ color: '#34d399' }}>{formatCurrency(totalShown)}</p>
          )}
        </div>

        {!selectedDate && availableDates.length > 1 && (
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => setDateFilter(null)}
              className="px-3 py-1.5 rounded-lg text-[11px] font-mono"
              style={{ background: '#f97316', color: '#582200' }}>
              Todos os dias
            </button>
            {availableDates.slice(0, 8).map(date => (
              <button key={date} type="button" onClick={() => setDateFilter(date)}
                className="px-3 py-1.5 rounded-lg text-[11px] font-mono transition-colors"
                style={{ background: '#1e293b', border: '1px solid #334155', color: '#a78b7d' }}>
                {new Date(`${date}T12:00:00`).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
              </button>
            ))}
          </div>
        )}

        {selectedDate && (
          <button type="button" onClick={() => setDateFilter(null)}
            className="text-xs font-mono underline underline-offset-2" style={{ color: '#ffb690' }}>
            Ver todos os dias
          </button>
        )}

        {days.length === 0 ? (
          <div className="rounded-xl p-8 text-center" style={{ background: '#131b2e', border: '1px solid #334155' }}>
            <p className="text-sm" style={{ color: '#a78b7d' }}>Nenhum recibo neste período.</p>
          </div>
        ) : (
          days.map(day => (
            <section key={day.date} className="space-y-3">
              <div className="flex items-center justify-between px-1">
                <p className="text-[10px] font-mono uppercase tracking-widest" style={{ color: '#a78b7d' }}>
                  {formatDayLabel(day.date)}
                </p>
                <p className="text-xs font-mono" style={{ color: '#34d399' }}>{formatCurrency(day.totalAmount)}</p>
              </div>
              <div className="space-y-2">
                {day.receipts.map(r => (
                  <PaymentReceiptCard
                    key={r.id}
                    payment={r}
                    context={{ restaurantName: r.restaurantName, tableNumber: r.tableNumber }}
                    variant="customer"
                    compact
                  />
                ))}
              </div>
            </section>
          ))
        )}
      </main>
      <Suspense fallback={null}><HubBottomNav active="receipts" /></Suspense>
    </div>
  )
}

export default function HubReceiptsRestaurantPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#0b1326' }}>
        <Loader2 className="h-8 w-8 animate-spin" style={{ color: '#f97316' }} />
      </div>
    }>
      <HubReceiptsRestaurantContent />
    </Suspense>
  )
}
