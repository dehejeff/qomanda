'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams, useSearchParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { MenuCategory, MenuItem, CartItem, Session } from '@/types'
import { formatCurrency } from '@/lib/utils'
import { toast } from 'sonner'
import { ShoppingCart, Plus, Minus, ClipboardList, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

export default function MenuPage() {
  const params = useParams<{ slug: string }>()
  const searchParams = useSearchParams()
  const router = useRouter()
  const sessionId = searchParams.get('session')

  const [categories, setCategories] = useState<MenuCategory[]>([])
  const [cart, setCart] = useState<CartItem[]>([])
  const [loading, setLoading] = useState(true)
  const [placing, setPlacing] = useState(false)
  const [activeCategory, setActiveCategory] = useState<string | null>(null)

  useEffect(() => {
    async function loadMenu() {
      if (!sessionId) {
        router.replace(`/${params.slug}`)
        return
      }

      const supabase = createClient()
      const { data: session } = await supabase
        .from('sessions')
        .select('restaurant_id')
        .eq('id', sessionId)
        .single()

      if (!session) {
        router.replace(`/${params.slug}`)
        return
      }

      const { data } = await supabase
        .from('menu_categories')
        .select('*, items:menu_items(*)')
        .eq('restaurant_id', session.restaurant_id)
        .order('display_order')

      const filtered = (data ?? []).map((cat) => ({
        ...cat,
        items: (cat.items ?? []).filter((i: MenuItem) => i.available),
      })).filter((cat) => cat.items.length > 0)

      setCategories(filtered)
      if (filtered.length > 0) setActiveCategory(filtered[0].id)
      setLoading(false)
    }
    loadMenu()
  }, [params.slug, sessionId, router])

  function addToCart(item: MenuItem) {
    setCart((prev) => {
      const existing = prev.find((c) => c.menu_item.id === item.id)
      if (existing) return prev.map((c) => c.menu_item.id === item.id ? { ...c, quantity: c.quantity + 1 } : c)
      return [...prev, { menu_item: item, quantity: 1 }]
    })
  }

  function removeFromCart(itemId: string) {
    setCart((prev) => {
      const existing = prev.find((c) => c.menu_item.id === itemId)
      if (!existing) return prev
      if (existing.quantity === 1) return prev.filter((c) => c.menu_item.id !== itemId)
      return prev.map((c) => c.menu_item.id === itemId ? { ...c, quantity: c.quantity - 1 } : c)
    })
  }

  const cartTotal = cart.reduce((sum, c) => sum + c.menu_item.price * c.quantity, 0)
  const cartCount = cart.reduce((sum, c) => sum + c.quantity, 0)

  async function placeOrder() {
    if (cart.length === 0) return
    setPlacing(true)

    const supabase = createClient()
    const { data: session } = await supabase
      .from('sessions')
      .select('restaurant_id')
      .eq('id', sessionId)
      .single()

    if (!session) {
      toast.error('Sessão inválida.')
      setPlacing(false)
      return
    }

    const { data: order, error } = await supabase
      .from('orders')
      .insert({ session_id: sessionId, restaurant_id: session.restaurant_id, status: 'pending' })
      .select()
      .single()

    if (error || !order) {
      toast.error('Erro ao enviar pedido.')
      setPlacing(false)
      return
    }

    await supabase.from('order_items').insert(
      cart.map((c) => ({
        order_id: order.id,
        menu_item_id: c.menu_item.id,
        quantity: c.quantity,
        unit_price: c.menu_item.price,
      }))
    )

    setCart([])
    toast.success('Pedido enviado!')
    setPlacing(false)
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col bg-white pb-32">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white border-b border-slate-100 px-4 py-3 flex items-center justify-between">
        <h1 className="text-lg font-bold text-slate-900">Cardápio</h1>
        <button
          onClick={() => router.push(`/${params.slug}/orders?session=${sessionId}`)}
          className="flex items-center gap-1 text-sm text-slate-600"
        >
          <ClipboardList className="h-5 w-5" />
          Meus pedidos
        </button>
      </div>

      {/* Category tabs */}
      <div className="flex gap-2 px-4 py-3 overflow-x-auto border-b border-slate-100 scrollbar-hide">
        {categories.map((cat) => (
          <button
            key={cat.id}
            onClick={() => setActiveCategory(cat.id)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
              activeCategory === cat.id
                ? 'bg-orange-500 text-white'
                : 'bg-slate-100 text-slate-600'
            }`}
          >
            {cat.name}
          </button>
        ))}
      </div>

      {/* Items */}
      <div className="flex-1 px-4 py-4 space-y-8">
        {categories
          .filter((cat) => !activeCategory || cat.id === activeCategory)
          .map((cat) => (
            <div key={cat.id}>
              <h2 className="text-base font-bold text-slate-800 mb-3">{cat.name}</h2>
              <div className="space-y-3">
                {cat.items?.map((item) => {
                  const cartItem = cart.find((c) => c.menu_item.id === item.id)
                  return (
                    <div key={item.id} className="flex items-center gap-3 bg-white rounded-xl border border-slate-100 p-3 shadow-sm">
                      {item.image_url && (
                        <img src={item.image_url} alt={item.name} className="w-16 h-16 rounded-lg object-cover flex-shrink-0" />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-slate-900 text-sm">{item.name}</p>
                        {item.description && (
                          <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{item.description}</p>
                        )}
                        <p className="text-orange-500 font-bold text-sm mt-1">{formatCurrency(item.price)}</p>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {cartItem ? (
                          <>
                            <button onClick={() => removeFromCart(item.id)} className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center">
                              <Minus className="h-3 w-3" />
                            </button>
                            <span className="text-sm font-bold w-4 text-center">{cartItem.quantity}</span>
                          </>
                        ) : null}
                        <button onClick={() => addToCart(item)} className="w-7 h-7 rounded-full bg-orange-500 flex items-center justify-center">
                          <Plus className="h-3 w-3 text-white" />
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
      </div>

      {/* Cart bar */}
      {cartCount > 0 && (
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t border-slate-100">
          <Button
            onClick={placeOrder}
            disabled={placing}
            className="w-full bg-orange-500 hover:bg-orange-600 text-white h-14 rounded-xl text-base font-semibold flex items-center justify-between px-5"
          >
            {placing ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <>
                <div className="flex items-center gap-2">
                  <Badge className="bg-white text-orange-500 font-bold">{cartCount}</Badge>
                  <span>Fazer Pedido</span>
                </div>
                <span>{formatCurrency(cartTotal)}</span>
              </>
            )}
          </Button>
        </div>
      )}
    </div>
  )
}
