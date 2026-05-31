'use client'

import { useCallback, useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import type { SavedPaymentMethodDto } from '@/app/api/customer/payment-methods/route'
import { formatCardBrand } from '@/lib/payment-methods'

function maskCard(v: string) {
  return v.replace(/\D/g, '').slice(0, 16).replace(/(\d{4})(?=\d)/g, '$1 ').trim()
}
function maskExpiry(v: string) {
  const d = v.replace(/\D/g, '').slice(0, 4)
  return d.length <= 2 ? d : `${d.slice(0, 2)}/${d.slice(2)}`
}

type Props = {
  customerId: string
}

export function SavedCardsSection({ customerId }: Props) {
  const [cards, setCards] = useState<SavedPaymentMethodDto[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [cardNumber, setCardNumber] = useState('')
  const [cardName, setCardName] = useState('')
  const [expiry, setExpiry] = useState('')
  const [cvv, setCvv] = useState('')

  const load = useCallback(async () => {
    const res = await fetch(`/api/customer/payment-methods?customer=${customerId}`)
    const data = await res.json()
    setCards(data.methods ?? [])
    setLoading(false)
  }, [customerId])

  useEffect(() => { load().catch(() => setLoading(false)) }, [load])

  async function handleAdd() {
    if (cardNumber.replace(/\s/g, '').length < 13 || !cardName || expiry.length !== 5 || cvv.length < 3) {
      toast.error('Preencha todos os dados do cartão.')
      return
    }

    setSaving(true)
    try {
      const res = await fetch('/api/customer/payment-methods', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId,
          creditCard: {
            holderName: cardName,
            number: cardNumber.replace(/\s/g, ''),
            expiryMonth: expiry.split('/')[0],
            expiryYear: `20${expiry.split('/')[1]}`,
            ccv: cvv,
          },
          setDefault: cards.length === 0,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Erro ao salvar cartão.')

      toast.success('Cartão salvo!')
      setShowForm(false)
      setCardNumber('')
      setCardName('')
      setExpiry('')
      setCvv('')
      await load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao salvar cartão.')
    } finally {
      setSaving(false)
    }
  }

  async function handleRemove(id: string) {
    try {
      await fetch(`/api/customer/payment-methods?customer=${customerId}&id=${id}`, { method: 'DELETE' })
      toast.success('Cartão removido.')
      await load()
    } catch {
      toast.error('Erro ao remover cartão.')
    }
  }

  const inputSt: React.CSSProperties = {
    background: '#0b1326', border: '1px solid #334155', color: '#dae2fd',
    outline: 'none', width: '100%', height: 40, borderRadius: 10, padding: '0 12px', fontSize: 14,
  }

  return (
    <section id="cards">
      <div className="flex items-center justify-between mb-3 px-1">
        <p className="text-[10px] font-mono uppercase tracking-widest" style={{ color: '#a78b7d' }}>Meus cartões</p>
        {!showForm && (
          <button type="button" onClick={() => setShowForm(true)}
            className="text-[10px] font-mono uppercase tracking-wider flex items-center gap-1"
            style={{ color: '#f97316' }}>
            <span className="material-symbols-outlined text-[14px]">add</span>
            Adicionar
          </button>
        )}
      </div>

      {loading ? (
        <div className="py-6 flex justify-center">
          <Loader2 className="h-5 w-5 animate-spin" style={{ color: '#f97316' }} />
        </div>
      ) : showForm ? (
        <div className="rounded-xl p-4 space-y-3" style={{ background: '#131b2e', border: '1px solid #334155' }}>
          <input type="text" inputMode="numeric" value={cardNumber} placeholder="Número do cartão"
            onChange={e => setCardNumber(maskCard(e.target.value))} style={inputSt} />
          <input type="text" value={cardName} placeholder="Nome do titular"
            onChange={e => setCardName(e.target.value.toUpperCase())} style={inputSt} />
          <div className="grid grid-cols-2 gap-2">
            <input type="text" inputMode="numeric" value={expiry} placeholder="MM/AA"
              onChange={e => setExpiry(maskExpiry(e.target.value))} maxLength={5} style={inputSt} />
            <input type="password" inputMode="numeric" value={cvv} placeholder="CVV"
              onChange={e => setCvv(e.target.value.replace(/\D/g, '').slice(0, 4))} style={inputSt} />
          </div>
          <p className="text-[10px] leading-relaxed" style={{ color: '#584237' }}>
            Seus dados são tokenizados pelo Asaas. O Qomanda não armazena número completo nem CVV.
          </p>
          <div className="flex gap-2">
            <button type="button" onClick={() => setShowForm(false)}
              className="flex-1 h-10 rounded-lg text-xs font-mono"
              style={{ border: '1px solid #584237', color: '#a78b7d' }}>
              Cancelar
            </button>
            <button type="button" onClick={handleAdd} disabled={saving}
              className="flex-[2] h-10 rounded-lg text-xs font-mono font-bold flex items-center justify-center gap-2"
              style={{ background: '#f97316', color: '#582200' }}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Salvar cartão'}
            </button>
          </div>
        </div>
      ) : cards.length === 0 ? (
        <div className="rounded-xl p-5 text-center" style={{ background: '#131b2e', border: '1px solid #334155' }}>
          <span className="material-symbols-outlined text-[32px] block mb-2" style={{ color: '#584237' }}>credit_card</span>
          <p className="text-sm" style={{ color: '#a78b7d' }}>Nenhum cartão salvo. Adicione um para pagar mais rápido no checkout.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {cards.map(card => (
            <div key={card.id} className="rounded-xl p-4 flex items-center gap-3"
              style={{ background: '#131b2e', border: '1px solid #334155' }}>
              <span className="material-symbols-outlined text-[22px]" style={{ color: '#f97316' }}>credit_card</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold">{formatCardBrand(card.brand)} •••• {card.lastFour}</p>
                <p className="text-xs truncate" style={{ color: '#a78b7d' }}>{card.holderName ?? 'Titular'}</p>
              </div>
              <button type="button" onClick={() => handleRemove(card.id)}
                className="p-2 rounded-full" style={{ color: '#584237' }} aria-label="Remover cartão">
                <span className="material-symbols-outlined text-[18px]">delete</span>
              </button>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
