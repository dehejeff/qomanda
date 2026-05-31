'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { DEV_BYPASS, mockRestaurant } from '@/lib/dev-mock'
import {
  aggregateRestaurantCustomers,
  maskWhatsApp,
  type RestaurantCustomerStats,
} from '@/lib/restaurant-customers'
import { CustomerOfferModal } from '@/components/dashboard/customer-offer-modal'
import type { LoyaltyRule } from '@/types'

type Filter = 'all' | 'at_risk' | 'loyal' | 'new'

const FILTER_OPTIONS: { id: Filter; label: string; icon: string }[] = [
  { id: 'all', label: 'Todos', icon: 'groups' },
  { id: 'at_risk', label: 'Sumidos', icon: 'schedule' },
  { id: 'loyal', label: 'Fiéis', icon: 'loyalty' },
  { id: 'new', label: 'Novos', icon: 'person_add' },
]

const SEGMENT_BADGE: Record<RestaurantCustomerStats['segment'], { label: string; className: string }> = {
  at_risk: { label: 'Sumido', className: 'bg-amber-500/10 text-amber-400 border-amber-500/20' },
  loyal:   { label: 'Fiel', className: 'bg-primary-container/20 text-primary border-primary/20' },
  new:     { label: 'Novo', className: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' },
  regular: { label: 'Regular', className: 'bg-surface-container-highest text-on-surface-variant border-outline-variant' },
}

const MOCK_CUSTOMERS: RestaurantCustomerStats[] = [
  {
    id: 'c1', firstName: 'Ana', lastName: 'Silva', whatsapp: '5521987654321',
    visitCount: 12, lastVisitAt: new Date(Date.now() - 5 * 86400000).toISOString(),
    daysSinceLastVisit: 5, visitsUntilNextReward: null, nextRewardLabel: '10% de desconto na conta',
    segment: 'loyal',
  },
  {
    id: 'c2', firstName: 'Carlos', lastName: 'Mendes', whatsapp: '5521976543210',
    visitCount: 3, lastVisitAt: new Date(Date.now() - 45 * 86400000).toISOString(),
    daysSinceLastVisit: 45, visitsUntilNextReward: 2, nextRewardLabel: 'Chope grátis',
    segment: 'at_risk',
  },
  {
    id: 'c3', firstName: 'Marina', lastName: 'Costa', whatsapp: '5521965432109',
    visitCount: 1, lastVisitAt: new Date(Date.now() - 2 * 86400000).toISOString(),
    daysSinceLastVisit: 2, visitsUntilNextReward: 4, nextRewardLabel: 'Chope grátis',
    segment: 'new',
  },
]

function formatLastVisit(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })
}

function daysLabel(days: number) {
  if (days === 0) return 'Hoje'
  if (days === 1) return '1 dia'
  return `${days} dias`
}

