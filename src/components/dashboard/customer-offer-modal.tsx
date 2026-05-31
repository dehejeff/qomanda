'use client'

import { useMemo, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import {
  buildWinBackMessage,
  OFFER_PRESETS,
  type RestaurantCustomerStats,
  whatsAppLink,
} from '@/lib/restaurant-customers'

type Props = {
  customer: RestaurantCustomerStats
  restaurantName: string
  onClose: () => void
}

export function CustomerOfferModal({ customer, restaurantName, onClose }: Props) {
  const suggestedOffer = customer.nextRewardLabel ?? OFFER_PRESETS[0].offer
  const [presetId, setPresetId] = useState<string>(OFFER_PRESETS[0].id)
  const [customOffer, setCustomOffer] = useState(suggestedOffer)

  const selectedPreset = OFFER_PRESETS.find(p => p.id === presetId)
  const offerText = presetId === 'custom' ? customOffer.trim() : (selectedPreset?.offer ?? customOffer.trim())

  const message = useMemo(
    () => buildWinBackMessage(customer, restaurantName, offerText || suggestedOffer),
    [customer, restaurantName, offerText, suggestedOffer],
  )

  const waUrl = offerText ? whatsAppLink(customer.whatsapp, message) : ''

  function handlePresetChange(id: string) {
    setPresetId(id)
    const preset = OFFER_PRESETS.find(p => p.id === id)
    if (preset) setCustomOffer(preset.offer)
  }

  function openWhatsApp() {
    if (!waUrl) {
      toast.error('Descreva o benefício antes de enviar.')
      return
    }
    window.open(waUrl, '_blank', 'noopener,noreferrer')
    toast.success('WhatsApp aberto com a mensagem pronta.')
    onClose()
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={onClose}>
      <div
        className="w-full max-w-lg rounded-2xl border border-outline-variant bg-surface-container shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-outline-variant">
          <div>
            <p className="text-sm font-bold text-on-surface">
              Oferta para {customer.firstName} {customer.lastName}
            </p>
            <p className="text-xs font-mono text-on-surface-variant mt-0.5">
              {customer.visitCount} visita{customer.visitCount !== 1 ? 's' : ''} · {customer.daysSinceLastVisit} dia(s) ausente
            </p>
          </div>
          <button type="button" onClick={onClose} className="p-2 rounded-lg hover:bg-surface-container-highest text-on-surface-variant">
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div>
            <p className="text-[10px] font-mono uppercase tracking-widest text-on-surface-variant mb-2">Tipo de benefício</p>
            <div className="flex flex-wrap gap-2">
              {OFFER_PRESETS.map(p => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => handlePresetChange(p.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-mono border transition-colors ${
                    presetId === p.id
                      ? 'bg-primary-container text-on-primary-container border-primary/30'
                      : 'border-outline-variant text-on-surface-variant hover:border-primary/40'
                  }`}
                >
                  {p.label}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setPresetId('custom')}
                className={`px-3 py-1.5 rounded-lg text-xs font-mono border transition-colors ${
                  presetId === 'custom'
                    ? 'bg-primary-container text-on-primary-container border-primary/30'
                    : 'border-outline-variant text-on-surface-variant hover:border-primary/40'
                }`}
              >
                Personalizado
              </button>
            </div>
          </div>

          <div>
            <label className="text-[10px] font-mono uppercase tracking-widest text-on-surface-variant mb-1.5 block">
              Descrição do benefício
            </label>
            <input
              value={customOffer}
              onChange={e => { setCustomOffer(e.target.value); setPresetId('custom') }}
              className="w-full bg-surface-container-low border border-outline-variant rounded-lg px-3 py-2.5 text-sm text-on-surface font-mono focus:outline-none focus:ring-1 focus:ring-primary-container"
              placeholder="Ex: 15% off + entrada grátis"
            />
          </div>

          <div>
            <p className="text-[10px] font-mono uppercase tracking-widest text-on-surface-variant mb-1.5">Prévia da mensagem</p>
            <pre className="text-xs leading-relaxed whitespace-pre-wrap rounded-xl p-4 bg-surface-container-low border border-outline-variant text-on-surface-variant font-mono max-h-40 overflow-y-auto">
              {message}
            </pre>
          </div>
        </div>

        <div className="flex gap-2 px-5 py-4 border-t border-outline-variant">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 h-11 rounded-xl text-sm font-mono border border-outline-variant text-on-surface-variant hover:bg-surface-container-highest transition-colors"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={openWhatsApp}
            disabled={!offerText}
            className="flex-1 h-11 rounded-xl text-sm font-bold font-mono flex items-center justify-center gap-2 bg-emerald-600 text-white hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            <span className="material-symbols-outlined text-[18px]">chat</span>
            Enviar via WhatsApp
          </button>
        </div>
      </div>
    </div>
  )
}
