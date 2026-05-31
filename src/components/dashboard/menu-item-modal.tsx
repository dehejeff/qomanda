'use client'

import { useEffect, useRef, useState } from 'react'
import type { MenuCategory, MenuItem } from '@/types'
import { createClient } from '@/lib/supabase/client'
import { DEV_BYPASS } from '@/lib/dev-mock'
import { uploadMenuItemImage } from '@/lib/menu-image-upload'
import { toast } from 'sonner'
import { Loader2, X } from 'lucide-react'

interface Props {
  categories: MenuCategory[]
  restaurantId: string
  defaultCategoryId?: string
  item?: MenuItem | null
  onClose: () => void
  onSaved: (item: MenuItem, categoryId: string, previousCategoryId?: string) => void
}

function parsePrice(raw: string): number | null {
  const n = parseFloat(raw.replace(',', '.'))
  if (!Number.isFinite(n) || n < 0) return null
  return n
}

export function MenuItemModal({
  categories,
  restaurantId,
  defaultCategoryId,
  item,
  onClose,
  onSaved,
}: Props) {
  const isEdit = Boolean(item)
  const fileRef = useRef<HTMLInputElement>(null)

  const [name, setName] = useState(item?.name ?? '')
  const [description, setDescription] = useState(item?.description ?? '')
  const [price, setPrice] = useState(item ? String(item.price).replace('.', ',') : '')
  const [promoPrice, setPromoPrice] = useState(
    item?.promo_price != null ? String(item.promo_price).replace('.', ',') : '',
  )
  const [categoryId, setCategoryId] = useState(item?.category_id ?? defaultCategoryId ?? categories[0]?.id ?? '')
  const [imageUrl, setImageUrl] = useState(item?.image_url ?? '')
  const [available, setAvailable] = useState(item?.available ?? true)
  const [containsAlcohol, setContainsAlcohol] = useState(item?.contains_alcohol ?? false)
  const [isChefPick, setIsChefPick] = useState(item?.is_chef_pick ?? false)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)

  useEffect(() => {
    if (!item) return
    setName(item.name)
    setDescription(item.description ?? '')
    setPrice(String(item.price).replace('.', ','))
    setPromoPrice(item.promo_price != null ? String(item.promo_price).replace('.', ',') : '')
    setCategoryId(item.category_id)
    setImageUrl(item.image_url ?? '')
    setAvailable(item.available)
    setContainsAlcohol(item.contains_alcohol)
    setIsChefPick(item.is_chef_pick ?? false)
  }, [item])

  async function handleImageFile(file: File | null) {
    if (!file) return
    if (!file.type.startsWith('image/')) {
      toast.error('Selecione um arquivo de imagem.')
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Imagem muito grande (máx. 5 MB).')
      return
    }

    setUploading(true)
    try {
      const itemId = item?.id ?? `new-${Date.now()}`
      const url = await uploadMenuItemImage(restaurantId, itemId, file)
      setImageUrl(url)
      toast.success('Imagem enviada!')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao enviar imagem.')
    } finally {
      setUploading(false)
    }
  }

  async function clearChefPickOnOthers(excludeId: string) {
    if (!isChefPick || DEV_BYPASS) return
    const supabase = createClient()
    await supabase
      .from('menu_items')
      .update({ is_chef_pick: false })
      .eq('restaurant_id', restaurantId)
      .neq('id', excludeId)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim() || !price || !categoryId) return

    const priceNum = parsePrice(price)
    if (priceNum == null) {
      toast.error('Preço inválido.')
      return
    }

    let promoNum: number | null = null
    if (promoPrice.trim()) {
      promoNum = parsePrice(promoPrice)
      if (promoNum == null) {
        toast.error('Preço promocional inválido.')
        return
      }
      if (promoNum >= priceNum) {
        toast.error('O preço promocional deve ser menor que o preço normal.')
        return
      }
    }

    setSaving(true)

    const payload = {
      restaurant_id: restaurantId,
      category_id: categoryId,
      name: name.trim(),
      description: description.trim() || null,
      price: priceNum,
      promo_price: promoNum,
      image_url: imageUrl.trim() || null,
      available,
      contains_alcohol: containsAlcohol,
      is_chef_pick: isChefPick,
    }

    if (DEV_BYPASS) {
      const saved: MenuItem = {
        id: item?.id ?? `item-${Date.now()}`,
        ...payload,
      }
      onSaved(saved, categoryId, item?.category_id)
      toast.success(isEdit ? 'Item atualizado!' : 'Item criado!')
      onClose()
      return
    }

    const supabase = createClient()

    if (isEdit && item) {
      const { data, error } = await supabase
        .from('menu_items')
        .update(payload)
        .eq('id', item.id)
        .select()
        .single()

      if (error) {
        toast.error(error.message.includes('promo_price') || error.message.includes('is_chef_pick')
          ? 'Colunas novas ausentes. Rode migrate-menu-item-promo-chef.sql no Supabase.'
          : 'Erro ao atualizar item.')
        setSaving(false)
        return
      }

      if (isChefPick) await clearChefPickOnOthers(item.id)
      onSaved(data as MenuItem, categoryId, item.category_id)
      toast.success('Item atualizado!')
      onClose()
      return
    }

    const { data, error } = await supabase
      .from('menu_items')
      .insert(payload)
      .select()
      .single()

    if (error) {
      toast.error(error.message.includes('promo_price') || error.message.includes('is_chef_pick')
        ? 'Colunas novas ausentes. Rode migrate-menu-item-promo-chef.sql no Supabase.'
        : 'Erro ao criar item.')
      setSaving(false)
      return
    }

    if (isChefPick) await clearChefPickOnOthers(data.id)
    onSaved(data as MenuItem, categoryId)
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
        className="bg-surface-container border border-outline-variant rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-outline-variant sticky top-0 bg-surface-container z-10">
          <h2 className="text-lg font-semibold text-on-surface" style={{ fontFamily: 'Geist, sans-serif' }}>
            {isEdit ? 'Editar Item' : 'Novo Item'}
          </h2>
          <button onClick={onClose} className="text-on-surface-variant hover:text-on-surface transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
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
                <option key={cat.id} value={cat.id} className="bg-surface-container">{cat.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-[10px] font-mono text-on-surface-variant uppercase tracking-widest mb-1.5 block">
              Nome <span className="text-error">*</span>
            </label>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} required className={fieldClass} />
          </div>

          <div>
            <label className="text-[10px] font-mono text-on-surface-variant uppercase tracking-widest mb-1.5 block">
              Descrição <span className="opacity-50 normal-case">(opcional)</span>
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className={`${fieldClass} resize-none`}
            />
          </div>

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
                Preço promocional
              </label>
              <input
                type="text"
                inputMode="decimal"
                value={promoPrice}
                onChange={(e) => setPromoPrice(e.target.value)}
                placeholder="Opcional"
                className={fieldClass}
              />
            </div>
          </div>

          <div>
            <label className="text-[10px] font-mono text-on-surface-variant uppercase tracking-widest mb-1.5 block">
              Foto do produto
            </label>
            <div className="flex gap-3 items-start">
              <div className="w-20 h-20 rounded-lg overflow-hidden bg-surface-dim border border-outline-variant flex items-center justify-center shrink-0">
                {imageUrl ? (
                  <img src={imageUrl} alt="" className="w-full h-full object-cover" />
                ) : (
                  <span className="material-symbols-outlined text-on-surface-variant opacity-30">image</span>
                )}
              </div>
              <div className="flex-1 space-y-2">
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  className="hidden"
                  onChange={(e) => handleImageFile(e.target.files?.[0] ?? null)}
                />
                <button
                  type="button"
                  disabled={uploading}
                  onClick={() => fileRef.current?.click()}
                  className="w-full py-2 text-xs font-mono rounded-lg border border-outline-variant hover:border-primary transition-colors disabled:opacity-50"
                >
                  {uploading ? 'Enviando…' : 'Enviar arquivo'}
                </button>
                <input
                  type="url"
                  value={imageUrl}
                  onChange={(e) => setImageUrl(e.target.value)}
                  placeholder="Ou cole a URL da imagem"
                  className={fieldClass}
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input type="checkbox" checked={available} onChange={(e) => setAvailable(e.target.checked)} />
              <span className="text-xs font-mono text-on-surface-variant">Disponível</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input type="checkbox" checked={containsAlcohol} onChange={(e) => setContainsAlcohol(e.target.checked)} />
              <span className="text-xs font-mono text-on-surface-variant">Alcoólico</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input type="checkbox" checked={isChefPick} onChange={(e) => setIsChefPick(e.target.checked)} />
              <span className="text-xs font-mono text-on-surface-variant">Sugestão do chef</span>
            </label>
          </div>

          {isChefPick && (
            <p className="text-xs leading-relaxed text-on-surface-variant bg-surface-container-high rounded-lg px-3 py-2">
              Este item aparece no banner &quot;Sugestão do Chef&quot; no cardápio mobile. Apenas um item por restaurante fica em destaque.
            </p>
          )}

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
              disabled={saving || uploading || !name.trim() || !price}
              className="flex-1 py-2.5 bg-primary-container text-on-primary-container font-bold font-mono text-sm rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : isEdit ? 'Salvar' : 'Criar Item'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
