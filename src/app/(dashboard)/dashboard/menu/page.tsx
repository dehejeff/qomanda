'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { MenuCategory, MenuItem } from '@/types'
import { formatCurrency } from '@/lib/utils'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'
import { DEV_BYPASS, mockCategories, mockRestaurant } from '@/lib/dev-mock'
import { MenuItemModal } from '@/components/dashboard/menu-item-modal'
import { menuItemEffectivePrice, menuItemHasPromo } from '@/lib/menu-item-pricing'

export default function MenuManagementPage() {
  const [categories, setCategories] = useState<MenuCategory[]>([])
  const [restaurantId, setRestaurantId] = useState('')
  const [loading, setLoading] = useState(true)
  const [newCategoryName, setNewCategoryName] = useState('')
  const [addingCategory, setAddingCategory] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [modalCategoryId, setModalCategoryId] = useState<string | undefined>()
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null)

  useEffect(() => {
    if (DEV_BYPASS) {
      setRestaurantId(mockRestaurant.id)
      setCategories(mockCategories)
      setLoading(false)
      return
    }
    const supabase = createClient()
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return
      const { data: r } = await supabase.from('restaurants').select('id').eq('owner_id', user.id).single()
      if (!r) return
      setRestaurantId(r.id)
      const { data } = await supabase.from('menu_categories').select('*, items:menu_items(*)').eq('restaurant_id', r.id).order('display_order')
      setCategories((data ?? []) as MenuCategory[])
      setLoading(false)
    })
  }, [])

  function openModal(categoryId?: string, item?: MenuItem) {
    setModalCategoryId(categoryId)
    setEditingItem(item ?? null)
    setModalOpen(true)
  }

  function handleItemSaved(item: MenuItem, categoryId: string) {
    setCategories((prev) => {
      let next = prev.map((cat) => ({
        ...cat,
        items: (cat.items ?? []).filter((i) => i.id !== item.id),
      }))

      if (item.is_chef_pick) {
        next = next.map((cat) => ({
          ...cat,
          items: cat.items?.map((i) =>
            i.id === item.id ? i : { ...i, is_chef_pick: false },
          ),
        }))
      }

      next = next.map((cat) =>
        cat.id === categoryId
          ? { ...cat, items: [...(cat.items ?? []), item] }
          : cat,
      )

      return next
    })
  }

  async function addCategory() {
    if (!newCategoryName.trim()) return
    setAddingCategory(true)
    if (DEV_BYPASS) {
      const newCat: MenuCategory = {
        id: `cat-${Date.now()}`,
        restaurant_id: restaurantId,
        name: newCategoryName.trim(),
        display_order: categories.length,
        items: [],
      }
      setCategories((prev) => [...prev, newCat])
      setNewCategoryName('')
      setAddingCategory(false)
      toast.success('Categoria criada!')
      return
    }
    const supabase = createClient()
    const { data, error } = await supabase
      .from('menu_categories')
      .insert({ restaurant_id: restaurantId, name: newCategoryName.trim(), display_order: categories.length })
      .select()
      .single()
    if (error) { toast.error('Erro ao criar categoria'); setAddingCategory(false); return }
    setCategories((prev) => [...prev, { ...data, items: [] } as MenuCategory])
    setNewCategoryName('')
    setAddingCategory(false)
    toast.success('Categoria criada!')
  }

  function toggleItemAvailability(itemId: string, current: boolean) {
    if (!DEV_BYPASS) {
      const supabase = createClient()
      supabase.from('menu_items').update({ available: !current }).eq('id', itemId)
    }
    setCategories((prev) =>
      prev.map((cat) => ({
        ...cat,
        items: cat.items?.map((i) => i.id === itemId ? { ...i, available: !current } : i),
      }))
    )
  }

  function toggleItemAlcohol(itemId: string, current: boolean) {
    if (!DEV_BYPASS) {
      const supabase = createClient()
      supabase.from('menu_items').update({ contains_alcohol: !current }).eq('id', itemId)
    }
    setCategories((prev) =>
      prev.map((cat) => ({
        ...cat,
        items: cat.items?.map((i) => i.id === itemId ? { ...i, contains_alcohol: !current } : i),
      }))
    )
    toast.success(!current ? '🍷 Item marcado como alcoólico' : 'Item desmarcado como alcoólico')
  }

  const totalItems = categories.reduce((a, c) => a + (c.items?.length ?? 0), 0)
  const activeItems = categories.reduce((a, c) => a + (c.items?.filter((i) => i.available).length ?? 0), 0)

  if (loading) return (
    <div className="flex items-center justify-center py-20">
      <Loader2 className="h-6 w-6 animate-spin text-primary-container" />
    </div>
  )

  return (
    <>
      <div className="space-y-stack-lg">
        {/* Page header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h2 className="text-3xl font-semibold text-on-surface" style={{ fontFamily: 'Geist, sans-serif', letterSpacing: '-0.02em' }}>
              Cardápio Digital
            </h2>
            <p className="text-sm text-on-surface-variant mt-1">Gerencie categorias, itens e disponibilidade em tempo real.</p>
          </div>
          <div className="flex gap-3 flex-wrap">
            {/* Add category inline */}
            <div className="flex items-center gap-2">
              <input
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addCategory()}
                placeholder="Nova categoria…"
                className="bg-surface-container-low border border-outline-variant text-on-surface placeholder:text-on-surface-variant/60 text-sm font-mono px-3 py-2.5 rounded-lg focus:outline-none focus:ring-1 focus:ring-primary-container w-44"
              />
              <button
                onClick={addCategory}
                disabled={addingCategory || !newCategoryName.trim()}
                className="px-4 py-2.5 bg-surface-container-high border border-outline-variant text-on-surface text-sm font-mono rounded-lg flex items-center gap-2 hover:bg-surface-variant transition-colors disabled:opacity-40"
              >
                {addingCategory
                  ? <Loader2 className="h-4 w-4 animate-spin" />
                  : <span className="material-symbols-outlined text-[18px]">create_new_folder</span>
                }
                Categoria
              </button>
            </div>
            <button
              onClick={() => openModal()}
              className="px-4 py-2.5 bg-primary-container text-on-primary-container text-sm font-bold font-mono rounded-lg flex items-center gap-2 hover:opacity-90 transition-opacity"
            >
              <span className="material-symbols-outlined text-[18px]">add_box</span>
              Item
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-card-gap">
          {[
            { label: 'ITENS TOTAIS',  value: totalItems,          color: 'text-on-surface' },
            { label: 'ATIVOS HOJE',   value: activeItems,         color: 'text-primary' },
            { label: 'INDISPONÍVEIS', value: totalItems - activeItems, color: 'text-error' },
            { label: 'CATEGORIAS',    value: categories.length,   color: 'text-on-surface' },
          ].map(({ label, value, color }) => (
            <div key={label} className="p-4 bg-surface-container border border-outline-variant rounded-xl">
              <p className="text-[10px] font-mono text-on-surface-variant uppercase tracking-widest mb-2">{label}</p>
              <p className={`text-2xl font-bold ${color}`} style={{ fontFamily: 'Geist, sans-serif' }}>{value}</p>
            </div>
          ))}
        </div>

        {/* Categories */}
        {categories.length === 0 ? (
          <div className="tonal-layer-1 ghost-border rounded-xl p-12 text-center">
            <span className="material-symbols-outlined text-5xl text-on-surface-variant opacity-30 mb-3 block">restaurant_menu</span>
            <p className="text-sm font-mono text-on-surface-variant mb-4">Nenhuma categoria criada</p>
            <p className="text-xs font-mono text-on-surface-variant/60">Crie uma categoria acima para começar a adicionar itens.</p>
          </div>
        ) : (
          <div className="space-y-10">
            {categories.map((cat) => (
              <section key={cat.id}>
                {/* Category header */}
                <div className="flex items-center gap-3 mb-5 border-b border-outline-variant pb-3">
                  <h3
                    className="text-lg font-semibold text-on-surface flex items-center gap-2"
                    style={{ fontFamily: 'Geist, sans-serif' }}
                  >
                    <span className="material-symbols-outlined text-primary" style={{ fontVariationSettings: "'FILL' 1" }}>
                      restaurant_menu
                    </span>
                    {cat.name}
                  </h3>
                  <span className="px-2 py-0.5 bg-surface-container-high rounded text-[10px] font-mono text-on-surface-variant">
                    {cat.items?.length ?? 0} ITENS
                  </span>
                  {/* Add item to this category */}
                  <button
                    onClick={() => openModal(cat.id)}
                    className="ml-auto flex items-center gap-1.5 px-3 py-1.5 bg-surface-container-high border border-outline-variant text-on-surface-variant hover:text-primary hover:border-primary text-xs font-mono rounded-lg transition-colors"
                  >
                    <span className="material-symbols-outlined text-[16px]">add</span>
                    Adicionar item
                  </button>
                  <button className="text-on-surface-variant hover:text-primary transition-colors">
                    <span className="material-symbols-outlined text-[20px]">edit</span>
                  </button>
                </div>

                {/* Items grid */}
                {(cat.items ?? []).length === 0 ? (
                  <button
                    onClick={() => openModal(cat.id)}
                    className="w-full tonal-layer-1 ghost-border rounded-xl p-6 text-center border-dashed hover:border-primary transition-colors group"
                  >
                    <span className="material-symbols-outlined text-3xl text-on-surface-variant opacity-30 group-hover:opacity-60 group-hover:text-primary mb-2 block transition-all">add_circle</span>
                    <p className="text-sm font-mono text-on-surface-variant group-hover:text-primary transition-colors">
                      Adicionar primeiro item
                    </p>
                  </button>
                ) : (
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-card-gap">
                    {(cat.items ?? []).map((item) => (
                      <div
                        key={item.id}
                        className={`group bg-surface-container border border-outline-variant rounded-xl p-4 flex gap-4 hover:border-primary/50 transition-all duration-300 ${!item.available ? 'opacity-60 grayscale' : ''}`}
                      >
                        {/* Thumbnail */}
                        <div className="relative w-24 h-24 shrink-0 rounded-lg overflow-hidden bg-surface-dim flex items-center justify-center">
                          {item.image_url ? (
                            <img src={item.image_url} alt={item.name} className="w-full h-full object-cover" />
                          ) : (
                            <span className="material-symbols-outlined text-on-surface-variant text-3xl opacity-20">image</span>
                          )}
                          {item.is_chef_pick && (
                            <span className="absolute top-1 left-1 text-[7px] font-mono font-bold uppercase px-1 py-0.5 rounded"
                              style={{ background: '#ffb690', color: '#552100' }}>
                              Chef
                            </span>
                          )}
                          {!item.available && (
                            <div className="absolute inset-0 bg-background/60 flex items-center justify-center">
                              <span className="text-[8px] font-mono font-bold bg-error text-white px-1.5 py-0.5 rounded">ESGOTADO</span>
                            </div>
                          )}
                        </div>

                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex justify-between items-start mb-1 gap-2">
                            <h4 className="text-base font-semibold text-on-surface truncate" style={{ fontFamily: 'Geist, sans-serif' }}>
                              {item.name}
                            </h4>
                            <div className="text-right flex-shrink-0">
                              {menuItemHasPromo(item) ? (
                                <>
                                  <span className="block text-xs font-mono line-through text-on-surface-variant">
                                    {formatCurrency(item.price)}
                                  </span>
                                  <span className="text-sm font-mono font-bold text-primary">
                                    {formatCurrency(menuItemEffectivePrice(item))}
                                  </span>
                                </>
                              ) : (
                                <span className="text-sm font-mono font-bold text-primary">
                                  {formatCurrency(item.price)}
                                </span>
                              )}
                            </div>
                          </div>
                          {item.description && (
                            <p className="text-sm text-on-surface-variant line-clamp-2 mb-3">{item.description}</p>
                          )}
                          <div className="flex items-center justify-between gap-2 mt-2 flex-wrap">
                            <button
                              type="button"
                              onClick={() => openModal(cat.id, item)}
                              className="text-[10px] font-mono uppercase tracking-widest text-on-surface-variant hover:text-primary flex items-center gap-1 transition-colors"
                            >
                              <span className="material-symbols-outlined text-[16px]">edit</span>
                              Editar
                            </button>
                            <div className="flex items-center gap-4 flex-wrap justify-end">
                            {/* Álcool badge */}
                            {item.contains_alcohol && (
                              <span className="flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded"
                                style={{ background: 'rgba(249,115,22,0.12)', color: '#f97316', border: '1px solid rgba(249,115,22,0.25)' }}>
                                🍷 ALCOÓLICO
                              </span>
                            )}
                            {/* Alcohol toggle */}
                            <label className="relative inline-flex items-center gap-2 cursor-pointer" title="Marcar como bebida alcoólica">
                              <span className="text-[10px] font-mono text-on-surface-variant uppercase tracking-widest">Álcool</span>
                              <input
                                type="checkbox"
                                className="sr-only"
                                checked={item.contains_alcohol}
                                onChange={() => toggleItemAlcohol(item.id, item.contains_alcohol)}
                              />
                              <div className={`w-10 h-5 rounded-full transition-colors border relative ${item.contains_alcohol ? 'bg-amber-500 border-amber-500' : 'bg-surface-container-highest border-outline-variant'}`}>
                                <div className={`absolute top-[2px] w-4 h-4 rounded-full bg-white transition-all ${item.contains_alcohol ? 'left-[22px]' : 'left-[2px]'}`} />
                              </div>
                            </label>
                            <span className="text-[10px] font-mono text-on-surface-variant uppercase tracking-widest">Disponível</span>
                            <label className="relative inline-flex items-center cursor-pointer">
                              <input
                                type="checkbox"
                                className="sr-only toggle-checkbox"
                                checked={item.available}
                                onChange={() => toggleItemAvailability(item.id, item.available)}
                              />
                              <div className="w-10 h-5 bg-surface-container-highest rounded-full transition-colors toggle-label border border-outline-variant relative">
                                <div className="absolute top-[2px] left-[2px] bg-white w-4 h-4 rounded-full transition-transform toggle-dot" />
                              </div>
                            </label>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            ))}
          </div>
        )}
      </div>

      {/* Modal */}
      {modalOpen && (
        <MenuItemModal
          categories={categories}
          restaurantId={restaurantId}
          defaultCategoryId={modalCategoryId}
          item={editingItem}
          onClose={() => { setModalOpen(false); setEditingItem(null) }}
          onSaved={handleItemSaved}
        />
      )}
    </>
  )
}
