'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { resolveWaiterRestaurantId } from '@/lib/waiter-restaurant-id'
import { formatCounterOrderLabel } from '@/lib/counter-orders'
import { billableItemQuantity, isBillableItem } from '@/lib/session-billing'

type KItem = { name: string; quantity: number; notes: string | null }
type KOrder = { id: string; status: string; label: string; customerName: string; createdAt: string; items: KItem[] }

/** Código curto do pedido exibido na comanda e no card. */
function orderCode(id: string) { return `#${id.slice(-6).toUpperCase()}` }

// Status que a cozinha pode avançar (não entrega — isso é papel do garçom)
const STATUS_NEXT_KITCHEN: Record<string, string> = { pending: 'confirmed', confirmed: 'preparing', preparing: 'ready' }
// Garçom, gerente e dono também podem marcar como entregue
const STATUS_NEXT_WAITER: Record<string, string> = { ...STATUS_NEXT_KITCHEN, ready: 'delivered' }
const NEXT_LABEL: Record<string, string> = { pending: 'Aceitar', confirmed: 'Preparar', preparing: 'Pronto', ready: 'Entregar' }
const COLUMNS: { id: string; title: string; statuses: string[] }[] = [
  { id: 'novos', title: 'Novos', statuses: ['pending', 'confirmed'] },
  { id: 'preparando', title: 'Preparando', statuses: ['preparing'] },
  { id: 'prontos', title: 'Prontos', statuses: ['ready'] },
]
const C = { surface: '#161B22', dim: '#161B22', border: 'rgba(88,66,55,0.4)', accent: '#00E676', accentInk: '#003319', muted: '#8B949E' }

function minsSince(iso: string) { return Math.floor((Date.now() - new Date(iso).getTime()) / 60000) }
function ageColor(min: number) { return min >= 10 ? '#f87171' : min >= 5 ? '#fbbf24' : '#34d399' }

function buildComandaHtml(o: KOrder): string {
  const items = o.items.map(i => `<div class="it"><span class="q">${i.quantity}x</span> ${esc(i.name)}${i.notes ? `<div class="nt">↳ ${esc(i.notes)}</div>` : ''}</div>`).join('')
  return `<!doctype html><html><head><meta charset="utf-8"><title>Comanda</title><style>
    @page { size: 80mm auto; margin: 4mm; }
    * { box-sizing: border-box; }
    body { width: 72mm; margin: 0; font-family: 'Courier New', monospace; color: #000; }
    .hd { text-align: center; border-bottom: 2px dashed #000; padding-bottom: 6px; margin-bottom: 8px; }
    .loc { font-size: 26px; font-weight: 800; }
    .tm { font-size: 12px; }
    .it { font-size: 18px; margin: 6px 0; line-height: 1.2; }
    .q { font-weight: 800; }
    .nt { font-size: 13px; margin-left: 18px; font-style: italic; }
    .ft { border-top: 2px dashed #000; margin-top: 8px; padding-top: 4px; text-align: center; font-size: 11px; }
  </style></head><body>
    <div class="hd"><div class="loc">${esc(o.label)}</div>${o.customerName ? `<div class="tm">${esc(o.customerName)}</div>` : ''}<div class="tm">${esc(orderCode(o.id))} · ${new Date(o.createdAt).toLocaleString('pt-BR')}</div></div>
    ${items || '<div class="it">—</div>'}
    <div class="ft">KiComanda · cozinha</div>
    <script>window.onload=function(){window.print();setTimeout(function(){window.close()},500)}</script>
  </body></html>`
}
function esc(s: string) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;') }
function printComanda(o: KOrder) {
  try {
    const w = window.open('', '_blank', 'width=380,height=600')
    if (!w) return
    w.document.write(buildComandaHtml(o)); w.document.close()
  } catch { /* pop-up bloqueado */ }
}

