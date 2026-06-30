'use client'

import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import type { AsaasPaymentRequest } from '@/app/api/asaas/payments/route'
import type { SavedPaymentMethodDto } from '@/app/api/customer/payment-methods/route'
import { formatCardBrand } from '@/lib/payment-methods'
import { customerAuthFetch } from '@/lib/customer-auth'
import { formatCurrency } from '@/lib/utils'
import { createMercadoPagoCardToken } from '@/lib/mercadopago-browser'
import { toast } from 'sonner'

export type CardPaymentPayload = {
  paymentMethodId?: string
  saveCard?: boolean
  creditCard?: AsaasPaymentRequest['creditCard']
  creditCardHolderInfo?: AsaasPaymentRequest['creditCardHolderInfo']
  installmentCount?: number
  /** Mercado Pago — token gerado no browser */
  cardToken?: string
  mpPaymentMethodId?: string
}

type Props = {
  customerId: string | null
  suggestedAmount: number
  fixedAmount: boolean
  gatewayProvider?: 'asaas' | 'mercado_pago' | null
  mercadoPagoPublicKey?: string | null
  onConfirm: (amount: number, payload?: CardPaymentPayload) => void | Promise<void>
  onBack: () => void
  loading: boolean
}

function maskCard(v: string) {
  return v.replace(/\D/g, '').slice(0, 16).replace(/(\d{4})(?=\d)/g, '$1 ').trim()
}
function maskExpiry(v: string) {
  const d = v.replace(/\D/g, '').slice(0, 4)
  return d.length <= 2 ? d : `${d.slice(0, 2)}/${d.slice(2)}`
}

