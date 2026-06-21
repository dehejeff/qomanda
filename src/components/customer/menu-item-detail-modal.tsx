'use client'

import { useState } from 'react'
import type { MenuItem } from '@/types'
import { formatCurrency } from '@/lib/utils'
import { menuItemEffectivePrice, menuItemHasPromo } from '@/lib/menu-item-pricing'

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
  } catch {
    return null
  }
}

type Props = {
  item: MenuItem
  quantity: number
  note: string
  onClose: () => void
  onQuantityChange: (quantity: number) => void
  onNoteChange: (note: string) => void
  onConfirm: () => void
}

export function MenuItemDetailModal({
  item,
  quantity,
  note,
  onClose,
  onQuantityChange,
  onNoteChange,
  onConfirm,
}: Props) {
  const effectivePrice = menuItemEffectivePrice(item)
  const lineTotal = effectivePrice * quantity
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
        style={{
          background: '#131b2e',
          border: '1px solid #334155',
          boxShadow: '0 16px 48px rgba(0,0,0,0.45)',
        }}
        onClick={e => e.stopPropagation()}
      >
        <div className="relative shrink-0 h-52 sm:h-56 overflow-hidden" style={{ background: '#1e293b' }}>
          {showVideo && embedUrl ? (
            <iframe
              src={embedUrl}
              className="w-full h-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              title={`Vídeo de ${item.name}`}
            />
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
                <button
                  type="button"
                  onClick={() => setShowVideo(true)}
                  className="absolute inset-0 flex items-center justify-center group"
                  aria-label="Ver vídeo do produto"
                >
                  <div
                    className="w-14 h-14 rounded-full flex items-center justify-center transition-transform group-active:scale-90"
                    style={{ background: 'rgba(249,115,22,0.9)', boxShadow: '0 4px 20px rgba(249,115,22,0.5)' }}
                  >
                    <span className="material-symbols-outlined text-[28px]" style={{ color: '#fff' }}>play_arrow</span>
                  </div>
                </button>
              )}
            </>
          )}
          <button
            type="button"
            onClick={showVideo ? () => setShowVideo(false) : onClose}
            className="absolute top-3 right-3 w-10 h-10 rounded-full flex items-center justify-center"
            style={{ background: 'rgba(11,19,38,0.75)', border: '1px solid #334155', color: '#dae2fd' }}
            aria-label={showVideo ? 'Voltar' : 'Fechar'}
          >
            <span className="material-symbols-outlined text-[20px]">{showVideo ? 'arrow_back' : 'close'}</span>
          </button>
          {!showVideo && item.is_chef_pick && (
            <span
              className="absolute top-3 left-3 text-[10px] font-mono font-bold uppercase tracking-widest px-2 py-1 rounded"
              style={{ background: '#ffb690', color: '#552100' }}
            >
              Sugestão do chef
            </span>
          )}
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          <div>
            <h2 className="text-xl font-bold leading-tight" style={{ fontFamily: 'Geist, sans-serif', color: '#dae2fd' }}>
              {item.name}
            </h2>
            <div className="flex items-center gap-2 mt-2">
              {menuItemHasPromo(item) && (
                <span className="text-sm font-mono line-through" style={{ color: '#a78b7d' }}>
                  {formatCurrency(item.price)}
                </span>
              )}
              <span className="text-lg font-mono font-bold" style={{ color: '#ffb690' }}>
                {formatCurrency(effectivePrice)}
              </span>
            </div>
          </div>

          {item.description ? (
            <p className="text-sm leading-relaxed" style={{ color: '#e0c0b1' }}>
              {item.description}
            </p>
          ) : (
            <p className="text-sm italic" style={{ color: '#584237' }}>
              Sem descrição cadastrada.
            </p>
          )}

          <div>
            <label className="text-[10px] font-mono uppercase tracking-widest mb-2 block" style={{ color: '#a78b7d' }}>
              Observações
            </label>
            <textarea
              value={note}
              onChange={e => onNoteChange(e.target.value)}
              placeholder="ex: sem cebola, ponto bem passado, molho à parte…"
              rows={3}
              className="w-full px-3 py-2.5 rounded-xl text-sm outline-none resize-none font-mono"
              style={{ background: '#0b1326', border: '1px solid #584237', color: '#dae2fd' }}
              onFocus={e => (e.target.style.borderColor = '#f97316')}
              onBlur={e => (e.target.style.borderColor = '#584237')}
            />
          </div>

          <div className="flex items-center justify-between rounded-xl px-4 py-3" style={{ background: '#1e293b', border: '1px solid #334155' }}>
            <span className="text-sm font-mono" style={{ color: '#a78b7d' }}>Quantidade</span>
            <div
              className="flex items-center rounded-full p-1"
              style={{ background: '#2d3449', border: '1px solid rgba(88,66,55,0.3)' }}
            >
              <button
                type="button"
                onClick={() => onQuantityChange(Math.max(0, quantity - 1))}
                className="w-10 h-10 flex items-center justify-center rounded-full active:scale-90 transition-all"
                style={{ color: '#f97316' }}
                aria-label="Diminuir quantidade"
              >
                <span className="material-symbols-outlined text-[20px]">remove</span>
              </button>
              <span className="px-3 text-base font-mono font-bold min-w-[32px] text-center" style={{ color: '#ffb690' }}>
                {quantity}
              </span>
              <button
                type="button"
                onClick={() => onQuantityChange(quantity + 1)}
                className="w-10 h-10 flex items-center justify-center rounded-full active:scale-95 transition-all"
                style={{ background: '#f97316', color: '#582200' }}
                aria-label="Aumentar quantidade"
              >
                <span className="material-symbols-outlined text-[20px]">add</span>
              </button>
            </div>
          </div>
        </div>

        <div className="shrink-0 px-5 py-4 space-y-2" style={{ borderTop: '1px solid #334155' }}>
          {quantity > 0 && (
            <p className="text-xs text-center font-mono" style={{ color: '#a78b7d' }}>
              Subtotal: <strong style={{ color: '#ffb690' }}>{formatCurrency(lineTotal)}</strong>
            </p>
          )}
          <button
            type="button"
            onClick={onConfirm}
            className="w-full h-12 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
            style={{
              background: quantity <= 0 ? 'rgba(248,113,113,0.15)' : '#f97316',
              color: quantity <= 0 ? '#f87171' : '#582200',
              border: quantity <= 0 ? '1px solid rgba(248,113,113,0.35)' : 'none',
              boxShadow: quantity > 0 ? '0 8px 24px rgba(249,115,22,0.25)' : 'none',
            }}
          >
            {quantity <= 0 ? (
              <>
                <span className="material-symbols-outlined text-[20px]">delete</span>
                Remover do pedido
              </>
            ) : (
              <>
                <span className="material-symbols-outlined text-[20px]">shopping_bag</span>
                Adicionar · {formatCurrency(lineTotal)}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
