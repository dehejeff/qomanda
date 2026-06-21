'use client'

import { useEffect, useState, useRef } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import type { MenuCategory, MenuItem } from '@/types'
import { formatCurrency } from '@/lib/utils'
import { menuItemEffectivePrice, menuItemHasPromo } from '@/lib/menu-item-pricing'
import { Loader2 } from 'lucide-react'

export default function PublicMenuPage() {
  const params = useParams<{ slug: string }>()
  const slug = params.slug

  const [restaurantName, setRestaurantName] = useState('')
  const [logoUrl, setLogoUrl] = useState<string | null>(null)
  const [categories, setCategories] = useState<MenuCategory[]>([])
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [hasWaitlist, setHasWaitlist] = useState(false)
  const [activeCategory, setActiveCategory] = useState<string | null>(null)
  const [detailItem, setDetailItem] = useState<MenuItem | null>(null)

  const tabsRef = useRef<HTMLDivElement>(null)
  const categoryRefs = useRef<Record<string, HTMLElement | null>>({})

  useEffect(() => {
    async function load() {
      const supabase = createClient()

      const { data: restaurant } = await supabase
        .from('restaurants')
        .select('id, name, logo_url')
        .eq('slug', slug)
        .eq('status', 'active')
        .maybeSingle()

      if (!restaurant) {
        setNotFound(true)
        setLoading(false)
        return
      }

      setRestaurantName(restaurant.name)
      setLogoUrl(restaurant.logo_url)

      const [{ data: cats }, { count }] = await Promise.all([
        supabase
          .from('menu_categories')
          .select('*, items:menu_items(*)')
          .eq('restaurant_id', restaurant.id)
          .order('display_order'),
        supabase
          .from('table_features')
          .select('id', { count: 'exact', head: true })
          .eq('restaurant_id', restaurant.id),
      ])

      const filtered = (cats ?? []).map(cat => ({
        ...cat,
        items: (cat.items ?? []).filter((i: MenuItem) => i.available),
      })).filter(cat => cat.items.length > 0)

      setCategories(filtered)
      setActiveCategory(filtered[0]?.id ?? null)
      setHasWaitlist((count ?? 0) > 0)
      setLoading(false)
    }

    load()
  }, [slug])

  useEffect(() => {
    if (categories.length === 0) return
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            const id = entry.target.getAttribute('data-category-id')
            if (id) setActiveCategory(id)
          }
        }
      },
      { rootMargin: '-30% 0px -60% 0px' },
    )
    for (const ref of Object.values(categoryRefs.current)) {
      if (ref) observer.observe(ref)
    }
    return () => observer.disconnect()
  }, [categories])

  function scrollToCategory(id: string) {
    const el = categoryRefs.current[id]
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
    const tab = tabsRef.current?.querySelector(`[data-tab="${id}"]`) as HTMLElement | null
    tab?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' })
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#0b1326' }}>
        <Loader2 className="h-8 w-8 animate-spin" style={{ color: '#f97316' }} />
      </div>
    )
  }

  if (notFound) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 px-6" style={{ background: '#0b1326', color: '#dae2fd' }}>
        <span className="material-symbols-outlined text-[64px]" style={{ color: '#334155' }}>restaurant</span>
        <p className="text-lg font-semibold" style={{ fontFamily: 'Geist, sans-serif' }}>Restaurante não encontrado</p>
        <p className="text-sm text-center" style={{ color: '#a78b7d' }}>O link pode estar incorreto ou o restaurante não está ativo.</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ background: '#0b1326', color: '#dae2fd' }}>
      {/* Header */}
      <header className="sticky top-0 z-40 flex items-center gap-4 px-5 h-16"
        style={{ background: 'rgba(11,19,38,0.95)', borderBottom: '1px solid rgba(88,66,55,0.3)', backdropFilter: 'blur(12px)' }}>
        {logoUrl ? (
          <img src={logoUrl} alt={restaurantName} className="h-9 w-9 rounded-full object-cover shrink-0"
            style={{ border: '1px solid #334155' }} />
        ) : (
          <div className="h-9 w-9 rounded-full flex items-center justify-center shrink-0"
            style={{ background: '#1e293b', border: '1px solid #334155' }}>
            <span className="material-symbols-outlined text-[18px]" style={{ color: '#f97316' }}>restaurant</span>
          </div>
        )}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold truncate" style={{ fontFamily: 'Geist, sans-serif' }}>{restaurantName}</p>
          <p className="text-[10px] font-mono" style={{ color: '#a78b7d' }}>Cardápio digital</p>
        </div>
        {hasWaitlist && (
          <Link href={`/${slug}/fila`}
            className="flex items-center gap-1.5 text-xs font-mono px-3 py-1.5 rounded-full shrink-0"
            style={{ background: 'rgba(249,115,22,0.12)', color: '#f97316', border: '1px solid rgba(249,115,22,0.3)' }}>
            <span className="material-symbols-outlined text-[14px]">group</span>
            Fila de espera
          </Link>
        )}
      </header>

      {/* CTA check-in */}
      <div className="px-5 pt-4 pb-2">
        <Link href={`/${slug}`}
          className="flex items-center justify-center gap-2 w-full h-12 rounded-xl font-semibold text-sm"
          style={{ background: '#f97316', color: '#582200', boxShadow: '0 4px 20px rgba(249,115,22,0.25)', fontFamily: 'Geist, sans-serif' }}>
          <span className="material-symbols-outlined text-[20px]">qr_code_scanner</span>
          Escaneie a mesa para fazer pedidos
        </Link>
      </div>

      {/* Category tabs */}
      {categories.length > 1 && (
        <div ref={tabsRef}
          className="flex gap-2 px-5 py-3 overflow-x-auto no-scrollbar sticky top-16 z-30"
          style={{ background: 'rgba(11,19,38,0.95)', backdropFilter: 'blur(8px)' }}>
          {categories.map(cat => (
            <button
              key={cat.id}
              data-tab={cat.id}
              onClick={() => scrollToCategory(cat.id)}
              className="shrink-0 px-3 py-1.5 rounded-full text-xs font-mono transition-all"
              style={{
                background: activeCategory === cat.id ? '#f97316' : 'rgba(249,115,22,0.08)',
                color: activeCategory === cat.id ? '#582200' : '#a78b7d',
                border: activeCategory === cat.id ? 'none' : '1px solid rgba(249,115,22,0.15)',
              }}>
              {cat.name}
            </button>
          ))}
        </div>
      )}

      {/* Menu content */}
      <main className="flex-1 px-5 py-4 pb-16 space-y-8">
        {categories.map(cat => (
          <section
            key={cat.id}
            data-category-id={cat.id}
            ref={el => { categoryRefs.current[cat.id] = el }}
          >
            <h2 className="text-[11px] font-mono uppercase tracking-widest mb-3 pb-2"
              style={{ color: '#a78b7d', borderBottom: '1px solid rgba(88,66,55,0.25)' }}>
              {cat.name}
            </h2>
            <div className="space-y-3">
              {(cat.items as MenuItem[]).map(item => (
                <MenuItemCard
                  key={item.id}
                  item={item}
                  onClick={() => setDetailItem(item)}
                />
              ))}
            </div>
          </section>
        ))}

        {categories.length === 0 && (
          <div className="flex flex-col items-center justify-center gap-3 py-16">
            <span className="material-symbols-outlined text-[48px]" style={{ color: '#334155' }}>menu_book</span>
            <p className="text-sm" style={{ color: '#a78b7d' }}>Cardápio ainda não cadastrado.</p>
          </div>
        )}
      </main>

      {/* Powered by footer */}
      <footer className="py-4 text-center">
        <p className="text-[10px] font-mono" style={{ color: '#334155' }}>
          Cardápio digital por <span style={{ color: '#584237' }}>KiComanda</span>
        </p>
      </footer>

      {/* Item detail modal — somente leitura (sem carrinho) */}
      {detailItem && (
        <ReadOnlyItemModal
          item={detailItem}
          onClose={() => setDetailItem(null)}
          slug={slug}
        />
      )}
    </div>
  )
}

