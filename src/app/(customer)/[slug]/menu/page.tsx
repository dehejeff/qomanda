'use client'

import { useEffect, useState, useRef } from 'react'
import { useParams, useSearchParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { MenuCategory, MenuItem, CartItem } from '@/types'
import { CustomerBottomNav } from '@/components/customer/bottom-nav'
import { OrderReviewModal } from '@/components/customer/order-review-modal'
import { MenuItemDetailModal } from '@/components/customer/menu-item-detail-modal'
import { formatCurrency } from '@/lib/utils'
import { menuItemEffectivePrice, menuItemHasPromo } from '@/lib/menu-item-pricing'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'

export default function MenuPage() {
  const params = useParams<{ slug: string }>()
  const searchParams = useSearchParams()
  const router = useRouter()
  const sessionId = searchParams.get('session')

  const [categories, setCategories] = useState<MenuCategory[]>([])
  const [cart, setCart] = useState<CartItem[]>([])
  const [notes, setNotes] = useState<Record<string, string>>({})
  const [detailItem, setDetailItem] = useState<MenuItem | null>(null)
  const [detailQty, setDetailQty] = useState(1)
  const [detailNote, setDetailNote] = useState('')
  const [loading, setLoading] = useState(true)
  const [placing, setPlacing] = useState(false)
  const [showReview, setShowReview] = useState(false)
  const [activeCategory, setActiveCategory] = useState<string | null>(null)
  const [restaurantName, setRestaurantName] = useState('')
  const tabsRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (showReview && cart.length === 0) setShowReview(false)
  }, [showReview, cart.length])

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

  function setCartQuantity(item: MenuItem, quantity: number) {
    if (quantity <= 0) {
      removeItemCompletely(item.id)
      return
    }
    setCart(prev => {
      const existing = prev.find(c => c.menu_item.id === item.id)
      if (existing) {
        return prev.map(c => c.menu_item.id === item.id ? { ...c, quantity } : c)
      }
      return [...prev, { menu_item: item, quantity }]
    })
  }

  function openItemDetail(item: MenuItem) {
    const inCart = cart.find(c => c.menu_item.id === item.id)
    setDetailItem(item)
    setDetailQty(inCart?.quantity ?? 1)
    setDetailNote(notes[item.id] ?? '')
  }

  function closeItemDetail() {
    setDetailItem(null)
    setDetailQty(1)
    setDetailNote('')
  }

  function confirmItemDetail() {
    if (!detailItem) return
    if (detailQty <= 0) {
      removeItemCompletely(detailItem.id)
      toast.message(`${detailItem.name} removido do pedido`)
      closeItemDetail()
      return
    }
    setCartQuantity(detailItem, detailQty)
    updateItemNote(detailItem.id, detailNote.trim())
    toast.success(detailQty === 1 ? `${detailItem.name} adicionado` : `${detailQty}× ${detailItem.name} no pedido`)
    closeItemDetail()
  }

  function updateCartQuantity(itemId: string, delta: number) {
    const item = categories.flatMap(c => c.items ?? []).find(i => i.id === itemId)
    if (!item) return
    const current = cart.find(c => c.menu_item.id === itemId)?.quantity ?? 0
    setCartQuantity(item, current + delta)
  }

  function removeItemCompletely(itemId: string) {
    setCart(prev => prev.filter(c => c.menu_item.id !== itemId))
    setNotes(prev => {
      const next = { ...prev }
      delete next[itemId]
      return next
    })
    if (detailItem?.id === itemId) closeItemDetail()
  }

  function updateItemNote(itemId: string, note: string) {
    setNotes(prev => {
      if (!note) {
        const next = { ...prev }
        delete next[itemId]
        return next
      }
      return { ...prev, [itemId]: note }
    })
  }

  const cartTotal = cart.reduce((s, c) => s + menuItemEffectivePrice(c.menu_item) * c.quantity, 0)
  const cartCount = cart.reduce((s, c) => s + c.quantity, 0)

  async function placeOrder() {
    if (cart.length === 0) return
    setPlacing(true)

    const supabase = createClient()
    const { data: session } = await supabase
      .from('sessions').select('restaurant_id, service_mode').eq('id', sessionId).single()

    if (!session) { toast.error('Sessão inválida.'); setPlacing(false); return }

    const customerId = localStorage.getItem('kicomanda_customer_id') ?? null

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
        unit_price:  menuItemEffectivePrice(c.menu_item),
        notes:       notes[c.menu_item.id] || null,
      }))
    )

    // Autoritativo: deriva da sessão (não do localStorage, que pode estar stale)
    const isCounter = (session as { service_mode?: string }).service_mode === 'counter'
    if (isCounter) {
      await fetch('/api/orders/counter-number', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId: order.id, sessionId }),
      })
    }

    setCart([])
    setNotes({})
    closeItemDetail()
    setShowReview(false)
    toast.success(isCounter ? 'Pedido enviado! Acompanhe o número.' : 'Pedido enviado!')
    setPlacing(false)
    if (isCounter) {
      router.push(`/${params.slug}/pedido`)
    }
  }

  function openReview() {
    if (cart.length === 0) return
    setShowReview(true)
  }

  const allItems = categories.flatMap(c => c.items ?? [])
  const featuredItem = allItems.find(i => i.available && i.is_chef_pick)
    ?? allItems.find(i => i.available)

  function selectCategory(id: string) {
    setActiveCategory(id)
    // Scroll the tab into view
    const tab = tabsRef.current?.querySelector(`[data-cat="${id}"]`) as HTMLElement
    tab?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' })
  }

  const activeItems = categories.find(c => c.id === activeCategory)?.items ?? []

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#0D1117' }}>
        <Loader2 className="h-8 w-8 animate-spin" style={{ color: '#00E676' }} />
      </div>
    )
  }

  return (
    <div className="min-h-screen pb-36" style={{ background: '#0D1117', color: '#FFFFFF' }}>
      {/* Header */}
      <header
        className="sticky top-0 z-50 flex justify-between items-center px-6 h-16"
        style={{ background: '#0D1117', borderBottom: '1px solid rgba(88,66,55,0.35)' }}
      >
        <div className="flex items-center gap-3">
          <span className="material-symbols-outlined" style={{ color: '#00E676' }}>restaurant_menu</span>
          <h1 className="text-base font-bold tracking-tight" style={{ color: '#00E676', fontFamily: 'Geist, sans-serif' }}>
            {restaurantName}
          </h1>
        </div>
        <button
          onClick={() => router.push(`/${params.slug}/home?session=${sessionId}`)}
          className="w-9 h-9 rounded-full flex items-center justify-center transition-colors"
          style={{ background: '#21262D', border: '1px solid #30363D', color: '#e0c0b1' }}
        >
          <span className="material-symbols-outlined text-[20px]">home</span>
        </button>
      </header>

      {/* Category tabs */}
      <nav
        ref={tabsRef}
        className="sticky top-16 z-40 flex gap-2 px-6 py-3 overflow-x-auto"
        style={{ background: '#0D1117', borderBottom: '1px solid rgba(88,66,55,0.25)', scrollbarWidth: 'none' }}
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
          <div className="relative overflow-hidden rounded-xl h-48 group cursor-pointer" onClick={() => openItemDetail(featuredItem)}>
            {featuredItem.image_url ? (
              <img
                src={featuredItem.image_url}
                alt={featuredItem.name}
                className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
              />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #21262D, #0f172a)' }}>
                <span className="material-symbols-outlined text-[72px]" style={{ color: '#30363D' }}>restaurant</span>
              </div>
            )}
            <div className="absolute inset-0" style={{ background: 'linear-gradient(to top, #0D1117 0%, transparent 60%)' }} />
            <div className="absolute bottom-4 left-4">
              <span
                className="text-[10px] font-mono font-bold uppercase tracking-widest px-2 py-0.5 rounded mb-2 inline-block"
                style={{ background: '#00E676', color: '#552100' }}
              >
                SUGESTÃO DO CHEF
              </span>
              <h2 className="text-lg font-semibold" style={{ fontFamily: 'Geist, sans-serif' }}>{featuredItem.name}</h2>
              <div className="flex items-center gap-2">
                {menuItemHasPromo(featuredItem) && (
                  <span className="text-xs font-mono line-through" style={{ color: '#8B949E' }}>
                    {formatCurrency(featuredItem.price)}
                  </span>
                )}
                <p className="text-sm font-mono" style={{ color: '#00E676' }}>
                  {formatCurrency(menuItemEffectivePrice(featuredItem))}
                </p>
              </div>
            </div>
            <div className="absolute bottom-4 right-4">
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center"
                style={{ background: '#00E676', color: '#003319' }}
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
              <span className="material-symbols-outlined text-[48px] block mb-2" style={{ color: '#30363D' }}>restaurant_menu</span>
              <p className="text-sm" style={{ color: '#8B949E' }}>Nenhum item disponível nesta categoria</p>
            </div>
          ) : (
            activeItems.map(item => {
              const cartItem = cart.find(c => c.menu_item.id === item.id)
              const qty = cartItem?.quantity ?? 0
              return (
                <div
                  key={item.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => openItemDetail(item)}
                  onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') openItemDetail(item) }}
                  className="flex items-stretch gap-3 rounded-xl p-3 transition-all cursor-pointer active:scale-[0.99]"
                  style={{
                    background: 'rgba(33,38,45,0.7)',
                    border: qty > 0 ? '1px solid #00E676' : '1px solid #30363D',
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
                      <div className="w-full h-full flex items-center justify-center" style={{ background: '#21262D' }}>
                        <span className="material-symbols-outlined text-[32px]" style={{ color: '#30363D' }}>fastfood</span>
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
                      <div>
                        {menuItemHasPromo(item) ? (
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-mono line-through" style={{ color: '#8B949E' }}>
                              {formatCurrency(item.price)}
                            </span>
                            <span className="text-sm font-mono font-semibold" style={{ color: '#00E676' }}>
                              {formatCurrency(menuItemEffectivePrice(item))}
                            </span>
                          </div>
                        ) : (
                          <span className="text-sm font-mono font-semibold" style={{ color: '#00E676' }}>
                            {formatCurrency(item.price)}
                          </span>
                        )}
                      </div>
                      {qty > 0 ? (
                        <span
                          className="min-w-[28px] h-7 px-2 rounded-full text-xs font-mono font-bold flex items-center justify-center"
                          style={{ background: '#00E676', color: '#003319' }}
                        >
                          {qty}×
                        </span>
                      ) : (
                        <span className="material-symbols-outlined text-[22px]" style={{ color: '#00E676' }}>add_circle</span>
                      )}
                    </div>
                    {notes[item.id] && (
                      <p className="text-[11px] font-mono mt-1.5 line-clamp-1 flex items-center gap-1" style={{ color: '#8B949E' }}>
                        <span className="material-symbols-outlined text-[13px]">edit_note</span>
                        {notes[item.id]}
                      </p>
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
        <div className="fixed bottom-20 left-0 right-0 px-4 pb-2 z-40">
          <button
            onClick={openReview}
            disabled={placing}
            className="w-full flex items-center justify-between rounded-2xl px-5 py-4 active:scale-[0.98] transition-all disabled:opacity-60"
            style={{
              background: 'linear-gradient(135deg, #00E676, #ea580c)',
              boxShadow: '0 8px 32px rgba(0,230,118,0.45), 0 0 0 1px rgba(0,230,118,0.3)',
            }}
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm"
                style={{ background: 'rgba(0,0,0,0.2)', color: '#fff' }}>
                {cartCount}
              </div>
              <div className="text-left">
                <span className="text-[10px] font-mono uppercase tracking-wider block" style={{ color: 'rgba(255,255,255,0.7)' }}>
                  {cartCount === 1 ? '1 item' : `${cartCount} itens`}
                </span>
                <span className="text-base font-bold leading-tight" style={{ color: '#fff', fontFamily: 'Geist, sans-serif' }}>
                  {formatCurrency(cartTotal)}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2" style={{ color: '#fff' }}>
              <span className="text-sm font-bold font-mono">Ver pedido</span>
              <span className="material-symbols-outlined text-[20px]">shopping_bag</span>
            </div>
          </button>
        </div>
      )}

      <CustomerBottomNav slug={params.slug} sessionId={sessionId ?? ''} />

      {detailItem && (
        <MenuItemDetailModal
          item={detailItem}
          quantity={detailQty}
          note={detailNote}
          onClose={closeItemDetail}
          onQuantityChange={setDetailQty}
          onNoteChange={setDetailNote}
          onConfirm={confirmItemDetail}
        />
      )}

      {showReview && (
        <OrderReviewModal
          cart={cart}
          notes={notes}
          total={cartTotal}
          itemCount={cartCount}
          placing={placing}
          onClose={() => setShowReview(false)}
          onConfirm={placeOrder}
          onUpdateQuantity={updateCartQuantity}
          onRemoveItem={removeItemCompletely}
          onUpdateNote={updateItemNote}
        />
      )}
    </div>
  )
}