export default function CustomersPage() {
  const [customers, setCustomers] = useState<RestaurantCustomerStats[]>([])
  const [restaurantName, setRestaurantName] = useState('')
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<Filter>('all')
  const [search, setSearch] = useState('')
  const [offerCustomer, setOfferCustomer] = useState<RestaurantCustomerStats | null>(null)

  const loadCustomers = useCallback(async () => {
    if (DEV_BYPASS) {
      setRestaurantName(mockRestaurant.name)
      setCustomers(MOCK_CUSTOMERS)
      setLoading(false)
      return
    }

    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data: restaurant } = await supabase
      .from('restaurants')
      .select('id, name')
      .eq('owner_id', user.id)
      .single()

    if (!restaurant) return

    setRestaurantName(restaurant.name)

    const [visitsRes, rulesRes] = await Promise.all([
      supabase
        .from('customer_visits')
        .select('customer_id, created_at, customers(id, first_name, last_name, whatsapp)')
        .eq('restaurant_id', restaurant.id)
        .order('created_at', { ascending: false }),
      supabase
        .from('loyalty_rules')
        .select('visit_count, benefit_value, active')
        .eq('restaurant_id', restaurant.id)
        .eq('active', true)
        .order('visit_count'),
    ])

    if (visitsRes.error) {
      toast.error('Erro ao carregar clientes.')
      setLoading(false)
      return
    }

    const rules = (rulesRes.data ?? []) as Pick<LoyaltyRule, 'visit_count' | 'benefit_value' | 'active'>[]
    setCustomers(aggregateRestaurantCustomers(visitsRes.data ?? [], rules))
    setLoading(false)
  }, [])

  useEffect(() => {
    loadCustomers().catch(() => {
      toast.error('Erro ao carregar clientes.')
      setLoading(false)
    })
  }, [loadCustomers])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return customers.filter(c => {
      if (filter !== 'all' && c.segment !== filter) return false
      if (!q) return true
      const full = `${c.firstName} ${c.lastName}`.toLowerCase()
      return full.includes(q) || c.whatsapp.includes(q.replace(/\D/g, ''))
    })
  }, [customers, filter, search])

  const summary = useMemo(() => ({
    total: customers.length,
    atRisk: customers.filter(c => c.segment === 'at_risk').length,
    loyal: customers.filter(c => c.segment === 'loyal').length,
    totalVisits: customers.reduce((a, c) => a + c.visitCount, 0),
  }), [customers])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-primary-container" />
      </div>
    )
  }

  return (
    <div className="space-y-stack-lg">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-end gap-4">
        <div>
          <h2 className="text-3xl font-semibold text-on-surface" style={{ fontFamily: 'Geist, sans-serif', letterSpacing: '-0.02em' }}>
            Clientes
          </h2>
          <p className="text-sm text-on-surface-variant mt-1">
            Histórico de visitas, clientes sumidos e ofertas para trazer de volta.
          </p>
        </div>
        <Link
          href="/dashboard/settings"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-mono border border-outline-variant text-on-surface-variant hover:border-primary/40 hover:text-on-surface transition-colors"
        >
          <span className="material-symbols-outlined text-[16px]">loyalty</span>
          Regras de fidelidade
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-card-gap">
        {[
          { label: 'Clientes', value: summary.total, color: 'text-on-surface' },
          { label: 'Sumidos (30+ dias)', value: summary.atRisk, color: 'text-amber-400' },
          { label: 'Fiéis (8+ visitas)', value: summary.loyal, color: 'text-primary' },
          { label: 'Total de visitas', value: summary.totalVisits, color: 'text-emerald-400' },
        ].map(({ label, value, color }) => (
          <div key={label} className="tonal-layer-1 ghost-border rounded-xl p-4">
            <p className="text-[10px] font-mono uppercase tracking-widest text-on-surface-variant">{label}</p>
            <p className={`text-2xl font-black mt-1 font-mono ${color}`}>{value}</p>
          </div>
        ))}
      </div>

      {/* Filters + search */}
      <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
        <div className="flex gap-1 p-1 rounded-xl w-fit bg-surface-container-low border border-outline-variant overflow-x-auto">
          {FILTER_OPTIONS.map(f => (
            <button
              key={f.id}
              type="button"
              onClick={() => setFilter(f.id)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-mono whitespace-nowrap transition-all ${
                filter === f.id
                  ? 'bg-primary-container text-on-primary-container'
                  : 'text-on-surface-variant hover:text-on-surface'
              }`}
            >
              <span className="material-symbols-outlined text-[16px]">{f.icon}</span>
              {f.label}
            </button>
          ))}
        </div>
        <div className="relative w-full sm:max-w-xs">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-[18px] pointer-events-none">search</span>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar por nome…"
            className="w-full bg-surface-container-low border border-outline-variant rounded-full py-2 pl-10 pr-4 text-sm text-on-surface placeholder:text-on-surface-variant focus:outline-none focus:ring-1 focus:ring-primary-container font-mono"
          />
        </div>
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <div className="tonal-layer-1 ghost-border rounded-xl p-12 text-center">
          <span className="material-symbols-outlined text-5xl text-on-surface-variant opacity-30 mb-3 block">groups</span>
          <p className="text-sm font-mono text-on-surface-variant">
            {customers.length === 0
              ? 'Nenhum cliente com visita registrada ainda. Visitas aparecem após check-in na mesa.'
              : 'Nenhum cliente encontrado com esse filtro.'}
          </p>
        </div>
      ) : (
        <div className="tonal-layer-1 ghost-border rounded-xl overflow-hidden">
          <div className="hidden md:grid grid-cols-[1.2fr_0.8fr_1fr_0.8fr_1.2fr_auto] gap-3 px-6 py-3 border-b border-outline-variant text-[10px] font-mono uppercase tracking-widest text-on-surface-variant">
            <span>Cliente</span>
            <span>Visitas</span>
            <span>Última visita</span>
            <span>Sem voltar</span>
            <span>Fidelidade</span>
            <span className="text-right">Ações</span>
          </div>
          <div className="divide-y divide-outline-variant">
            {filtered.map(customer => {
              const badge = SEGMENT_BADGE[customer.segment]
              return (
                <div
                  key={customer.id}
                  className="grid grid-cols-1 md:grid-cols-[1.2fr_0.8fr_1fr_0.8fr_1.2fr_auto] gap-3 md:gap-3 px-6 py-4 md:items-center hover:bg-surface-container-highest/30 transition-colors"
                >
                  {/* Coluna 1: Cliente */}
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-full bg-primary-container/20 flex items-center justify-center text-sm font-black text-primary shrink-0">
                      {customer.firstName.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-semibold text-on-surface truncate">
                          {customer.firstName} {customer.lastName}
                        </p>
                        <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded border ${badge.className}`}>
                          {badge.label}
                        </span>
                      </div>
                      <p className="text-xs font-mono text-on-surface-variant mt-0.5">
                        WhatsApp {maskWhatsApp(customer.whatsapp)}
                      </p>
                    </div>
                  </div>

                  {/* Coluna 2: Visitas */}
                  <div className="flex md:justify-center items-center">
                    <span className="md:hidden text-[10px] uppercase text-on-surface-variant mr-2">Visitas</span>
                    <p className="text-sm font-mono font-bold text-on-surface">
                      {customer.visitCount}
                    </p>
                  </div>

                  {/* Coluna 3: Última visita */}
                  <div className="flex md:justify-center items-center">
                    <span className="md:hidden text-[10px] uppercase text-on-surface-variant mr-2">Última</span>
                    <p className="text-sm font-mono text-on-surface-variant">
                      {formatLastVisit(customer.lastVisitAt)}
                    </p>
                  </div>

                  {/* Coluna 4: Sem voltar */}
                  <div className="flex md:justify-center items-center">
                    <span className="md:hidden text-[10px] uppercase text-on-surface-variant mr-2">Ausente</span>
                    <p className={`text-sm font-mono ${customer.daysSinceLastVisit >= 30 ? 'text-amber-400 font-bold' : 'text-on-surface-variant'}`}>
                      {daysLabel(customer.daysSinceLastVisit)}
                    </p>
                  </div>

                  {/* Coluna 5: Fidelidade */}
                  <div className="flex md:justify-center items-center">
                    <span className="md:hidden text-[10px] uppercase text-on-surface-variant mr-2 block mb-0.5">Fidelidade</span>
                    <p className="text-xs font-mono text-on-surface-variant">
                      {customer.visitsUntilNextReward != null && customer.visitsUntilNextReward > 0
                        ? `Faltam ${customer.visitsUntilNextReward}`
                        : customer.nextRewardLabel
                          ? '✓ Benefício'
                          : '—'}
                    </p>
                  </div>

                  {/* Coluna 6: Ações */}
                  <div className="flex gap-2 md:justify-end">
                    <button
                      type="button"
                      onClick={() => setOfferCustomer(customer)}
                      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-mono font-bold bg-emerald-600/15 text-emerald-400 border border-emerald-500/25 hover:bg-emerald-600/25 transition-colors"
                    >
                      <span className="material-symbols-outlined text-[16px]">redeem</span>
                      Oferecer
                    </button>
                    <Link
                      href={`/dashboard/orders/customer/${customer.id}`}
                      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-mono border border-outline-variant text-on-surface-variant hover:border-primary/40 hover:text-on-surface transition-colors"
                    >
                      <span className="material-symbols-outlined text-[16px]">receipt_long</span>
                      Pedidos
                    </Link>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {offerCustomer && (
        <CustomerOfferModal
          customer={offerCustomer}
          restaurantName={restaurantName}
          onClose={() => setOfferCustomer(null)}
        />
      )}
    </div>
  )
}
