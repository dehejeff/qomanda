'use client'

import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import type { AsaasPaymentRequest } from '@/app/api/asaas/payments/route'
import type { SavedPaymentMethodDto } from '@/app/api/customer/payment-methods/route'
import { formatCardBrand } from '@/lib/payment-methods'
import { formatCurrency } from '@/lib/utils'

export type CardPaymentPayload = {
  paymentMethodId?: string
  saveCard?: boolean
  creditCard?: AsaasPaymentRequest['creditCard']
  creditCardHolderInfo?: AsaasPaymentRequest['creditCardHolderInfo']
  installmentCount?: number
}

type Props = {
  customerId: string | null
  suggestedAmount: number
  fixedAmount: boolean
  onConfirm: (amount: number, payload?: CardPaymentPayload) => void
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
  onConfirm,
  onBack,
  loading,
}: Props) {
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
    if (!customerId) {
      setLoadingCards(false)
      setMode('new')
      return
    }

    fetch(`/api/customer/payment-methods?customer=${customerId}`)
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
  }, [customerId])

  const inputSt: React.CSSProperties = {
    background: '#0b1326', border: '1px solid #334155', color: '#dae2fd',
    outline: 'none', width: '100%', height: 44, borderRadius: 12, padding: '0 12px', fontSize: 14,
  }
  const onFocus = (e: React.FocusEvent<HTMLInputElement | HTMLSelectElement>) => { e.target.style.borderColor = '#f97316' }
  const onBlur  = (e: React.FocusEvent<HTMLInputElement | HTMLSelectElement>) => { e.target.style.borderColor = '#334155' }

  function handlePay() {
    if (mode === 'saved' && selectedId) {
      onConfirm(parsedAmt, { paymentMethodId: selectedId, installmentCount: installments })
      return
    }

    onConfirm(parsedAmt, {
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

  const amountBlock = (
    <div className="rounded-xl p-4 space-y-2" style={{ background: '#1e293b', border: '1px solid #334155' }}>
      <div className="flex justify-between">
        <label className="text-[10px] font-mono uppercase tracking-wider" style={{ color: '#a78b7d' }}>
          {fixedAmount ? 'Valor definido' : 'Valor a pagar'}
        </label>
        {!fixedAmount && (
          <span className="text-[10px] font-mono" style={{ color: '#584237' }}>Mínimo: {formatCurrency(suggestedAmount)}</span>
        )}
      </div>
      {fixedAmount ? (
        <div className="flex items-center gap-2 h-11 px-3 rounded-lg"
          style={{ background: '#0b1326', border: '1px solid #584237' }}>
          <span className="text-sm" style={{ color: '#a78b7d' }}>R$</span>
          <span className="text-xl font-black font-mono" style={{ color: '#ffb690' }}>
            {suggestedAmount.toFixed(2).replace('.', ',')}
          </span>
        </div>
      ) : (
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm" style={{ color: '#a78b7d' }}>R$</span>
          <input type="number" step="0.01" min={suggestedAmount.toFixed(2)} value={amount}
            onChange={e => setAmount(e.target.value)}
            className="w-full h-11 pl-9 pr-3 rounded-lg font-bold font-mono outline-none text-base"
            style={{ background: '#0b1326', border: `1px solid ${parsedAmt >= suggestedAmount ? '#f97316' : '#f87171'}`, color: '#dae2fd' }} />
        </div>
      )}
      {!fixedAmount && extraAmt > 0.01 && (
        <p className="text-xs" style={{ color: '#34d399' }}>+{formatCurrency(extraAmt)} virará saldo da mesa 💛</p>
      )}
    </div>
  )

  const installmentsBlock = (
    <div className="flex flex-col gap-1">
      <label className="text-[10px] font-mono uppercase tracking-wider" style={{ color: '#a78b7d' }}>Parcelas</label>
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
        <button onClick={onBack} className="p-2 -ml-2 rounded-full" style={{ color: '#ffb690' }}>
          <span className="material-symbols-outlined">arrow_back</span>
        </button>
        <h2 className="text-lg font-semibold" style={{ fontFamily: 'Geist, sans-serif' }}>Cartão de Crédito</h2>
      </div>

      {loadingCards ? (
        <div className="py-8 flex justify-center">
          <Loader2 className="h-6 w-6 animate-spin" style={{ color: '#f97316' }} />
        </div>
      ) : (
        <>
          {savedCards.length > 0 && (
            <div className="flex gap-2">
              <button type="button" onClick={() => setMode('saved')}
                className="flex-1 py-2.5 rounded-lg text-xs font-mono font-bold uppercase tracking-wider transition-all"
                style={{
                  background: mode === 'saved' ? '#f97316' : 'transparent',
                  color: mode === 'saved' ? '#582200' : '#a78b7d',
                  border: `1px solid ${mode === 'saved' ? '#f97316' : '#334155'}`,
                }}>
                Cartão salvo
              </button>
              <button type="button" onClick={() => setMode('new')}
                className="flex-1 py-2.5 rounded-lg text-xs font-mono font-bold uppercase tracking-wider transition-all"
                style={{
                  background: mode === 'new' ? '#f97316' : 'transparent',
                  color: mode === 'new' ? '#582200' : '#a78b7d',
                  border: `1px solid ${mode === 'new' ? '#f97316' : '#334155'}`,
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
                    background: selectedId === card.id ? 'rgba(249,115,22,0.1)' : '#1e293b',
                    border: `1px solid ${selectedId === card.id ? 'rgba(249,115,22,0.4)' : '#334155'}`,
                  }}>
                  <span className="material-symbols-outlined text-[24px]" style={{ color: '#f97316' }}>credit_card</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold">{formatCardBrand(card.brand)} •••• {card.lastFour}</p>
                    <p className="text-xs truncate" style={{ color: '#a78b7d' }}>{card.holderName ?? 'Titular'}</p>
                  </div>
                  {card.isDefault && (
                    <span className="text-[9px] font-mono uppercase px-2 py-0.5 rounded"
                      style={{ background: 'rgba(249,115,22,0.15)', color: '#ffb690' }}>Padrão</span>
                  )}
                </button>
              ))}
              {installmentsBlock}
              {amountBlock}
            </div>
          ) : (
            <div className="space-y-3">
              <div className="rounded-xl p-5 h-32 flex flex-col justify-between"
                style={{ background: 'linear-gradient(135deg,#1e3a5f,#0f2027)', border: '1px solid #334155' }}>
                <span className="text-xs font-mono uppercase tracking-widest" style={{ color: 'rgba(218,226,253,0.5)' }}>Crédito</span>
                <div>
                  <p className="text-lg font-mono tracking-widest" style={{ color: cardNumber ? '#dae2fd' : 'rgba(218,226,253,0.2)' }}>
                    {cardNumber || '•••• •••• •••• ••••'}
                  </p>
                  <p className="text-xs font-mono uppercase mt-1" style={{ color: cardName ? '#dae2fd' : 'rgba(218,226,253,0.2)' }}>
                    {cardName || 'NOME DO TITULAR'}
                  </p>
                </div>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-mono uppercase tracking-wider" style={{ color: '#a78b7d' }}>Número do Cartão</label>
                <input type="text" inputMode="numeric" value={cardNumber}
                  onChange={e => setCardNumber(maskCard(e.target.value))}
                  placeholder="0000 0000 0000 0000" maxLength={19}
                  style={inputSt} onFocus={onFocus} onBlur={onBlur} />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-mono uppercase tracking-wider" style={{ color: '#a78b7d' }}>Nome do Titular</label>
                <input type="text" value={cardName} onChange={e => setCardName(e.target.value.toUpperCase())}
                  placeholder="COMO NO CARTÃO" style={inputSt} onFocus={onFocus} onBlur={onBlur} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-mono uppercase tracking-wider" style={{ color: '#a78b7d' }}>Validade</label>
                  <input type="text" inputMode="numeric" value={expiry}
                    onChange={e => setExpiry(maskExpiry(e.target.value))}
                    placeholder="MM/AA" maxLength={5} style={inputSt} onFocus={onFocus} onBlur={onBlur} />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-mono uppercase tracking-wider" style={{ color: '#a78b7d' }}>CVV</label>
                  <div className="relative">
                    <input type={showCvv ? 'text' : 'password'} inputMode="numeric" value={cvv}
                      onChange={e => setCvv(e.target.value.replace(/\D/g, '').slice(0, 4))}
                      placeholder="•••" style={{ ...inputSt, paddingRight: 40 }} onFocus={onFocus} onBlur={onBlur} />
                    <button type="button" onClick={() => setShowCvv(v => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2" style={{ color: '#584237' }}>
                      <span className="material-symbols-outlined text-[18px]">{showCvv ? 'visibility_off' : 'visibility'}</span>
                    </button>
                  </div>
                </div>
              </div>

              {customerId && (
                <label className="flex items-start gap-3 cursor-pointer">
                  <input type="checkbox" checked={saveCard} onChange={e => setSaveCard(e.target.checked)}
                    className="mt-0.5 accent-orange-500" />
                  <span className="text-xs leading-relaxed" style={{ color: '#a78b7d' }}>
                    Salvar cartão para pagamentos futuros (token seguro via Asaas — dados sensíveis não ficam no Qomanda)
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
        disabled={loading || loadingCards || (mode === 'saved' ? !canPaySaved : !newCardValid)}
        className="w-full h-14 rounded-full font-semibold flex items-center justify-center gap-2 active:scale-95 transition-all disabled:opacity-40"
        style={{ background: '#f97316', color: '#582200', boxShadow: '0 8px 30px rgba(249,115,22,0.25)', fontFamily: 'Geist, sans-serif' }}>
        {loading ? <><Loader2 className="h-5 w-5 animate-spin" /> Processando...</> : (
          <><span className="material-symbols-outlined">lock</span> Confirmar Pagamento</>
        )}
      </button>
    </div>
  )
}