export function KitchenDisplay({ restaurantName, role = 'kitchen' }: { restaurantName: string; role?: string }) {
  const statusNext = role === 'kitchen' ? STATUS_NEXT_KITCHEN : STATUS_NEXT_WAITER
  const [orders, setOrders] = useState<KOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [autoPrint, setAutoPrint] = useState(false)
  const [, setTick] = useState(0) // re-render p/ atualizar o tempo
  const seen = useRef<Set<string> | null>(null)
  const autoPrintRef = useRef(false)

  useEffect(() => {
    setAutoPrint(localStorage.getItem('kicomanda_kds_autoprint') === '1')
  }, [])
  useEffect(() => { autoPrintRef.current = autoPrint }, [autoPrint])

  const load = useCallback(async () => {
    const supabase = createClient()
    const restaurantId = await resolveWaiterRestaurantId(supabase)
    if (!restaurantId) { setLoading(false); return }
    const { data } = await supabase
      .from('orders')
      .select(`id, status, display_number, order_channel, created_at,
        session:sessions ( table:tables ( number ) ),
        customer:customers ( first_name, last_name ),
        items:order_items ( quantity, cancelled_qty, notes, cancelled_at, menu_item:menu_items ( name ) )`)
      .eq('restaurant_id', restaurantId)
      .in('status', ['pending', 'confirmed', 'preparing', 'ready'])
      .order('created_at', { ascending: true })
      .limit(80)

    const mapped: KOrder[] = (data ?? []).map(row => {
      const sRaw = (row as { session?: unknown }).session
      const s = Array.isArray(sRaw) ? sRaw[0] : sRaw as { table?: { number?: string } | { number?: string }[] } | null
      const tRaw = s?.table
      const t = Array.isArray(tRaw) ? tRaw[0] : tRaw
      const label = row.order_channel === 'counter'
        ? formatCounterOrderLabel(row.display_number)
        : (t?.number ? `Mesa ${t.number}` : 'Mesa')
      const cRaw = (row as { customer?: { first_name?: string; last_name?: string } | { first_name?: string; last_name?: string }[] | null }).customer
      const c = Array.isArray(cRaw) ? cRaw[0] : cRaw
      const customerName = c ? `${c.first_name ?? ''} ${c.last_name ?? ''}`.trim() : ''
      const items: KItem[] = ((row.items ?? []) as Array<{ quantity: number; cancelled_qty?: number | null; notes: string | null; cancelled_at?: string | null; menu_item: { name?: string } | { name?: string }[] | null }>)
        .filter(it => isBillableItem(it))
        .map(it => {
        const miRaw = it.menu_item
        const mi = Array.isArray(miRaw) ? miRaw[0] : miRaw
        return { name: mi?.name ?? 'Item', quantity: billableItemQuantity(it), notes: it.notes ?? null }
      })
      return { id: row.id, status: row.status, label, customerName, createdAt: row.created_at, items }
    })

    // Auto-impressão de pedidos novos (não imprime o backlog inicial)
    if (seen.current === null) {
      seen.current = new Set(mapped.map(o => o.id))
    } else if (autoPrintRef.current) {
      for (const o of mapped) {
        if (!seen.current.has(o.id) && (o.status === 'pending' || o.status === 'confirmed')) printComanda(o)
        seen.current.add(o.id)
      }
    } else {
      for (const o of mapped) seen.current.add(o.id)
    }

    setOrders(mapped)
    setLoading(false)
  }, [])

  useEffect(() => {
    let ch: ReturnType<ReturnType<typeof createClient>['channel']> | undefined
    let mounted = true
    ;(async () => {
      await load()
      const supabase = createClient()
      // Assina apenas os pedidos DESTE restaurante.
      const restaurantId = await resolveWaiterRestaurantId(supabase)
      if (!mounted || !restaurantId) return
      ch = supabase.channel('kds-orders')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'orders', filter: `restaurant_id=eq.${restaurantId}` }, () => { if (mounted) load() })
        .subscribe()
    })()
    const poll = setInterval(() => { void load() }, 12_000)       // fallback se realtime indisponível
    const ticker = setInterval(() => setTick(x => x + 1), 30_000) // atualiza o tempo nos cards
    return () => { mounted = false; if (ch) createClient().removeChannel(ch); clearInterval(poll); clearInterval(ticker) }
  }, [load])

  async function advance(o: KOrder) {
    const next = statusNext[o.status]
    if (!next) return
    setOrders(prev => next === 'delivered' ? prev.filter(x => x.id !== o.id) : prev.map(x => x.id === o.id ? { ...x, status: next } : x))
    // Atualização via rota server (RLS de orders só permite o dono no UPDATE;
    // a equipe de cozinha passa por aqui, que autoriza por papel + usa admin).
    await fetch('/api/dashboard/kitchen/order-status', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderId: o.id, status: next }),
    }).catch(() => {})
    load()
  }

  function toggleAutoPrint() {
    setAutoPrint(v => { const n = !v; localStorage.setItem('kicomanda_kds_autoprint', n ? '1' : '0'); return n })
  }

  return (
    <div className="p-4 md:p-6">
      <header className="flex items-center justify-between mb-5">
        <div>
          <p className="text-[10px] font-mono uppercase tracking-widest" style={{ color: C.muted }}>Cozinha · {restaurantName}</p>
          <h1 className="text-2xl font-black" style={{ color: '#00E676' }}>KDS — Pedidos</h1>
        </div>
        <button
          type="button"
          onClick={toggleAutoPrint}
          className="px-3 py-2 rounded-lg text-xs font-mono flex items-center gap-1.5"
          style={{ background: autoPrint ? 'rgba(52,211,153,0.12)' : C.dim, color: autoPrint ? '#34d399' : C.muted, border: `1px solid ${autoPrint ? 'rgba(52,211,153,0.3)' : C.border}` }}
        >
          <span className="material-symbols-outlined text-[16px]">print</span>
          Auto-imprimir {autoPrint ? 'ON' : 'OFF'}
        </button>
      </header>

      {loading ? (
        <p className="font-mono text-sm" style={{ color: C.muted }}>Carregando…</p>
      ) : orders.length === 0 ? (
        <div className="py-24 text-center">
          <span className="material-symbols-outlined text-6xl block mb-3" style={{ color: '#30363D' }}>skillet</span>
          <p className="font-mono" style={{ color: C.muted }}>Nenhum pedido na fila 🍔</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {COLUMNS.map(col => {
            const colOrders = orders.filter(o => col.statuses.includes(o.status))
            return (
              <div key={col.id}>
                <div className="flex items-center justify-between mb-2 px-1">
                  <h2 className="text-sm font-bold font-mono uppercase tracking-wider" style={{ color: '#FFFFFF' }}>{col.title}</h2>
                  <span className="text-xs font-mono" style={{ color: C.muted }}>{colOrders.length}</span>
                </div>
                <div className="space-y-3">
                  {colOrders.map(o => {
                    const age = minsSince(o.createdAt)
                    return (
                      <div key={o.id} data-order-id={o.id} className="rounded-xl p-3" style={{ background: C.surface, border: `1px solid ${C.border}` }}>
                        <div className="flex items-start justify-between mb-2 gap-2">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-lg font-black font-mono" style={{ color: '#00E676' }}>{o.label}</span>
                              {o.customerName && (
                                <span className="text-sm font-semibold truncate" style={{ color: '#FFFFFF' }}>{o.customerName}</span>
                              )}
                            </div>
                            <span className="text-[10px] font-mono" style={{ color: C.muted }}>{orderCode(o.id)}</span>
                          </div>
                          <span className="text-xs font-mono font-bold shrink-0" style={{ color: ageColor(age) }}>{age}min</span>
                        </div>
                        <ul className="space-y-1 mb-3">
                          {o.items.map((it, i) => (
                            <li key={i} className="text-sm" style={{ color: '#FFFFFF' }}>
                              <span className="font-bold" style={{ color: C.accent }}>{it.quantity}×</span> {it.name}
                              {it.notes && <span className="block text-xs italic ml-5" style={{ color: C.muted }}>↳ {it.notes}</span>}
                            </li>
                          ))}
                          {o.items.length === 0 && <li className="text-sm" style={{ color: C.muted }}>—</li>}
                        </ul>
                        <div className="flex gap-2">
                          {/* Cozinha não entrega — mostra aviso no card Pronto */}
                          {o.status === 'ready' && role === 'kitchen' ? (
                            <div
                              className="flex-1 h-10 rounded-lg flex items-center justify-center gap-1.5 text-xs font-mono"
                              style={{ background: 'rgba(52,211,153,0.08)', border: '1px solid rgba(52,211,153,0.25)', color: '#34d399' }}
                            >
                              <span className="material-symbols-outlined text-[15px]">room_service</span>
                              Aguardando garçom
                            </div>
                          ) : statusNext[o.status] ? (
                            <button
                              type="button"
                              onClick={() => advance(o)}
                              className="flex-1 h-10 rounded-lg font-bold text-sm font-mono active:scale-[0.98]"
                              style={{ background: C.accent, color: C.accentInk }}
                            >
                              {NEXT_LABEL[o.status] ?? 'Avançar'}
                            </button>
                          ) : null}
                          <button
                            type="button"
                            onClick={() => printComanda(o)}
                            title="Imprimir comanda"
                            aria-label="Imprimir comanda"
                            className="w-10 h-10 rounded-lg flex items-center justify-center"
                            style={{ background: C.dim, color: C.muted, border: `1px solid ${C.border}` }}
                          >
                            <span className="material-symbols-outlined text-[18px]">print</span>
                          </button>
                        </div>
                      </div>
                    )
                  })}
                  {colOrders.length === 0 && <p className="text-xs font-mono px-1 py-4" style={{ color: '#475569' }}>—</p>}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