// ── Card do item ─────────────────────────────────────────────
function MenuItemCard({ item, onClick }: { item: MenuItem; onClick: () => void }) {
  const price = menuItemEffectivePrice(item)
  const hasPromo = menuItemHasPromo(item)

  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full flex items-center gap-4 p-3 rounded-xl text-left transition-all active:scale-[0.98]"
      style={{ background: 'rgba(30,41,59,0.6)', border: '1px solid rgba(51,65,85,0.6)' }}>
      {item.image_url ? (
        <img src={item.image_url} alt={item.name}
          className="h-16 w-16 rounded-lg object-cover shrink-0"
          style={{ border: '1px solid #334155' }} />
      ) : (
        <div className="h-16 w-16 rounded-lg flex items-center justify-center shrink-0"
          style={{ background: '#1e293b', border: '1px solid #334155' }}>
          <span className="material-symbols-outlined text-[28px]" style={{ color: '#334155' }}>restaurant</span>
        </div>
      )}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <p className="text-sm font-semibold leading-tight" style={{ color: '#dae2fd', fontFamily: 'Geist, sans-serif' }}>
            {item.name}
          </p>
          {item.is_chef_pick && (
            <span className="text-[9px] font-mono font-bold uppercase tracking-wider px-1.5 py-0.5 rounded"
              style={{ background: '#ffb690', color: '#552100' }}>
              Chef
            </span>
          )}
          {item.contains_alcohol && (
            <span className="text-[9px] font-mono px-1.5 py-0.5 rounded"
              style={{ background: 'rgba(139,92,246,0.15)', color: '#a78bfa', border: '1px solid rgba(139,92,246,0.2)' }}>
              🍷
            </span>
          )}
          {item.video_url && (
            <span className="text-[9px] font-mono px-1.5 py-0.5 rounded"
              style={{ background: 'rgba(249,115,22,0.12)', color: '#f97316', border: '1px solid rgba(249,115,22,0.2)' }}>
              ▶ vídeo
            </span>
          )}
        </div>
        {item.description && (
          <p className="text-xs mt-1 leading-relaxed line-clamp-2" style={{ color: '#a78b7d' }}>
            {item.description}
          </p>
        )}
        <div className="flex items-center gap-2 mt-2">
          {hasPromo && (
            <span className="text-xs font-mono line-through" style={{ color: '#584237' }}>
              {formatCurrency(item.price)}
            </span>
          )}
          <span className="text-sm font-mono font-bold" style={{ color: '#ffb690' }}>
            {formatCurrency(price)}
          </span>
        </div>
      </div>
      <span className="material-symbols-outlined text-[18px] shrink-0" style={{ color: '#334155' }}>chevron_right</span>
    </button>
  )
}

