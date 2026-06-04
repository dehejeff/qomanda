'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { formatCurrency } from '@/lib/utils'
import type {
  WaiterOrderContext,
  WaiterOrderMenuItem,
  WaiterOrderParticipant,
} from '@/lib/waiter-order'

type TableRow = { id: string; number: string; status: string }
type CartLine = { item: WaiterOrderMenuItem; quantity: number }

const C = {
  bg: '#0b1326', surface: '#171f33', dim: '#131b2e', border: 'rgba(88,66,55,0.4)',
  text: '#dae2fd', muted: '#a78b7d', accent: '#f97316', accentInk: '#582200', peach: '#ffb690',
}

export function WaiterOrderFlow() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const sessionParam = searchParams.get('session')

  const [tables, setTables] = useState<TableRow[] | null>(null)
  const [ctx, setCtx] = useState<WaiterOrderContext | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedCustomer, setSelectedCustomer] = useState<string | null>(null)
  const [activeCategory, setActiveCategory] = useState<string | null>(null)
  const [cart, setCart] = useState<CartLine[]>([])
  const [placing, setPlacing] = useState(false)

  // Carrega o contexto da sessão, ou a lista de mesas ocupadas p/ escolher.
  const loadContext = useCallback(async (sessionId: string) => {
    setLoading(true)
    try {
      const res = await fetch(`/api/dashboard/waiter/order?sessionId=${sessionId}`)
      const data = await res.json()
      if (!res.ok) { toast.error(data.error ?? 'Erro ao carregar mesa.'); setCtx(null); return }
      setCtx(data)
      setActiveCategory(data.menu?.[0]?.id ?? null)
      setSelectedCustomer(data.participants?.[0]?.customerId ?? null)
    } finally {
      setLoading(false)
    }
    // applyContext não usado aqui p/ manter o useCallback sem deps de estado
  }, [])

  const loadTables = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/dashboard/waiter/tables')
      const data = await res.json()
      const occupied = (data.tables ?? []).filter((t: TableRow) => t.status !== 'free')
      setTables(occupied)
    } finally {
      setLoading(false)
    }
  }, [])

  function applyContext(data: WaiterOrderContext) {
    setCtx(data)
    setActiveCategory(data.menu?.[0]?.id ?? null)
    setSelectedCustomer(data.participants?.[0]?.customerId ?? null)
  }

  async function selectTable(tableId: string) {
    setLoading(true)
    try {
      const res = await fetch(`/api/dashboard/waiter/order?tableId=${tableId}`)
      const data = await res.json()
      if (!res.ok || !data?.session) { toast.error(data.error ?? 'Mesa sem sessão ativa.'); return }
      applyContext(data)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (sessionParam) loadContext(sessionParam)
    else loadTables()
  }, [sessionParam, loadContext, loadTables])

  function qtyOf(itemId: string) {
    return cart.find(c => c.item.id === itemId)?.quantity ?? 0
  }

  function changeQty(item: WaiterOrderMenuItem, delta: number) {
    setCart(prev => {
      const existing = prev.find(c => c.item.id === item.id)
      const next = (existing?.quantity ?? 0) + delta
      if (next <= 0) return prev.filter(c => c.item.id !== item.id)
      if (existing) return prev.map(c => c.item.id === item.id ? { ...c, quantity: next } : c)
      return [...prev, { item, quantity: next }]
    })
  }

  const cartTotal = cart.reduce((s, c) => s + c.item.effectivePrice * c.quantity, 0)
  const cartCount = cart.reduce((s, c) => s + c.quantity, 0)

  async function placeOrder() {
    if (!ctx || cart.length === 0) return
    setPlacing(true)
    try {
      const res = await fetch('/api/dashboard/waiter/order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: ctx.session.id,
          customerId: selectedCustomer,
          items: cart.map(c => ({ menuItemId: c.item.id, quantity: c.quantity })),
        }),
      })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error ?? 'Erro ao enviar pedido.'); return }
      const who = ctx.participants.find(p => p.customerId === selectedCustomer)?.name ?? 'a mesa'
      toast.success(`Pedido enviado para ${who}.`)
      setCart([])
    } finally {
      setPlacing(false)
    }
  }

  if (loading) {
    return <div className="flex justify-center py-20"><Loader2 className="h-7 w-7 animate-spin" style={{ color: C.accent }} /></div>
  }

  // Seleção de mesa (quando não veio ?session)
  if (!ctx) {
    return (
      <div className="space-y-4">
        <div>
          <p className="text-[10px] font-mono uppercase tracking-widest" style={{ color: C.muted }}>Novo pedido</p>
          <h1 className="text-xl font-black" style={{ color: C.peach }}>Escolha a mesa</h1>
        </div>
        {!tables?.length ? (
          <p className="text-sm font-mono py-10 text-center" style={{ color: C.muted }}>Nenhuma mesa ocupada no momento.</p>
        ) : (
          <div className="grid grid-cols-3 gap-3">
            {tables.map(t => (
              <button
                key={t.id}
                type="button"
                onClick={() => void selectTable(t.id)}
                className="aspect-square rounded-2xl flex flex-col items-center justify-center gap-1 active:scale-95 transition-transform"
                style={{ background: C.surface, border: `1px solid ${C.border}` }}
              >
                <span className="material-symbols-outlined text-[26px]" style={{ color: C.accent }}>table_restaurant</span>
                <span className="text-lg font-black font-mono" style={{ color: C.text }}>{t.number}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    )
  }

  const activeItems = ctx.menu.find(c => c.id === activeCategory)?.items ?? []

  return (
    <div className="space-y-4 pb-40">
      {/* Cabeçalho da mesa */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[10px] font-mono uppercase tracking-widest" style={{ color: C.muted }}>Pedido — Mesa</p>
          <h1 className="text-2xl font-black font-mono" style={{ color: C.accent }}>{ctx.session.tableNumber ?? '—'}</h1>
        </div>
        <button
          type="button"
          onClick={() => router.push('/garcom/mesas')}
          className="px-3 py-2 rounded-lg text-xs font-mono"
          style={{ background: C.dim, color: C.muted, border: `1px solid ${C.border}` }}
        >
          Voltar
        </button>
      </div>

      {/* Para quem é o pedido */}
      <section>
        <p className="text-[10px] font-mono uppercase tracking-widest mb-2" style={{ color: C.muted }}>Pedido para</p>
        <div className="flex flex-wrap gap-2">
          <PersonChip
            label="Mesa (sem nome)"
            active={selectedCustomer === null}
            onClick={() => setSelectedCustomer(null)}
          />
          {ctx.participants.map((p: WaiterOrderParticipant) => (
            <PersonChip
              key={p.customerId}
              label={p.name}
              active={selectedCustomer === p.customerId}
              onClick={() => setSelectedCustomer(p.customerId)}
            />
          ))}
        </div>
      </section>

      {/* Categorias */}
      {ctx.menu.length === 0 ? (
        <p className="text-sm font-mono py-10 text-center" style={{ color: C.muted }}>Cardápio vazio.</p>
      ) : (
        <>
          <nav className="flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
            {ctx.menu.map(cat => (
              <button
                key={cat.id}
                type="button"
                onClick={() => setActiveCategory(cat.id)}
                className="flex-shrink-0 px-4 py-2 rounded-full text-sm font-mono"
                style={{
                  background: activeCategory === cat.id ? C.accent : 'transparent',
                  color: activeCategory === cat.id ? C.accentInk : C.text,
                  border: `1px solid ${activeCategory === cat.id ? C.accent : C.border}`,
                  fontWeight: activeCategory === cat.id ? 700 : 400,
                }}
              >
                {cat.name}
              </button>
            ))}
          </nav>

          {/* Itens */}
          <div className="space-y-2">
            {activeItems.map(item => {
              const qty = qtyOf(item.id)
              return (
                <div
                  key={item.id}
                  className="flex items-center gap-3 rounded-xl p-3"
                  style={{ background: C.surface, border: `1px solid ${qty > 0 ? C.accent : C.border}` }}
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold" style={{ color: C.text }}>{item.name}</p>
                    <p className="text-sm font-mono mt-0.5" style={{ color: C.peach }}>{formatCurrency(item.effectivePrice)}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {qty > 0 && (
                      <>
                        <StepBtn label="−" onClick={() => changeQty(item, -1)} />
                        <span className="w-6 text-center text-sm font-mono font-bold" style={{ color: C.text }}>{qty}</span>
                      </>
                    )}
                    <StepBtn label="+" onClick={() => changeQty(item, +1)} primary />
                  </div>
                </div>
              )
            })}
          </div>
        </>
      )}

      {/* Barra do carrinho */}
      {cartCount > 0 && (
        <div className="fixed bottom-[84px] left-0 right-0 px-5 z-40 max-w-lg mx-auto">
          <button
            type="button"
            disabled={placing}
            onClick={() => void placeOrder()}
            className="w-full flex items-center justify-between rounded-2xl px-5 py-3.5 shadow-2xl active:scale-[0.99] disabled:opacity-60"
            style={{ background: C.accent, color: C.accentInk }}
          >
            <span className="flex items-center gap-2 text-sm font-bold font-mono">
              {placing ? <Loader2 className="h-4 w-4 animate-spin" /> : <span className="material-symbols-outlined text-[18px]">send</span>}
              Enviar pedido ({cartCount})
            </span>
            <span className="text-base font-black font-mono">{formatCurrency(cartTotal)}</span>
          </button>
        </div>
      )}
    </div>
  )
}

function PersonChip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="px-3 py-2 rounded-full text-sm font-medium active:scale-95 transition-transform"
      style={{
        background: active ? C.accent : C.dim,
        color: active ? C.accentInk : C.text,
        border: `1px solid ${active ? C.accent : C.border}`,
      }}
    >
      {label}
    </button>
  )
}

function StepBtn({ label, onClick, primary }: { label: string; onClick: () => void; primary?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-8 h-8 rounded-full flex items-center justify-center text-lg font-bold active:scale-90 transition-transform"
      style={{
        background: primary ? C.accent : C.dim,
        color: primary ? C.accentInk : C.text,
        border: `1px solid ${primary ? C.accent : C.border}`,
      }}
    >
      {label}
    </button>
  )
}
