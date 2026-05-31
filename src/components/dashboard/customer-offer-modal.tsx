'use client'

import { useEffect, useMemo, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { DEV_BYPASS } from '@/lib/dev-mock'
import {
  buildWinBackMessage,
  type RestaurantCustomerStats,
  whatsAppLink,
} from '@/lib/restaurant-customers'
import {
  VALIDITY_OPTIONS,
  DEFAULT_VALIDITY_DAYS,
  loyaltyRuleToOfferDraft,
  type OfferBenefitType,
  type LoyaltyRuleInput,
} from '@/lib/customer-offers'

type Props = {
  customer: RestaurantCustomerStats
  restaurantId: string
  restaurantName: string
  loyaltyRules: LoyaltyRuleInput[]
  onClose: () => void
}

export function CustomerOfferModal({ customer, restaurantId, restaurantName, loyaltyRules, onClose }: Props) {
  // Opções de benefício vêm das regras de fidelidade configuradas em Settings.
  const presets = loyaltyRules.map(loyaltyRuleToOfferDraft)

  const [presetId, setPresetId] = useState<string>(presets[0]?.id ?? 'custom')
  const [customOffer, setCustomOffer] = useState(presets[0]?.offerText ?? '')
  const [validityDays, setValidityDays] = useState<number>(DEFAULT_VALIDITY_DAYS)
  const [sending, setSending] = useState(false)

  const selectedPreset = presets.find(p => p.id === presetId)
  const isCustom = presetId === 'custom'

  // Tipo/valor estruturado do benefício a ser gravado.
  const benefitType: OfferBenefitType = isCustom ? 'custom' : (selectedPreset?.benefitType ?? 'custom')
  const benefitValue = isCustom ? customOffer.trim() : (selectedPreset?.benefitValue ?? '')
  const offerText = isCustom ? customOffer.trim() : (selectedPreset?.offerText ?? customOffer.trim())
  const label = isCustom ? customOffer.trim() : (selectedPreset?.label ?? customOffer.trim())

  const generatedMessage = useMemo(
    () => buildWinBackMessage(customer, restaurantName, offerText),
    [customer, restaurantName, offerText],
  )

  // Mensagem editável: sincroniza com a gerada até o usuário editar manualmente.
  const [message, setMessage] = useState(generatedMessage)
  const [messageEdited, setMessageEdited] = useState(false)

  useEffect(() => {
    if (!messageEdited) setMessage(generatedMessage)
  }, [generatedMessage, messageEdited])

  function handlePresetChange(id: string) {
    setPresetId(id)
    const preset = presets.find(p => p.id === id)
    if (preset) setCustomOffer(preset.offerText)
  }

  async function handleSend() {
    if (!offerText) {
      toast.error('Descreva o benefício antes de enviar.')
      return
    }
    setSending(true)

    const expiresAt = new Date(Date.now() + validityDays * 86_400_000).toISOString()
    const waUrl = whatsAppLink(customer.whatsapp, message)

    if (DEV_BYPASS) {
      window.open(waUrl, '_blank', 'noopener,noreferrer')
      toast.success('Oferta registrada e WhatsApp aberto.')
      onClose()
      return
    }

    const supabase = createClient()
    const { error } = await supabase.from('customer_offers').insert({
      restaurant_id: restaurantId,
      customer_id: customer.id,
      benefit_type: benefitType,
      benefit_value: benefitValue,
      label,
      status: 'active',
      expires_at: expiresAt,
    })

    if (error) {
      toast.error('Erro ao registrar a oferta.')
      setSending(false)
      return
    }

    window.open(waUrl, '_blank', 'noopener,noreferrer')
    toast.success('Oferta registrada! O cliente poderá usá-la no checkout.')
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
            {presets.length === 0 && (
              <p className="text-[11px] font-mono text-amber-400 mb-2">
                Nenhuma regra de fidelidade configurada. Crie regras em Configurações · Fidelidade ou use um benefício personalizado.
              </p>
            )}
            <div className="flex flex-wrap gap-2">
              {presets.map(p => (
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
                  isCustom
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
            {isCustom && (
              <p className="text-[10px] font-mono text-amber-400 mt-1.5">
                Benefício personalizado é informativo — não aplica desconto automático no checkout.
              </p>
            )}
          </div>

          <div>
            <p className="text-[10px] font-mono uppercase tracking-widest text-on-surface-variant mb-2">Validade</p>
            <div className="flex flex-wrap gap-2">
              {VALIDITY_OPTIONS.map(v => (
                <button
                  key={v.days}
                  type="button"
                  onClick={() => setValidityDays(v.days)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-mono border transition-colors ${
                    validityDays === v.days
                      ? 'bg-primary-container text-on-primary-container border-primary/30'
                      : 'border-outline-variant text-on-surface-variant hover:border-primary/40'
                  }`}
                >
                  {v.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <p className="text-[10px] font-mono uppercase tracking-widest text-on-surface-variant">Mensagem (editável)</p>
              {messageEdited && (
                <button
                  type="button"
                  onClick={() => { setMessageEdited(false); setMessage(generatedMessage) }}
                  className="text-[10px] font-mono text-primary hover:underline"
                >
                  Restaurar padrão
                </button>
              )}
            </div>
            <textarea
              value={message}
              onChange={e => { setMessage(e.target.value); setMessageEdited(true) }}
              rows={7}
              className="w-full text-xs leading-relaxed whitespace-pre-wrap rounded-xl p-4 bg-surface-container-low border border-outline-variant text-on-surface font-mono max-h-48 resize-y focus:outline-none focus:ring-1 focus:ring-primary-container"
            />
            <p className="text-[10px] font-mono text-on-surface-variant mt-1.5">
              Edite livremente. Emojis funcionam no WhatsApp 👍
            </p>
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
            onClick={handleSend}
            disabled={!offerText || sending}
            className="flex-1 h-11 rounded-xl text-sm font-bold font-mono flex items-center justify-center gap-2 bg-emerald-600 text-white hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <span className="material-symbols-outlined text-[18px]">chat</span>}
            Enviar via WhatsApp
          </button>
        </div>
      </div>
    </div>
  )
}
