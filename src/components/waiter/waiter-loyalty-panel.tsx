'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { Loader2 } from 'lucide-react'
import type { WaiterAlertsResponse } from '@/app/api/dashboard/waiter/alerts/route'
import type { WaiterLoyaltyAlert } from '@/lib/waiter-garcom'

function OfferCard({ alert, compact }: { alert: WaiterLoyaltyAlert; compact?: boolean }) {
  const isRedeemed = alert.status === 'redeemed'

  return (
    <div
      className={`rounded-2xl p-4 ${compact ? '' : ''}`}
      style={{
        background: isRedeemed ? 'rgba(52,211,153,0.08)' : 'rgba(0,230,118,0.1)',
        border: `1px solid ${isRedeemed ? 'rgba(52,211,153,0.3)' : 'rgba(0,230,118,0.35)'}`,
      }}
    >
      <div className="flex items-start gap-3">
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
          style={{ background: isRedeemed ? 'rgba(52,211,153,0.15)' : 'rgba(0,230,118,0.15)' }}
        >
          <span className="material-symbols-outlined text-[22px]" style={{ color: isRedeemed ? '#34d399' : '#00E676' }}>
            {isRedeemed ? 'check_circle' : 'redeem'}
          </span>
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-mono uppercase tracking-wider" style={{ color: '#8B949E' }}>
            Mesa {alert.tableNumber} · {alert.customerName}
          </p>
          <p className="text-base font-bold mt-1">{alert.label}</p>
          <p className="text-xs font-mono mt-1" style={{ color: '#30363D' }}>{alert.benefitValue}</p>
          {isRedeemed ? (
            <p className="text-[10px] font-mono mt-2" style={{ color: '#34d399' }}>
              Cliente aplicou no checkout — honrar na conta
            </p>
          ) : (
            <p className="text-[10px] font-mono mt-2" style={{ color: '#fbbf24' }}>
              Benefício disponível — avise o cliente no checkout
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

export function WaiterLoyaltyAlertsBanner({ alerts }: { alerts: WaiterLoyaltyAlert[] }) {
  const active = alerts.filter(a => a.status === 'active')
  if (active.length === 0) return null

  return (
    <Link
      href="/garcom/beneficios"
      className="block rounded-2xl px-4 py-3.5 active:scale-[0.98] transition-transform"
      style={{ background: 'rgba(0,230,118,0.1)', border: '1px solid rgba(0,230,118,0.35)' }}
    >
      <div className="flex items-center gap-3">
        <span className="material-symbols-outlined text-[22px]" style={{ color: '#00E676' }}>redeem</span>
        <div>
          <p className="text-sm font-bold" style={{ color: '#00E676' }}>
            {active.length} benefício{active.length > 1 ? 's' : ''} de fidelidade na casa
          </p>
          <p className="text-xs font-mono mt-0.5" style={{ color: '#8B949E' }}>
            Toque para ver detalhes por mesa
          </p>
        </div>
      </div>
    </Link>
  )
}

export function WaiterLoyaltyPanel() {
  const [data, setData] = useState<WaiterAlertsResponse | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/dashboard/waiter/alerts')
      const json = await res.json()
      if (res.ok) setData(json)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
    const interval = setInterval(load, 30_000)
    return () => clearInterval(interval)
  }, [load])

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-7 w-7 animate-spin" style={{ color: '#00E676' }} />
      </div>
    )
  }

  const alerts = data?.alerts ?? []
  const active = alerts.filter(a => a.status === 'active')
  const applied = alerts.filter(a => a.status === 'redeemed')

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-black" style={{ letterSpacing: '-0.02em' }}>Benefícios</h1>
        <p className="text-sm mt-1 font-mono" style={{ color: '#8B949E' }}>
          Fidelidade ativa nas mesas abertas · atualiza a cada 30s
        </p>
      </div>

      {alerts.length === 0 ? (
        <div
          className="rounded-2xl py-14 text-center"
          style={{ background: '#161B22', border: '1px solid rgba(88,66,55,0.4)' }}
        >
          <span className="material-symbols-outlined text-[40px] mb-2" style={{ color: '#30363D' }}>redeem</span>
          <p className="text-sm font-mono" style={{ color: '#8B949E' }}>
            Nenhum benefício nas mesas agora
          </p>
        </div>
      ) : (
        <>
          {active.length > 0 && (
            <section className="space-y-3">
              <p className="text-[10px] font-mono uppercase tracking-widest" style={{ color: '#8B949E' }}>
                Disponíveis ({active.length})
              </p>
              {active.map(a => <OfferCard key={a.offerId} alert={a} />)}
            </section>
          )}
          {applied.length > 0 && (
            <section className="space-y-3">
              <p className="text-[10px] font-mono uppercase tracking-widest" style={{ color: '#8B949E' }}>
                Aplicados nesta visita ({applied.length})
              </p>
              {applied.map(a => <OfferCard key={a.offerId} alert={a} />)}
            </section>
          )}
        </>
      )}
    </div>
  )
}

export function WaiterLoyaltyInlineList({ alerts }: { alerts: WaiterLoyaltyAlert[] }) {
  if (alerts.length === 0) return null
  return (
    <div className="space-y-2">
      {alerts.map(a => <OfferCard key={a.offerId} alert={a} compact />)}
    </div>
  )
}