// ── Modal de detalhe somente leitura ─────────────────────────
function ReadOnlyItemModal({ item, onClose, slug }: { item: MenuItem; onClose: () => void; slug: string }) {
  const price = menuItemEffectivePrice(item)
  const hasPromo = menuItemHasPromo(item)
  const [showVideo, setShowVideo] = useState(false)
  const embedUrl = item.video_url ? getYoutubeEmbedUrl(item.video_url) : null

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center p-4"
      style={{ background: 'rgba(11,19,38,0.82)', backdropFilter: 'blur(8px)' }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-md max-h-[90vh] flex flex-col rounded-2xl overflow-hidden"
        style={{ background: '#131b2e', border: '1px solid #334155', boxShadow: '0 16px 48px rgba(0,0,0,0.45)' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Image / video */}
        <div className="relative shrink-0 h-52 sm:h-56 overflow-hidden" style={{ background: '#1e293b' }}>
          {showVideo && embedUrl ? (
            <iframe src={embedUrl} className="w-full h-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen title={`Vídeo de ${item.name}`} />
          ) : (
            <>
              {item.image_url ? (
                <img src={item.image_url} alt={item.name} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <span className="material-symbols-outlined text-[72px]" style={{ color: '#334155' }}>restaurant</span>
                </div>
              )}
              <div className="absolute inset-0" style={{ background: 'linear-gradient(to top, rgba(19,27,46,0.85) 0%, transparent 50%)' }} />
              {embedUrl && (
                <button type="button" onClick={() => setShowVideo(true)}
                  className="absolute inset-0 flex items-center justify-center group" aria-label="Ver vídeo">
                  <div className="w-14 h-14 rounded-full flex items-center justify-center transition-transform group-active:scale-90"
                    style={{ background: 'rgba(249,115,22,0.9)', boxShadow: '0 4px 20px rgba(249,115,22,0.5)' }}>
                    <span className="material-symbols-outlined text-[28px]" style={{ color: '#fff' }}>play_arrow</span>
                  </div>
                </button>
              )}
            </>
          )}
          <button type="button"
            onClick={showVideo ? () => setShowVideo(false) : onClose}
            className="absolute top-3 right-3 w-10 h-10 rounded-full flex items-center justify-center"
            style={{ background: 'rgba(11,19,38,0.75)', border: '1px solid #334155', color: '#dae2fd' }}>
            <span className="material-symbols-outlined text-[20px]">{showVideo ? 'arrow_back' : 'close'}</span>
          </button>
          {!showVideo && item.is_chef_pick && (
            <span className="absolute top-3 left-3 text-[10px] font-mono font-bold uppercase tracking-widest px-2 py-1 rounded"
              style={{ background: '#ffb690', color: '#552100' }}>
              Sugestão do chef
            </span>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
          <div>
            <h2 className="text-xl font-bold leading-tight" style={{ fontFamily: 'Geist, sans-serif', color: '#dae2fd' }}>
              {item.name}
            </h2>
            <div className="flex items-center gap-2 mt-2">
              {hasPromo && (
                <span className="text-sm font-mono line-through" style={{ color: '#a78b7d' }}>
                  {formatCurrency(item.price)}
                </span>
              )}
              <span className="text-lg font-mono font-bold" style={{ color: '#ffb690' }}>
                {formatCurrency(price)}
              </span>
            </div>
          </div>
          {item.description ? (
            <p className="text-sm leading-relaxed" style={{ color: '#e0c0b1' }}>{item.description}</p>
          ) : (
            <p className="text-sm italic" style={{ color: '#584237' }}>Sem descrição cadastrada.</p>
          )}
        </div>

        {/* CTA */}
        <div className="shrink-0 px-5 py-4" style={{ borderTop: '1px solid #334155' }}>
          <Link href={`/${slug}`}
            className="flex items-center justify-center gap-2 w-full h-12 rounded-xl font-bold text-sm transition-all active:scale-[0.98]"
            style={{ background: '#f97316', color: '#582200', boxShadow: '0 8px 24px rgba(249,115,22,0.25)' }}>
            <span className="material-symbols-outlined text-[20px]">qr_code_scanner</span>
            Escaneie a mesa para pedir
          </Link>
        </div>
      </div>
    </div>
  )
}

function getYoutubeEmbedUrl(url: string): string | null {
  try {
    const parsed = new URL(url)
    let videoId: string | null = null
    if (parsed.hostname.includes('youtube.com')) {
      videoId = parsed.searchParams.get('v')
    } else if (parsed.hostname === 'youtu.be') {
      videoId = parsed.pathname.slice(1).split('?')[0]
    }
    if (!videoId) return null
    return `https://www.youtube.com/embed/${videoId}?rel=0&modestbranding=1&autoplay=1`
  } catch { return null }
}
