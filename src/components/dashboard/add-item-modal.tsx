'use client'

import { useState } from 'react'
import type { MenuCategory, MenuItem } from '@/types'
import { createClient } from '@/lib/supabase/client'
import { DEV_BYPASS } from '@/lib/dev-mock'
import { toast } from 'sonner'
import { Loader2, X } from 'lucide-react'

interface Props {
  categories: MenuCategory[]
  restaurantId: string
  defaultCategoryId?: string
  onClose: () => void
  onCreated: (item: MenuItem, categoryId: string) => void
}

export function AddItemModal({ categories, restaurantId, defaultCategoryId, onClose, onCreated }: Props) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [price, setPrice] = useState('')
  const [categoryId, setCategoryId] = useState(defaultCategoryId ?? categories[0]?.id ?? '')
  const [imageUrl, setImageUrl] = useState('')
  const [available, setAvailable] = useState(true)
  const [saving, setSaving] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim() || !price || !categoryId) return
    setSaving(true)

    const priceNum = parseFloat(price.replace(',', '.'))
    if (isNaN(priceNum) || priceNum < 0) {
      toast.error('Preço inválido')
      setSaving(false)
      return
    }

    if (DEV_BYPASS) {
      const newItem: MenuItem = {
        id: `item-${Date.now()}`,
        restaurant_id: restaurantId,
        category_id: categoryId,
        name: name.trim(),
        description: description.trim() || null,
        price: priceNum,
        image_url: imageUrl.trim() || null,
        available,
      }
      onCreated(newItem, categoryId)
      toast.success('Item criado!')
      onClose()
      return
    }

    const supabase = createClient()
    const { data, error } = await supabase
      .from('menu_items')
      .insert({
        restaurant_id: restaurantId,
        category_id: categoryId,
        name: name.trim(),
        description: description.trim() || null,
        price: priceNum,
        image_url: imageUrl.trim() || null,
        available,
      })
      .select()
      .single()

    if (error) { toast.error('Erro ao criar item'); setSaving(false); return }

    onCreated(data as MenuItem, categoryId)
    toast.success('Item criado!')
    onClose()
  }

  const fieldClass = 'w-full bg-surface-container-low border border-outline-variant text-on-surface placeholder:text-on-surface-variant/50 font-mono text-sm px-3 py-2.5 rounded-lg focus:outline-none focus:ring-1 focus:ring-primary-container transition-all'

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-surface-container border border-outline-variant rounded-xl w-full max-w-md shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-outline-variant">
          <h2
            className="text-lg font-semibold text-on-surface"
            style={{ fontFamily: 'Geist, sans-serif' }}
          >
            Novo Item
          </h2>
          <button
            onClick={onClose}
            className="text-on-surface-variant hover:text-on-surface transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          {/* Category */}
          <div>
            <label className="text-[10px] font-mono text-on-surface-variant uppercase tracking-widest mb-1.5 block">
              Categoria
            </label>
            <select
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className={fieldClass}
              style={{ colorScheme: 'dark' }}
            >
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id} className="bg-surface-container">
                  {cat.name}
                </option>
              ))}
            </select>
          </div>

          {/* Name */}
          <div>
            <label className="text-[10px] font-mono text-on-surface-variant uppercase tracking-widest mb-1.5 block">
              Nome <span className="text-error">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Bruschetta Clássica"
              required
              className={fieldClass}
            />
          </div>

          {/* Description */}
          <div>
            <label className="text-[10px] font-mono text-on-surface-variant uppercase tracking-widest mb-1.5 block">
              Descrição <span className="opacity-50 normal-case">(opcional)</span>
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Descreva o item…"
              rows={2}
              className={`${fieldClass} resize-none`}
            />
          </div>

          {/* Price + Available */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-mono text-on-surface-variant uppercase tracking-widest mb-1.5 block">
                Preço (R$) <span className="text-error">*</span>
              </label>
              <input
                type="text"
                inputMode="decimal"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="0,00"
                required
                className={fieldClass}
              />
            </div>
            <div>
              <label className="text-[10px] font-mono text-on-surface-variant uppercase tracking-widest mb-1.5 block">
                Disponível
              </label>
              <label className="flex items-center gap-3 py-2.5 cursor-pointer select-none">
                <input
                  type="checkbox"
                  className="sr-only toggle-checkbox"
                  checked={available}
                  onChange={(e) => setAvailable(e.target.checked)}
                />
                <div className="w-10 h-5 bg-surface-container-highest rounded-full transition-colors toggle-label border border-outline-variant relative flex-shrink-0">
                  <div className="absolute top-[2px] left-[2px] bg-white w-4 h-4 rounded-full transition-transform toggle-dot" />
                </div>
                <span className="text-sm font-mono text-on-surface-variant">
                  {available ? 'Sim' : 'Não'}
                </span>
              </label>
            </div>
          </div>

          {/* Image URL */}
          <div>
            <label className="text-[10px] font-mono text-on-surface-variant uppercase tracking-widest mb-1.5 block">
              URL da Imagem <span className="opacity-50 normal-case">(opcional)</span>
            </label>
            <input
              type="url"
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
              placeholder="https://…"
              className={fieldClass}
            />
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 bg-surface-container-high border border-outline-variant text-on-surface font-mono text-sm rounded-lg hover:bg-surface-variant transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving || !name.trim() || !price}
              className="flex-1 py-2.5 bg-primary-container text-on-primary-container font-bold font-mono text-sm rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Criar Item'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
