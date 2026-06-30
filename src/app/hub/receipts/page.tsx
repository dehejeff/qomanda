'use client'

import { Suspense, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { HubBottomNav } from '@/components/customer/hub-bottom-nav'
import { HubPageHeader, RestaurantAvatar } from '@/components/customer/hub-chrome'
import type { ReceiptRestaurantSummary } from '@/lib/customer-receipts-server'
import { formatCurrency } from '@/lib/utils'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { HubSessionGate } from '@/components/customer/hub-session-gate'

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })
}

function HubReceiptsContent() {
  const router = useRouter()
  const [customerId, setCustomerId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [restaurants, setRestaurants] = useState<ReceiptRestaurantSummary[]>([])
  const [totalReceipts, setTotalReceipts] = useState(0)

  useEffect(() => {
    const cid = localStorage.getItem('kicomanda_customer_id')
    if (!cid) {
      router.replace('/login?perfil=cliente')
      return
    }
    setCustomerId(cid)

    fetch(`/api/customer/receipts?customer=${cid}`)
      .then(r => r.json())
      .then(data => {
        if (data.error) throw new Error(data.error)
        setRestaurants(data.restaurants ?? [])
        setTotalReceipts(data.totalReceipts ?? 0)
        setLoading(false)
      })
      .catch(() => {
        toast.error('Erro ao carregar recibos.')
        setLoading(false)
      })
  }, [router])

  if (loading || !customerId) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#0D1117' }}>
        <Loader2 className="h-8 w-8 animate-spin" style={{ color: '#00E676' }} />
      </div>
    )
  }

  return (
    <HubSessionGate customerId={customerId}>
    <div className="min-h-screen pb-24" style={{ background: '#0D1117', color: '#FFFFFF' }}>
      <HubPageHeader title="Recibos" backHref="/hub" />
      <main className="px-5 pt-6 space-y-4 max-w-lg mx-auto">
        <p className="text-xs px-1" style={{ color: '#30363D' }}>
          {totalReceipts} comprovante{totalReceipts !== 1 ? 's' : ''} · agrupados por restaurante
        </p>

        {restaurants.length === 0 ? (
          <div className="rounded-xl p-10 text-center" style={{ background: '#161B22', border: '1px solid #30363D' }}>
            <span className="material-symbols-outlined text-[48px] block mb-3" style={{ color: '#30363D' }}>receipt_long</span>
            <p className="text-sm font-semibold">Nenhum recibo ainda</p>
            <p className="text-xs mt-2 leading-relaxed max-w-[260px] mx-auto" style={{ color: '#8B949E' }}>
              Após pagar pela KiComanda, seus comprovantes aparecem aqui organizados por restaurante.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {restaurants.map(r => (
              <Link key={r.restaurantId || r.slug} href={`/hub/receipts/${r.slug}`}
                className="flex items-center gap-3 p-4 rounded-xl transition-all active:scale-[0.98]"
                style={{ background: '#161B22', border: '1px solid #30363D' }}>
                <RestaurantAvatar name={r.name} logoUrl={r.logoUrl} size={48} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate">{r.name}</p>
                  <p className="text-xs mt-0.5" style={{ color: '#8B949E' }}>
                    {r.receiptCount} recibo{r.receiptCount !== 1 ? 's' : ''} recente{r.receiptCount !== 1 ? 's' : ''}
                    {r.lifetimePaymentCount > r.receiptCount && (
                      <> · {r.lifetimePaymentCount} no total</>
                    )}
                    {' · '}último em {formatDate(r.lastReceiptAt)}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-bold" style={{ color: '#34d399' }}>
                    {formatCurrency(r.lifetimeTotal > r.totalAmount ? r.lifetimeTotal : r.totalAmount)}
                  </p>
                  {r.lifetimeTotal > r.totalAmount && (
                    <p className="text-[10px]" style={{ color: '#30363D' }}>
                      {formatCurrency(r.totalAmount)} últimos 90d
                    </p>
                  )}
                  <span className="material-symbols-outlined text-[18px]" style={{ color: '#30363D' }}>chevron_right</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>
      <Suspense fallback={null}><HubBottomNav active="receipts" /></Suspense>
    </div>
    </HubSessionGate>
  )
}

export default function HubReceiptsPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#0D1117' }}>
        <Loader2 className="h-8 w-8 animate-spin" style={{ color: '#00E676' }} />
      </div>
    }>
      <HubReceiptsContent />
    </Suspense>
  )
}
