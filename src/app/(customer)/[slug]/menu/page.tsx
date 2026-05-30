'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useParams, useSearchParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { MenuCategory, MenuItem, CartItem } from '@/types'
import { CustomerBottomNav } from '@/components/customer/bottom-nav'
import { formatCurrency } from '@/lib/utils'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'

export default function MenuPage() {
  const params = useParams<{ slug: string }>()
  const searchParams = useSearchParams()
  const router = useRouter()
  const sessionId = searchParams.get('session')

  const [categories, setCategories] = useState<MenuCategory[]>([])
  const [cart, setCart] = useState<CartItem[]>([])
  const [notes, setNotes] = useState<Record<string, string>>({}) // itemId → nota
  const [openNoteId, setOpenNoteId] = useState<string | null>(null) // item com nota expandida
  const [loading, setLoading] = useState(true)
  const [placing, setPlacing] = useState(false)
  const [activeCategory, setActiveCategory] = useState<string | null>(null)
  const [restaurantName, setRestaurantName] = useState('Qomanda')
  const tabsRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!sessionId) { router.replace(`/${params.slug}`); return }

    async function loadMenu() {
      const supabase = createClient()
      const { data: session } = await supabase
        .from('sessions')
        .select('restaurant_id, restaurant:restaurants(name)')
        .eq('id', sessionId)
        .single()

      if (!session) { router.replace(`/${params.slug}`); return }
      setRestaurantName((session.restaurant as any)?.name ?? 'Cardápio')

      const { data } = await supabase
        .from('menu_categories')
        .select('*, items:menu_items(*)')
        .eq('restaurant_id', session.restaurant_id)
        .order('display_order')

      const filtered = (data ?? []).map(cat => ({
        ...cat,
        items: (cat.items ?? []).filter((i: MenuItem) => i.available),
      })).filter(cat => cat.items.length > 0)

      setCategories(filtered)
      if (filtered.length > 0) setActiveCategory(filtered[0].id)
      setLoading(false)
    }
    loadMenu()
  }, [params.slug, sessionId, router])

  function addToCart(item: MenuItem) {
    setCart(prev => {
      const existing = prev.find(c => c.menu_item.id === item.id)
      if (existing) return prev.map(c => c.menu_item.id === item.id ? { ...c, quantity: c.quantity + 1 } : c)
      return [...prev, { menu_item: item, quantity: 1 }]
    })
  }

  function removeFromCart(itemId: string) {
    setCart(prev => {
      const existing = prev.find(c => c.menu_item.id === itemId)
      if (!existing) return prev
      if (existing.quantity === 1) return prev.filter(c => c.menu_item.id !== itemId)
      return prev.map(c => c.menu_item.id === itemId ? { ...c, quantity: c.quantity - 1 } : c)
    })
  }

  const cartTotal = cart.reduce((s, c) => s + c.menu_item.price * c.quantity, 0)
  const cartCount = cart.reduce((s, c) => s + c.quantity, 0)

  async function placeOrder() {
    if (cart.length === 0) return
    setPlacing(true)

    const supabase = createClient()
    const { data: session } = await supabase
      .from('sessions').select('restaurant_id').eq('id', sessionId).single()

    if (!session) { toast.error('Sessão inválida.'); setPlacing(false); return }

    const customerId = localStorage.getItem('qomanda_customer_id') ?? null

    const { data: order, error } = await supabase
      .from('orders')
      .insert({ session_id: sessionId, restaurant_id: session.restaurant_id, customer_id: customerId, status: 'pending' })
      .select().single()

    if (error || !order) { toast.error('Erro ao enviar pedido.'); setPlacing(false); return }

    await supabase.from('order_items').insert(
      cart.map(c => ({
        order_id:    order.id,
        menu_item_id: c.menu_item.id,
        quantity:    c.quantity,
        unit_price:  c.menu_item.price,
        notes:       notes[c.menu_item.id] || null,
      }))
    )

    setCart([])
    setNotes({})
    setOpenNoteId(null)
    toast.success('Pedido enviado!')
    setPlacing(false)
  }

  // Featured item: first available item across all categories
  const featuredItem = categories.flatMap(c => c.items ?? []).find(i => i.available)

  function selectCategory(id: string) {
    setActiveCategory(id)
    // Scroll the tab into view
    const tab = tabsRef.current?.querySelector(`[data-cat="${id}"]`) as HTMLElement
    tab?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' })
  }

  const activeItems = categories.find(c => c.id === activeCategory)?.items ?? []

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#0b1326' }}>
        <Loader2 className="h-8 w-8 animate-spin" style={{ color: '#f97316' }} />
      </div>
    )
  }

  return (
    <div className="min-h-screen pb-36" style={{ background: '#0b1326', color: '#dae2fd' }}>
      {/* Header */}
      <header
        className="sticky top-0 z-50 flex justify-between items-center px-6 h-16"
        style={{ background: '#0b1326', borderBottom: '1px solid rgba(88,66,55,0.35)' }}
      >
        <div className="flex items-center gap-3">
          <span className="material-symbols-outlined" style={{ color: '#ffb690' }}>restaurant_menu</span>
          <h1 className="text-base font-bold tracking-tight" style={{ color: '#ffb690', fontFamily: 'Geist, sans-serif' }}>
            {restaurantName}
          </h1>
        </div>
        <button
          onClick={() => router.push(`/${params.slug}/home?session=${sessionId}`)}
          className="w-9 h-9 rounded-full flex items-center justify-center transition-colors"
          style={{ background: '#1e293b', border: '1px solid #334155', color: '#e0c0b1' }}
        >
          <span className="material-symbols-outlined text-[20px]">home</span>
        </button>
      </header>

      {/* Category tabs */}
      <nav
        ref={tabsRef}
        className="sticky top-16 z-40 flex gap-2 px-6 py-3 overflow-x-auto"
        style={{ background: '#0b1326', borderBottom: '1px solid rgba(88,66,55,0.25)', scrollbarWidth: 'none' }}
      >
        {categories.map(cat => (
          <button
            key={cat.id}
            data-cat={cat.id}
            onClick={() => selectCategory(cat.id)}
            className="flex-shrink-0 px-4 py-2 rounded-full text-sm font-mono transition-all"
            style={{
              background: activeCategory === cat.id ? '#00a6e0' : 'transparent',
              color: activeCategory === cat.id ? '#00374d' : '#e0c0b1',
              border: activeCategory === cat.id ? '1px solid #00a6e0' : '1px solid rgba(88,66,55,0.3)',
              fontWeight: activeCategory === cat.id ? 700 : 400,
            }}
          >
            {cat.name}
          </button>
        ))}
      </nav>

      <main className="px-6 pt-5 space-y-5">
        {/* Featured hero */}
        {featuredItem && (
          <div className="relative overflow-hidden rounded-xl h-48 group cursor-pointer" onClick={() => addToCart(featuredItem)}>
            {featuredItem.image_url ? (
              <img
                src={featuredItem.image_url}
                alt={featuredItem.name}
                className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
              />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #1e293b, #0f172a)' }}>
                <span className="material-symbols-outlined text-[72px]" style={{ color: '#334155' }}>restaurant</span>
              </div>
            )}
            <div className="absolute inset-0" style={{ background: 'linear-gradient(to top, #0b1326 0%, transparent 60%)' }} />
            <div className="absolute bottom-4 left-4">
              <span
                className="text-[10px] font-mono font-bold uppercase tracking-widest px-2 py-0.5 rounded mb-2 inline-block"
                style={{ background: '#ffb690', color: '#552100' }}
              >
                SUGESTÃO DO CHEF
              </span>
              <h2 className="text-lg font-semibold" style={{ fontFamily: 'Geist, sans-serif' }}>{featuredItem.name}</h2>
              <p className="text-sm font-mono" style={{ color: '#ffb690' }}>{formatCurrency(featuredItem.price)}</p>
            </div>
            <div className="absolute bottom-4 right-4">
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center"
                style={{ background: '#f97316', color: '#582200' }}
              >
                <span className="material-symbols-outlined text-[20px]">add</span>
              </div>
            </div>
          </div>
        )}

        {/* Menu items */}
        <div className="space-y-3">
          {activeItems.length === 0 ? (
            <div className="py-12 text-center">
              <span className="material-symbols-outlined text-[48px] block mb-2" style={{ color: '#584237' }}>restaurant_menu</span>
              <p className="text-sm" style={{ color: '#a78b7d' }}>Nenhum item disponível nesta categoria</p>
            </div>
          ) : (
            activeItems.map(item => {
              const cartItem = cart.find(c => c.menu_item.id === item.id)
              const qty = cartItem?.quantity ?? 0
              return (
                <div
                  key={item.id}
                  className="flex items-stretch gap-3 rounded-xl p-3 transition-all"
                  style={{
                    background: 'rgba(30,41,59,0.7)',
                    border: qty > 0 ? '1px solid #f97316' : '1px solid #334155',
                    backdropFilter: 'blur(12px)',
                  }}
                >
                  {/* Image */}
                  <div
                    className="w-24 h-24 flex-shrink-0 rounded-lg overflow-hidden flex items-center justify-center"
                    style={{ border: '1px solid rgba(88,66,55,0.4)' }}
                  >
                    {item.image_url ? (
                      <img src={item.image_url} alt={item.name} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center" style={{ background: '#1e293b' }}>
                        <span className="material-symbols-outlined text-[32px]" style={{ color: '#584237' }}>fastfood</span>
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 flex flex-col justify-between min-w-0">
                    <div>
                      <h3 className="text-base font-semibold leading-tight" style={{ fontFamily: 'Geist, sans-serif' }}>
                        {item.name}
                      </h3>
                      {item.description && (
                        <p className="text-xs mt-0.5 line-clamp-2 leading-relaxed" style={{ color: '#e0c0b1' }}>
                          {item.description}
                        </p>
                      )}
                    </div>
                    <div className="flex justify-between items-center mt-2">
                      <span className="text-sm font-mono font-semibold" style={{ color: '#ffb690' }}>
                        {formatCurrency(item.price)}
                      </span>
                      {/* Qty stepper */}
                      <div
                        className="flex items-center rounded-full p-1"
                        style={{ background: '#2d3449', border: '1px solid rgba(88,66,55,0.3)' }}
                      >
                        <button
                          onClick={() => removeFromCart(item.id)}
                          className="w-8 h-8 flex items-center justify-center rounded-full active:scale-90 transition-all"
                          style={{ color: '#f97316' }}
                        >
                          <span className="material-symbols-outlined text-[18px]">remove</span>
                        </button>
                        <span
                          className="px-2 text-sm font-mono font-bold min-w-[24px] text-center"
                          style={{ color: qty > 0 ? '#ffb690' : '#584237' }}
                        >
                          {qty}
                        </span>
                        <button
                          onClick={() => addToCart(item)}
                          className="w-8 h-8 flex items-center justify-center rounded-full active:scale-95 transition-all"
                          style={{ background: '#f97316', color: '#582200' }}
                        >
                          <span className="material-symbols-outlined text-[18px]">add</span>
                        </button>
                      </div>
                    </div>

                    {/* Campo de observação — aparece quando item está no carrinho */}
                    {qty > 0 && (
                      <div className="mt-2">
                        {openNoteId === item.id ? (
                          <div className="flex gap-2 items-center">
                            <input
                              autoFocus
                              type="text"
                              placeholder="ex: sem cebola, ponto bem passado…"
                              value={notes[item.id] ?? ''}
                              onChange={e => setNotes(prev => ({ ...prev, [item.id]: e.target.value }))}
                              onBlur={() => setOpenNoteId(null)}
                              className="flex-1 h-8 px-2.5 rounded-lg text-xs outline-none"
                              style={{ background: '#0b1326', border: '1px solid #f97316', color: '#dae2fd' }}
                            />
                            <button onClick={() => setOpenNoteId(null)}
                              className="text-[10px] font-mono shrink-0"
                              style={{ color: '#34d399' }}>
                              OK
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setOpenNoteId(item.id)}
                            className="flex items-center gap-1 text-[11px] font-mono transition-colors"
                            style={{ color: notes[item.id] ? '#f97316' : '#584237' }}
                          >
                            <span className="material-symbols-outlined text-[13px]">
                              {notes[item.id] ? 'edit_note' : 'add_comment'}
                            </span>
                            {notes[item.id] ? notes[item.id] : 'Adicionar observação'}
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )
            })
          )}
        </div>
      </main>

      {/* Floating cart bar */}
      {cartCount > 0 && (
        <div className="fixed bottom-20 left-0 right-0 px-6 pb-2 z-40">
          <div
            className="flex items-center justify-between rounded-full px-5 py-2 shadow-2xl"
            style={{
              background: '#222a3d',
              border: '1px solid rgba(88,66,55,0.4)',
              boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
            }}
          >
            <div>
              <span className="text-[10px] font-mono uppercase tracking-wider block" style={{ color: '#a78b7d' }}>Total</span>
              <span className="text-base font-bold" style={{ color: '#ffb690', fontFamily: 'Geist, sans-serif' }}>
                {formatCurrency(cartTotal)}
              </span>
            </div>
            <button
              onClick={placeOrder}
              disabled={placing}
              className="flex items-center gap-2 px-6 py-3 rounded-full text-sm font-mono font-bold active:scale-95 transition-all disabled:opacity-60"
              style={{ background: '#f97316', color: '#582200' }}
            >
              {placing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  Fazer Pedido
                  <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}

      <CustomerBottomNav slug={params.slug} sessionId={sessionId ?? ''} />
    </div>
  )
}