export function CardPaymentScreen({
  customerId,
  suggestedAmount,
  fixedAmount,
  gatewayProvider = 'asaas',
  mercadoPagoPublicKey,
  onConfirm,
  onBack,
  loading,
}: Props) {
  const usesMercadoPago = gatewayProvider === 'mercado_pago'
  const [tokenizing, setTokenizing] = useState(false)
  const [savedCards, setSavedCards] = useState<SavedPaymentMethodDto[]>([])
  const [loadingCards, setLoadingCards] = useState(!!customerId)
  const [mode, setMode] = useState<'saved' | 'new'>('saved')
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const [cardNumber, setCardNumber] = useState('')
  const [cardName, setCardName]     = useState('')
  const [expiry, setExpiry]         = useState('')
  const [cvv, setCvv]               = useState('')
  const [showCvv, setShowCvv]       = useState(false)
  const [saveCard, setSaveCard]     = useState(true)
  const [installments, setInstallments] = useState(1)
  const [amount, setAmount]         = useState(suggestedAmount.toFixed(2))

  const parsedAmt = fixedAmount ? suggestedAmount : (parseFloat(amount.replace(',', '.')) || 0)
  const extraAmt  = parsedAmt - suggestedAmount

  const newCardValid = cardNumber.replace(/\s/g, '').length >= 13 && cardName.trim()
    && expiry.length === 5 && cvv.length >= 3
    && (fixedAmount || parsedAmt >= suggestedAmount)

  const canPaySaved = !!selectedId && (fixedAmount || parsedAmt >= suggestedAmount)

  useEffect(() => {
    if (!customerId || usesMercadoPago) {
      setLoadingCards(false)
      setMode('new')
      return
    }

    customerAuthFetch(`/api/customer/payment-methods?customer=${customerId}`)
      .then(r => r.json())
      .then(data => {
        const methods = (data.methods ?? []) as SavedPaymentMethodDto[]
        setSavedCards(methods)
        const defaultCard = methods.find(m => m.isDefault) ?? methods[0]
        if (defaultCard) {
          setSelectedId(defaultCard.id)
          setMode('saved')
        } else {
          setMode('new')
        }
        setLoadingCards(false)
      })
      .catch(() => {
        setMode('new')
        setLoadingCards(false)
      })
  }, [customerId, usesMercadoPago])

  const inputSt: React.CSSProperties = {
    background: '#0D1117', border: '1px solid #30363D', color: '#FFFFFF',
    outline: 'none', width: '100%', height: 44, borderRadius: 12, padding: '0 12px', fontSize: 14,
  }
  const onFocus = (e: React.FocusEvent<HTMLInputElement | HTMLSelectElement>) => { e.target.style.borderColor = '#00E676' }
  const onBlur  = (e: React.FocusEvent<HTMLInputElement | HTMLSelectElement>) => { e.target.style.borderColor = '#30363D' }

  async function handlePay() {
    if (mode === 'saved' && selectedId && !usesMercadoPago) {
      await onConfirm(parsedAmt, { paymentMethodId: selectedId, installmentCount: installments })
      return
    }

    if (usesMercadoPago) {
      if (!mercadoPagoPublicKey) {
        toast.error('Mercado Pago não configurado para tokenizar cartão.')
        return
      }
      setTokenizing(true)
      try {
        const [mm, yy] = expiry.split('/')
        const { token, paymentMethodId } = await createMercadoPagoCardToken(mercadoPagoPublicKey, {
          cardNumber: cardNumber.replace(/\s/g, ''),
          cardholderName: cardName,
          expiryMonth: mm ?? '',
          expiryYear: `20${yy ?? ''}`,
          securityCode: cvv,
        })
        await onConfirm(parsedAmt, {
          installmentCount: installments,
          cardToken: token,
          mpPaymentMethodId: paymentMethodId,
        })
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Erro ao processar cartão.')
      } finally {
        setTokenizing(false)
      }
      return
    }

    await onConfirm(parsedAmt, {
      saveCard,
      installmentCount: installments,
      creditCard: {
        holderName: cardName,
        number: cardNumber.replace(/\s/g, ''),
        expiryMonth: expiry.split('/')[0] ?? '',
        expiryYear: `20${expiry.split('/')[1] ?? ''}`,
        ccv: cvv,
      },
      creditCardHolderInfo: {
        name: cardName,
        email: '',
        cpfCnpj: '',
        phone: '',
      },
    })
  }

  const payBusy = loading || tokenizing

  const amountBlock = (
    <div className="rounded-xl p-4 space-y-2" style={{ background: '#21262D', border: '1px solid #30363D' }}>
      <div className="flex justify-between">
        <label className="text-[10px] font-mono uppercase tracking-wider" style={{ color: '#8B949E' }}>
          {fixedAmount ? 'Valor definido' : 'Valor a pagar'}
        </label>
        {!fixedAmount && (
          <span className="text-[10px] font-mono" style={{ color: '#30363D' }}>Mínimo: {formatCurrency(suggestedAmount)}</span>
        )}
      </div>
      {fixedAmount ? (
        <div className="flex items-center gap-2 h-11 px-3 rounded-lg"
          style={{ background: '#0D1117', border: '1px solid #30363D' }}>
          <span className="text-sm" style={{ color: '#8B949E' }}>R$</span>
          <span className="text-xl font-black font-mono" style={{ color: '#00E676' }}>
            {suggestedAmount.toFixed(2).replace('.', ',')}
          </span>
        </div>
      ) : (
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm" style={{ color: '#8B949E' }}>R$</span>
          <input type="number" step="0.01" min={suggestedAmount.toFixed(2)} value={amount}
            onChange={e => setAmount(e.target.value)}
            className="w-full h-11 pl-9 pr-3 rounded-lg font-bold font-mono outline-none text-base"
            style={{ background: '#0D1117', border: `1px solid ${parsedAmt >= suggestedAmount ? '#00E676' : '#f87171'}`, color: '#FFFFFF' }} />
        </div>
      )}
      {!fixedAmount && extraAmt > 0.01 && (
        <p className="text-xs" style={{ color: '#34d399' }}>+{formatCurrency(extraAmt)} virará saldo da mesa 💛</p>
      )}
    </div>
  )

  const installmentsBlock = (
    <div className="flex flex-col gap-1">
      <label className="text-[10px] font-mono uppercase tracking-wider" style={{ color: '#8B949E' }}>Parcelas</label>
      <select value={installments} onChange={e => setInstallments(Number(e.target.value))}
        style={{ ...inputSt, appearance: 'none' } as React.CSSProperties}
        onFocus={onFocus} onBlur={onBlur}>
        {[1, 2, 3, 6, 12].map(n => (
          <option key={n} value={n}>{n}x de {formatCurrency(parsedAmt / n)}{n === 1 ? ' (sem juros)' : ''}</option>
        ))}
      </select>
    </div>
  )

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="p-2 -ml-2 rounded-full" style={{ color: '#00E676' }}>
          <span className="material-symbols-outlined">arrow_back</span>
        </button>
        <h2 className="text-lg font-semibold" style={{ fontFamily: 'Geist, sans-serif' }}>Cartão de Crédito</h2>
      </div>

      {loadingCards ? (
        <div className="py-8 flex justify-center">
          <Loader2 className="h-6 w-6 animate-spin" style={{ color: '#00E676' }} />
        </div>
      ) : (
        <>
          {savedCards.length > 0 && !usesMercadoPago && (
            <div className="flex gap-2">
              <button type="button" onClick={() => setMode('saved')}
                className="flex-1 py-2.5 rounded-lg text-xs font-mono font-bold uppercase tracking-wider transition-all"
                style={{
                  background: mode === 'saved' ? '#00E676' : 'transparent',
                  color: mode === 'saved' ? '#003319' : '#8B949E',
                  border: `1px solid ${mode === 'saved' ? '#00E676' : '#30363D'}`,
                }}>
                Cartão salvo
              </button>
              <button type="button" onClick={() => setMode('new')}
                className="flex-1 py-2.5 rounded-lg text-xs font-mono font-bold uppercase tracking-wider transition-all"
                style={{
                  background: mode === 'new' ? '#00E676' : 'transparent',
                  color: mode === 'new' ? '#003319' : '#8B949E',
                  border: `1px solid ${mode === 'new' ? '#00E676' : '#30363D'}`,
                }}>
                Novo cartão
              </button>
            </div>
          )}

          {mode === 'saved' && savedCards.length > 0 ? (
            <div className="space-y-2">
              {savedCards.map(card => (
                <button key={card.id} type="button" onClick={() => setSelectedId(card.id)}
                  className="w-full rounded-xl p-4 flex items-center gap-3 text-left transition-all active:scale-[0.98]"
                  style={{
                    background: selectedId === card.id ? 'rgba(0,230,118,0.1)' : '#21262D',
                    border: `1px solid ${selectedId === card.id ? 'rgba(0,230,118,0.4)' : '#30363D'}`,
                  }}>
                  <span className="material-symbols-outlined text-[24px]" style={{ color: '#00E676' }}>credit_card</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold">{formatCardBrand(card.brand)} •••• {card.lastFour}</p>
                    <p className="text-xs truncate" style={{ color: '#8B949E' }}>{card.holderName ?? 'Titular'}</p>
                  </div>
                  {card.isDefault && (
                    <span className="text-[9px] font-mono uppercase px-2 py-0.5 rounded"
                      style={{ background: 'rgba(0,230,118,0.15)', color: '#00E676' }}>Padrão</span>
                  )}
                </button>
              ))}
              {installmentsBlock}
              {amountBlock}
            </div>
          ) : (
            <div className="space-y-3">
              <div className="rounded-xl p-5 h-32 flex flex-col justify-between"
                style={{ background: 'linear-gradient(135deg,#1e3a5f,#0f2027)', border: '1px solid #30363D' }}>
                <span className="text-xs font-mono uppercase tracking-widest" style={{ color: 'rgba(218,226,253,0.5)' }}>Crédito</span>
                <div>
                  <p className="text-lg font-mono tracking-widest" style={{ color: cardNumber ? '#FFFFFF' : 'rgba(218,226,253,0.2)' }}>
                    {cardNumber || '•••• •••• •••• ••••'}
                  </p>
                  <p className="text-xs font-mono uppercase mt-1" style={{ color: cardName ? '#FFFFFF' : 'rgba(218,226,253,0.2)' }}>
                    {cardName || 'NOME DO TITULAR'}
                  </p>
                </div>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-mono uppercase tracking-wider" style={{ color: '#8B949E' }}>Número do Cartão</label>
                <input type="text" inputMode="numeric" value={cardNumber}
                  onChange={e => setCardNumber(maskCard(e.target.value))}
                  placeholder="0000 0000 0000 0000" maxLength={19}
                  style={inputSt} onFocus={onFocus} onBlur={onBlur} />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-mono uppercase tracking-wider" style={{ color: '#8B949E' }}>Nome do Titular</label>
                <input type="text" value={cardName} onChange={e => setCardName(e.target.value.toUpperCase())}
                  placeholder="COMO NO CARTÃO" style={inputSt} onFocus={onFocus} onBlur={onBlur} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-mono uppercase tracking-wider" style={{ color: '#8B949E' }}>Validade</label>
                  <input type="text" inputMode="numeric" value={expiry}
                    onChange={e => setExpiry(maskExpiry(e.target.value))}
                    placeholder="MM/AA" maxLength={5} style={inputSt} onFocus={onFocus} onBlur={onBlur} />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-mono uppercase tracking-wider" style={{ color: '#8B949E' }}>CVV</label>
                  <div className="relative">
                    <input type={showCvv ? 'text' : 'password'} inputMode="numeric" value={cvv}
                      onChange={e => setCvv(e.target.value.replace(/\D/g, '').slice(0, 4))}
                      placeholder="•••" style={{ ...inputSt, paddingRight: 40 }} onFocus={onFocus} onBlur={onBlur} />
                    <button type="button" onClick={() => setShowCvv(v => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2" style={{ color: '#30363D' }}>
                      <span className="material-symbols-outlined text-[18px]">{showCvv ? 'visibility_off' : 'visibility'}</span>
                    </button>
                  </div>
                </div>
              </div>

              {customerId && !usesMercadoPago && (
                <label className="flex items-start gap-3 cursor-pointer">
                  <input type="checkbox" checked={saveCard} onChange={e => setSaveCard(e.target.checked)}
                    className="mt-0.5 accent-orange-500" />
                  <span className="text-xs leading-relaxed" style={{ color: '#8B949E' }}>
                    Salvar cartão para pagamentos futuros (token seguro — dados sensíveis não ficam no KiComanda)
                  </span>
                </label>
              )}

              {installmentsBlock}
              {amountBlock}
            </div>
          )}
        </>
      )}

      <button
        onClick={handlePay}
        disabled={payBusy || loadingCards || (mode === 'saved' && !usesMercadoPago ? !canPaySaved : !newCardValid)}
        className="w-full h-14 rounded-full font-semibold flex items-center justify-center gap-2 active:scale-95 transition-all disabled:opacity-40"
        style={{ background: '#00E676', color: '#003319', boxShadow: '0 8px 30px rgba(0,230,118,0.25)', fontFamily: 'Geist, sans-serif' }}>
        {payBusy ? <><Loader2 className="h-5 w-5 animate-spin" /> Processando...</> : (
          <><span className="material-symbols-outlined">lock</span> Confirmar Pagamento</>
        )}
      </button>
    </div>
  )
}
