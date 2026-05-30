'use client'

import { useEffect, useState } from 'react'
import { useParams, useSearchParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { loadStripe } from '@stripe/stripe-js'
import type { PaymentMethod, CloseRequestParticipant } from '@/types'
import { formatCurrency, generateConfirmationCode } from '@/lib/utils'
import { mockOrders } from '@/lib/dev-mock'
import { CustomerBottomNav } from '@/components/customer/bottom-nav'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!)

type Step     = 'mode' | 'pix' | 'card' | 'confirmed'
type CloseMode = 'individual' | 'table'

// ── Helpers ──────────────────────────────────────────────────
function maskCard(v: string) {
  const d = v.replace(/\D/g, '').slice(0, 16)
  return d.replace(/(.{4})/g, '$1 ').trim()
}
function maskExpiry(v: string) {
  const d = v.replace(/\D/g, '').slice(0, 4)
  return d.length > 2 ? `${d.slice(0, 2)}/${d.slice(2)}` : d
}

// ── PIX Screen ───────────────────────────────────────────────
function PixScreen({
  suggestedAmount, onConfirm, onBack, loading,
}: {
  suggestedAmount: number
  onConfirm: (amount: number) => void
  onBack: () => void
  loading: boolean
}) {
  const PIX_KEY = 'qomanda@pagamentos.com.br'
  const [amount, setAmount]   = useState(suggestedAmount.toFixed(2))
  const [copied, setCopied]   = useState(false)
  const [seconds, setSeconds] = useState(5 * 60)

  useEffect(() => {
    const t = setInterval(() => setSeconds(s => Math.max(0, s - 1)), 1000)
    return () => clearInterval(t)
  }, [])

  const mm = String(Math.floor(seconds / 60)).padStart(2, '0')
  const ss = String(seconds % 60).padStart(2, '0')
  const expired    = seconds === 0
  const parsedAmt  = parseFloat(amount.replace(',', '.')) || 0
  const extraAmt   = parsedAmt - suggestedAmount

  function copy() {
    navigator.clipboard.writeText(PIX_KEY).then(() => {
      setCopied(true); setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="p-2 -ml-2 rounded-full" style={{ color: '#ffb690' }}>
          <span className="material-symbols-outlined">arrow_back</span>
        </button>
        <h2 className="text-lg font-semibold" style={{ fontFamily: 'Geist, sans-serif' }}>Pague via PIX</h2>
      </div>

      {/* QR Code */}
      <div className="flex flex-col items-center gap-4 rounded-xl p-6"
        style={{ background: 'linear-gradient(135deg,#1e293b,#0f172a)', border: '1px solid #334155' }}>
        <div className="bg-white p-4 rounded-xl">
          <div className="w-44 h-44 flex items-center justify-center" style={{ background: '#f0f0f0' }}>
            <span className="material-symbols-outlined text-[80px]" style={{ color: '#334155', fontVariationSettings: "'FILL' 1" }}>qr_code_2</span>
          </div>
        </div>
        <p className="text-xs text-center max-w-[220px] leading-relaxed" style={{ color: '#e0c0b1' }}>
          Escaneie o QR Code ou copie a chave abaixo
        </p>
      </div>

      {/* Chave PIX */}
      <div className="flex items-center gap-2 rounded-xl px-4 py-3"
        style={{ background: '#1e293b', border: '1px solid #334155' }}>
        <span className="flex-1 text-sm font-mono truncate" style={{ color: '#dae2fd' }}>{PIX_KEY}</span>
        <button onClick={copy}
          className="flex items-center gap-1.5 text-xs font-mono px-3 py-1.5 rounded-lg shrink-0"
          style={{
            background: copied ? 'rgba(52,211,153,0.15)' : 'rgba(249,115,22,0.12)',
            color: copied ? '#34d399' : '#f97316',
            border: `1px solid ${copied ? 'rgba(52,211,153,0.3)' : 'rgba(249,115,22,0.2)'}`,
          }}>
          <span className="material-symbols-outlined text-[14px]">{copied ? 'check' : 'content_copy'}</span>
          {copied ? 'Copiado!' : 'Copiar'}
        </button>
      </div>

      {/* Custom amount */}
      <div className="rounded-xl p-4 space-y-3" style={{ background: '#1e293b', border: '1px solid #334155' }}>
        <div className="flex justify-between items-center">
          <span className="text-xs font-mono uppercase tracking-wider" style={{ color: '#a78b7d' }}>Valor a pagar</span>
          <span className="text-xs font-mono" style={{ color: '#584237' }}>
            Sugerido: {formatCurrency(suggestedAmount)}
          </span>
        </div>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-semibold" style={{ color: '#a78b7d' }}>R$</span>
          <input
            type="number" step="0.01" min={suggestedAmount.toFixed(2)}
            value={amount}
            onChange={e => setAmount(e.target.value)}
            className="w-full h-12 pl-9 pr-3 rounded-lg text-base font-bold font-mono outline-none"
            style={{ background: '#0b1326', border: `1px solid ${parsedAmt >= suggestedAmount ? '#f97316' : '#f87171'}`, color: '#dae2fd' }}
          />
        </div>
        {extraAmt > 0.01 && (
          <div className="flex items-start gap-2 text-xs rounded-lg px-3 py-2"
            style={{ background: 'rgba(52,211,153,0.08)', color: '#34d399' }}>
            <span className="material-symbols-outlined text-[14px] shrink-0 mt-0.5">volunteer_activism</span>
            <span>Você está contribuindo <strong>{formatCurrency(extraAmt)}</strong> a mais. O saldo da mesa diminui automaticamente para os outros. Obrigado! 🙌</span>
          </div>
        )}
      </div>

      {/* Countdown */}
      <div className="flex items-center justify-between rounded-xl px-4 py-3"
        style={{
          background: expired ? 'rgba(248,113,113,0.1)' : 'rgba(249,115,22,0.08)',
          border: `1px solid ${expired ? 'rgba(248,113,113,0.25)' : 'rgba(249,115,22,0.2)'}`,
        }}>
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-[18px]" style={{ color: expired ? '#f87171' : '#f97316' }}>
            {expired ? 'timer_off' : 'timer'}
          </span>
          <span className="text-xs font-mono" style={{ color: expired ? '#f87171' : '#e0c0b1' }}>
            {expired ? 'QR Code expirado' : 'Expira em'}
          </span>
        </div>
        {!expired && (
          <span className="text-lg font-black font-mono" style={{ color: seconds < 60 ? '#f87171' : '#f97316' }}>
            {mm}:{ss}
          </span>
        )}
      </div>

      <button onClick={() => onConfirm(parsedAmt)} disabled={loading || expired || parsedAmt < suggestedAmount}
        className="w-full h-14 rounded-full font-semibold flex items-center justify-center gap-2 active:scale-95 transition-all disabled:opacity-40"
        style={{ background: '#f97316', color: '#582200', boxShadow: '0 8px 30px rgba(249,115,22,0.25)', fontFamily: 'Geist, sans-serif' }}>
        {loading ? <><Loader2 className="h-5 w-5 animate-spin" /> Processando...</> : (
          <><span className="material-symbols-outlined">check_circle</span> Já realizei o pagamento</>
        )}
      </button>
    </div>
  )
}

// ── Card Screen ──────────────────────────────────────────────
function CardScreen({
  method, suggestedAmount, onConfirm, onBack, loading,
}: {
  method: 'debit' | 'credit'
  suggestedAmount: number
  onConfirm: (amount: number) => void
  onBack: () => void
  loading: boolean
}) {
  const [cardNumber, setCardNumber] = useState('')
  const [cardName, setCardName]     = useState('')
  const [expiry, setExpiry]         = useState('')
  const [cvv, setCvv]               = useState('')
  const [showCvv, setShowCvv]       = useState(false)
  const [installments, setInstallments] = useState(1)
  const [amount, setAmount]         = useState(suggestedAmount.toFixed(2))

  const isCredit   = method === 'credit'
  const parsedAmt  = parseFloat(amount.replace(',', '.')) || 0
  const extraAmt   = parsedAmt - suggestedAmount
  const formValid  = cardNumber.replace(/\s/g, '').length === 16 && cardName.trim() && expiry.length === 5 && cvv.length >= 3 && parsedAmt >= suggestedAmount
  const brand      = cardNumber.startsWith('4') ? 'Visa' : cardNumber.startsWith('5') ? 'Master' : null

  const inputSt: React.CSSProperties = {
    background: '#0b1326', border: '1px solid #334155', color: '#dae2fd',
    outline: 'none', width: '100%', height: 44, borderRadius: 12, padding: '0 12px', fontSize: 14,
    fontFamily: 'Geist, sans-serif',
  }
  function onFocus(e: React.FocusEvent<HTMLInputElement | HTMLSelectElement>) { e.target.style.borderColor = '#f97316' }
  function onBlur (e: React.FocusEvent<HTMLInputElement | HTMLSelectElement>) { e.target.style.borderColor = '#334155' }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="p-2 -ml-2 rounded-full" style={{ color: '#ffb690' }}>
          <span className="material-symbols-outlined">arrow_back</span>
        </button>
        <h2 className="text-lg font-semibold" style={{ fontFamily: 'Geist, sans-serif' }}>
          {isCredit ? 'Cartão de Crédito' : 'Cartão de Débito'}
        </h2>
      </div>

      {/* Card preview */}
      <div className="rounded-xl p-5 h-36 flex flex-col justify-between relative overflow-hidden"
        style={{ background: 'linear-gradient(135deg,#1e3a5f,#0f2027)', border: '1px solid #334155' }}>
        <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(circle at 80% 20%,#7bd0ff,transparent 60%)' }} />
        <div className="flex justify-between items-start">
          <span className="text-xs font-mono uppercase tracking-widest" style={{ color: 'rgba(218,226,253,0.5)' }}>
            {isCredit ? 'Crédito' : 'Débito'}
          </span>
          {brand && <span className="text-xs font-bold" style={{ color: 'rgba(218,226,253,0.6)' }}>{brand}</span>}
        </div>
        <div>
          <p className="text-lg font-mono tracking-widest" style={{ color: cardNumber ? '#dae2fd' : 'rgba(218,226,253,0.2)' }}>
            {cardNumber || '•••• •••• •••• ••••'}
          </p>
          <div className="flex justify-between mt-1">
            <p className="text-xs font-mono uppercase" style={{ color: cardName ? '#dae2fd' : 'rgba(218,226,253,0.2)' }}>
              {cardName || 'NOME DO TITULAR'}
            </p>
            <p className="text-xs font-mono" style={{ color: expiry ? '#dae2fd' : 'rgba(218,226,253,0.2)' }}>
              {expiry || 'MM/AA'}
            </p>
          </div>
        </div>
      </div>

      {/* Fields */}
      <div className="space-y-3">
        <div className="flex flex-col gap-1">
          <label className="text-[10px] font-mono uppercase tracking-wider" style={{ color: '#a78b7d' }}>Número do Cartão</label>
          <input type="text" inputMode="numeric" value={cardNumber}
            onChange={e => setCardNumber(maskCard(e.target.value))} placeholder="0000 0000 0000 0000"
            maxLength={19} style={inputSt} onFocus={onFocus} onBlur={onBlur} />
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
              onChange={e => setExpiry(maskExpiry(e.target.value))} placeholder="MM/AA"
              maxLength={5} style={inputSt} onFocus={onFocus} onBlur={onBlur} />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-mono uppercase tracking-wider" style={{ color: '#a78b7d' }}>CVV</label>
            <div className="relative">
              <input type={showCvv ? 'text' : 'password'} inputMode="numeric" value={cvv}
                onChange={e => setCvv(e.target.value.replace(/\D/g, '').slice(0, 4))}
                placeholder="•••" style={{ ...inputSt, paddingRight: 40 }}
                onFocus={onFocus} onBlur={onBlur} />
              <button type="button" onClick={() => setShowCvv(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2" style={{ color: '#584237' }}>
                <span className="material-symbols-outlined text-[18px]">{showCvv ? 'visibility_off' : 'visibility'}</span>
              </button>
            </div>
          </div>
        </div>
        {isCredit && (
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-mono uppercase tracking-wider" style={{ color: '#a78b7d' }}>Parcelas</label>
            <select value={installments} onChange={e => setInstallments(Number(e.target.value))}
              style={{ ...inputSt, appearance: 'none' } as React.CSSProperties}
              onFocus={onFocus} onBlur={onBlur}>
              {[1,2,3,6,12].map(n => (
                <option key={n} value={n}>{n}x de {formatCurrency(parsedAmt / n)}{n === 1 ? ' (sem juros)' : ''}</option>
              ))}
            </select>
          </div>
        )}

        {/* Custom amount */}
        <div className="rounded-xl p-4 space-y-2" style={{ background: '#1e293b', border: '1px solid #334155' }}>
          <div className="flex justify-between">
            <label className="text-[10px] font-mono uppercase tracking-wider" style={{ color: '#a78b7d' }}>Valor a pagar</label>
            <span className="text-[10px] font-mono" style={{ color: '#584237' }}>Sugerido: {formatCurrency(suggestedAmount)}</span>
          </div>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-semibold" style={{ color: '#a78b7d' }}>R$</span>
            <input type="number" step="0.01" min={suggestedAmount.toFixed(2)} value={amount}
              onChange={e => setAmount(e.target.value)}
              className="w-full h-11 pl-9 pr-3 rounded-lg text-base font-bold font-mono outline-none"
              style={{ background: '#0b1326', border: `1px solid ${parsedAmt >= suggestedAmount ? '#f97316' : '#f87171'}`, color: '#dae2fd' }} />
          </div>
          {extraAmt > 0.01 && (
            <p className="text-xs" style={{ color: '#34d399' }}>
              +{formatCurrency(extraAmt)} de contribuição extra — obrigado! 🙌
            </p>
          )}
        </div>
      </div>

      <div className="flex items-center justify-center gap-2">
        <span className="material-symbols-outlined text-[14px]" style={{ color: '#584237' }}>lock</span>
        <span className="text-[10px] font-mono" style={{ color: '#584237' }}>Integração Stripe em breve</span>
      </div>

      <button onClick={() => onConfirm(parsedAmt)} disabled={loading || !formValid}
        className="w-full h-14 rounded-full font-semibold flex items-center justify-center gap-2 active:scale-95 transition-all disabled:opacity-40"
        style={{ background: '#f97316', color: '#582200', boxShadow: '0 8px 30px rgba(249,115,22,0.25)', fontFamily: 'Geist, sans-serif' }}>
        {loading ? <><Loader2 className="h-5 w-5 animate-spin" /> Processando...</> : (
          <><span className="material-symbols-outlined">lock</span> Confirmar Pagamento</>
        )}
      </button>
    </div>
  )
}

// ── Main Page ────────────────────────────────────────────────
export default function CheckoutPage() {
  const params      = useParams<{ slug: string }>()
  const searchParams = useSearchParams()
  const router      = useRouter()
  const sessionId   = searchParams.get('session')
  // If coming from a close_request notification
  const requestId   = searchParams.get('request')

  const myCustomerId = typeof window !== 'undefined'
    ? localStorage.getItem('qomanda_customer_id') : null

  type Participant = { id: string; name: string; total: number; isMe: boolean }

  const [step, setStep]           = useState<Step>('mode')
  const [closeMode, setCloseMode] = useState<CloseMode>('individual')
  const [method, setMethod]       = useState<PaymentMethod>('pix')
  const [loading, setLoading]     = useState(true)
  const [paying, setPaying]       = useState(false)
  const [confirmationCode, setConfirmationCode] = useState('')
  const [tableNumber, setTableNumber] = useState('')
  const [grandTotal, setGrandTotal]   = useState(0)
  const [myTotal, setMyTotal]         = useState(0)
  const [orderItems, setOrderItems]   = useState<{ name: string; amount: number }[]>([])
  const [participants, setParticipants] = useState<Participant[]>([])
  const [selectedIds, setSelectedIds]   = useState<Set<string>>(new Set())
  const [amountToPay, setAmountToPay]   = useState(0)

  function toggleParticipant(id: string) {
    if (id === myCustomerId) return // initiator can't uncheck themselves
    setSelectedIds(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  useEffect(() => {
    if (!sessionId) { router.replace(`/${params.slug}`); return }

    if (params.slug === 'demo') {
      const items = mockOrders.flatMap(o => o.items ?? []).map(i => ({
        name: `${i.quantity}x ${i.menu_item?.name ?? 'Item'}`,
        amount: i.unit_price * i.quantity,
      }))
      setOrderItems(items)
      const t = items.reduce((s, i) => s + i.amount, 0)
      const gt = t * 1.1
      setGrandTotal(gt)
      const demo: Participant[] = [
        { id: 'c1', name: 'João Silva',   total: gt * 0.40, isMe: true  },
        { id: 'c2', name: 'Maria Santos', total: gt * 0.35, isMe: false },
        { id: 'c3', name: 'Pedro Costa',  total: gt * 0.25, isMe: false },
      ]
      setParticipants(demo)
      const my = demo.find(p => p.isMe)?.total ?? gt
      setMyTotal(my)
      setAmountToPay(my)
      setTableNumber('04')
      if (myCustomerId) setSelectedIds(new Set([myCustomerId ?? 'c1']))
      else setSelectedIds(new Set(['c1']))
      setLoading(false)
      return
    }

    async function load() {
      const supabase = createClient()

      const [sessionRes, participantsRes, ordersRes] = await Promise.all([
        supabase.from('sessions').select('*, table:tables(number)').eq('id', sessionId).single(),
        supabase.from('session_participants').select('customer_id, customer:customers(first_name,last_name)').eq('session_id', sessionId),
        supabase.from('orders').select('customer_id, items:order_items(unit_price,quantity)').eq('session_id', sessionId),
      ])

      if (!sessionRes.data) { router.replace(`/${params.slug}`); return }
      setTableNumber((sessionRes.data.table as any)?.number ?? '')

      const allItems = (ordersRes.data ?? []).flatMap((o: any) => o.items ?? [])
      const subTotal = allItems.reduce((s: number, i: any) => s + i.unit_price * i.quantity, 0)
      const gt = subTotal * 1.1
      setGrandTotal(gt)

      const oItems = allItems.map((i: any) => ({
        name: `Item`,
        amount: i.unit_price * i.quantity,
      }))
      setOrderItems(oItems)

      const parts: Participant[] = (participantsRes.data ?? []).map((p: any) => {
        const pOrders = (ordersRes.data ?? []).filter((o: any) => o.customer_id === p.customer_id)
        const pSub = pOrders.flatMap((o: any) => o.items ?? []).reduce((s: number, i: any) => s + i.unit_price * i.quantity, 0)
        const pTotal = pSub * 1.1
        return {
          id: p.customer_id,
          name: p.customer ? `${p.customer.first_name} ${p.customer.last_name}` : 'Cliente',
          total: pTotal,
          isMe: p.customer_id === myCustomerId,
        }
      })
      setParticipants(parts)

      const my = parts.find(p => p.isMe)?.total ?? (gt / Math.max(1, parts.length))
      setMyTotal(my)
      setAmountToPay(my)
      if (myCustomerId) setSelectedIds(new Set([myCustomerId]))
      else setSelectedIds(new Set(parts.map(p => p.id)))

      setLoading(false)
    }
    load()
  }, [sessionId, params.slug, router, myCustomerId])

  // When mode or selection changes, recalculate amountToPay
  useEffect(() => {
    if (closeMode === 'individual') {
      setAmountToPay(myTotal)
    } else {
      const sel = participants.filter(p => selectedIds.has(p.id))
      const selTotal = sel.reduce((s, p) => s + p.total, 0)
      setAmountToPay(selTotal > 0 ? selTotal : grandTotal / Math.max(1, selectedIds.size))
    }
  }, [closeMode, selectedIds, myTotal, grandTotal, participants])

  async function createCloseRequest() {
    if (params.slug === 'demo') return
    const supabase = createClient()
    const { data: req } = await supabase
      .from('close_requests')
      .insert({ session_id: sessionId, initiator_id: myCustomerId, mode: closeMode, status: 'pending' })
      .select().single()
    if (!req) return

    if (closeMode === 'table') {
      const participants_to_notify = [...selectedIds].filter(id => id !== myCustomerId)
      const selectedParts = participants.filter(p => selectedIds.has(p.id))
      const equalShare = amountToPay / selectedIds.size

      // Insert participant records
      await supabase.from('close_request_participants').insert(
        [...selectedIds].map(cid => ({
          request_id: req.id,
          customer_id: cid,
          amount_owed: selectedParts.find(p => p.id === cid)?.total || equalShare,
          status: cid === myCustomerId ? 'confirmed' : 'pending',
        }))
      )
    }
  }

  async function processPayment(paidAmount: number) {
    setPaying(true)

    if (params.slug === 'demo') {
      await new Promise(r => setTimeout(r, 1500))
      setConfirmationCode(generateConfirmationCode())
      setStep('confirmed')
      setPaying(false)
      return
    }

    try {
      const supabase = createClient()
      const res = await fetch('/api/payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: sessionId, amount: paidAmount, method }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Erro')

      if (method === 'pix' || method === 'debit') {
        const code = generateConfirmationCode()
        await supabase.from('payments').update({ status: 'paid', confirmation_code: code, paid_at: new Date().toISOString() }).eq('id', data.payment_id)
        setConfirmationCode(code)
        setStep('confirmed')
      } else {
        const stripe = await stripePromise
        if (!stripe || !data.client_secret) throw new Error('Stripe não inicializado')
        const { error } = await stripe.confirmCardPayment(data.client_secret)
        if (error) throw new Error(error.message)
        const code = generateConfirmationCode()
        await supabase.from('payments').update({ status: 'paid', confirmation_code: code, paid_at: new Date().toISOString() }).eq('id', data.payment_id)
        setConfirmationCode(code)
        setStep('confirmed')
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Erro ao processar pagamento')
    } finally {
      setPaying(false)
    }
  }

  async function handleProceedToPayment() {
    await createCloseRequest()
    if (method === 'pix') setStep('pix')
    else setStep('card')
  }

  const PAYMENT_METHODS = [
    { value: 'pix'    as PaymentMethod, icon: 'qr_code_2',       label: 'PIX'    },
    { value: 'debit'  as PaymentMethod, icon: 'credit_card',     label: 'Débito' },
    { value: 'credit' as PaymentMethod, icon: 'contactless',     label: 'Crédito'},
  ]

  const serviceLabel = '#0b1326'

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#0b1326' }}>
        <Loader2 className="h-8 w-8 animate-spin" style={{ color: '#f97316' }} />
      </div>
    )
  }

  // ── CONFIRMED ──────────────────────────────────────────────
  if (step === 'confirmed') {
    return (
      <div className="min-h-screen flex flex-col" style={{ background: '#0b1326', color: '#dae2fd' }}>
        <div className="pointer-events-none fixed top-1/4 left-1/2 -translate-x-1/2 w-80 h-80 rounded-full"
          style={{ background: 'rgba(52,211,153,0.08)', filter: 'blur(80px)' }} />
        <header className="sticky top-0 z-40 flex justify-center items-center px-6 h-16"
          style={{ background: 'rgba(11,19,38,0.9)', borderBottom: '1px solid rgba(88,66,55,0.3)', backdropFilter: 'blur(12px)' }}>
          <h1 className="text-base font-semibold" style={{ color: '#ffb690', fontFamily: 'Geist, sans-serif' }}>Pagamento</h1>
        </header>
        <main className="flex-1 flex flex-col items-center px-6 py-8 pb-28 gap-6">
          <div className="flex flex-col items-center text-center">
            <div className="w-20 h-20 rounded-full flex items-center justify-center mb-4"
              style={{ background: 'rgba(52,211,153,0.1)', filter: 'drop-shadow(0 0 20px rgba(52,211,153,0.2))' }}>
              <span className="material-symbols-outlined text-[52px]"
                style={{ color: '#34d399', fontVariationSettings: "'FILL' 1" }}>check_circle</span>
            </div>
            <h2 className="text-[28px] font-black" style={{ fontFamily: 'Geist, sans-serif' }}>Obrigado!</h2>
            <p className="text-sm mt-1" style={{ color: '#e0c0b1' }}>Pagamento processado com sucesso.</p>
          </div>
          <div className="w-full rounded-xl p-5 flex justify-between items-center"
            style={{ background: '#171f33', border: '1px solid #334155' }}>
            <div>
              <p className="text-[10px] font-mono uppercase tracking-widest mb-1" style={{ color: '#a78b7d' }}>Mesa</p>
              <p className="text-xl font-bold" style={{ fontFamily: 'Geist, sans-serif' }}>Mesa {tableNumber}</p>
            </div>
            <div className="w-px h-10" style={{ background: '#584237' }} />
            <div className="text-right">
              <p className="text-[10px] font-mono uppercase tracking-widest mb-1" style={{ color: '#a78b7d' }}>Você pagou</p>
              <p className="text-xl font-black" style={{ color: '#f97316', fontFamily: 'Geist, sans-serif' }}>
                {formatCurrency(amountToPay)}
              </p>
            </div>
          </div>
          <div className="w-full rounded-xl p-6 flex flex-col items-center gap-4"
            style={{ background: 'linear-gradient(135deg,#1e293b,#0f172a)', border: '1px solid #334155' }}>
            <p className="text-[10px] font-mono uppercase tracking-widest" style={{ color: '#a78b7d' }}>Código de validação</p>
            <div className="bg-white rounded-xl px-8 py-5">
              <p className="text-4xl font-black tracking-widest" style={{ color: '#0b1326' }}>{confirmationCode}</p>
            </div>
            <p className="text-xs text-center max-w-[220px] leading-relaxed" style={{ color: '#e0c0b1' }}>
              Apresente este código ao garçom para liberar a saída
            </p>
          </div>
          {closeMode === 'table' && selectedIds.size > 1 && (
            <div className="w-full rounded-xl p-4 flex items-start gap-3"
              style={{ background: 'rgba(123,208,255,0.08)', border: '1px solid rgba(123,208,255,0.15)' }}>
              <span className="material-symbols-outlined text-[18px] shrink-0 mt-0.5" style={{ color: '#7bd0ff' }}>notifications</span>
              <p className="text-xs leading-relaxed" style={{ color: '#7bd0ff' }}>
                Os outros participantes foram notificados para confirmar e pagar a parte deles.
              </p>
            </div>
          )}
          <p className="text-base font-semibold" style={{ color: '#e0c0b1' }}>Volte sempre!</p>
        </main>
        <CustomerBottomNav slug={params.slug} sessionId={sessionId ?? ''} />
      </div>
    )
  }

  // ── PIX SCREEN ─────────────────────────────────────────────
  if (step === 'pix') {
    return (
      <div className="min-h-screen flex flex-col" style={{ background: '#0b1326', color: '#dae2fd' }}>
        <header className="sticky top-0 z-40 flex items-center px-6 h-16"
          style={{ background: 'rgba(11,19,38,0.9)', borderBottom: '1px solid rgba(88,66,55,0.3)', backdropFilter: 'blur(12px)' }}>
          <h1 className="text-base font-semibold" style={{ fontFamily: 'Geist, sans-serif' }}>Pagamento · PIX</h1>
        </header>
        <main className="flex-1 px-6 py-6 pb-28 relative z-10">
          <PixScreen suggestedAmount={amountToPay} onConfirm={processPayment} onBack={() => setStep('mode')} loading={paying} />
        </main>
        <CustomerBottomNav slug={params.slug} sessionId={sessionId ?? ''} />
      </div>
    )
  }

  // ── CARD SCREEN ────────────────────────────────────────────
  if (step === 'card') {
    return (
      <div className="min-h-screen flex flex-col" style={{ background: '#0b1326', color: '#dae2fd' }}>
        <header className="sticky top-0 z-40 flex items-center px-6 h-16"
          style={{ background: 'rgba(11,19,38,0.9)', borderBottom: '1px solid rgba(88,66,55,0.3)', backdropFilter: 'blur(12px)' }}>
          <h1 className="text-base font-semibold" style={{ fontFamily: 'Geist, sans-serif' }}>
            Pagamento · {method === 'credit' ? 'Crédito' : 'Débito'}
          </h1>
        </header>
        <main className="flex-1 px-6 py-6 pb-28 relative z-10">
          <CardScreen method={method as 'debit' | 'credit'} suggestedAmount={amountToPay}
            onConfirm={processPayment} onBack={() => setStep('mode')} loading={paying} />
        </main>
        <CustomerBottomNav slug={params.slug} sessionId={sessionId ?? ''} />
      </div>
    )
  }

  // ── MODE / SUMMARY ─────────────────────────────────────────
  return (
    <div className="min-h-screen flex flex-col" style={{ background: '#0b1326', color: '#dae2fd' }}>
      <div className="pointer-events-none fixed top-1/4 right-0 w-64 h-64 rounded-full"
        style={{ background: 'rgba(123,208,255,0.04)', filter: 'blur(80px)' }} />
      <header className="sticky top-0 z-40 flex items-center px-6 h-16"
        style={{ background: 'rgba(11,19,38,0.9)', borderBottom: '1px solid rgba(88,66,55,0.3)', backdropFilter: 'blur(12px)' }}>
        <button onClick={() => router.back()} className="p-2 -ml-2 mr-3 rounded-full" style={{ color: '#ffb690' }}>
          <span className="material-symbols-outlined">arrow_back</span>
        </button>
        <h1 className="text-base font-semibold" style={{ fontFamily: 'Geist, sans-serif' }}>Fechar Conta</h1>
      </header>

      <main className="flex-1 px-6 py-6 pb-32 space-y-5 relative z-10">

        {/* ── Modo de fechamento ──────────────────────────── */}
        <section className="space-y-3">
          <p className="text-[10px] font-mono uppercase tracking-widest" style={{ color: '#a78b7d' }}>
            Como você quer pagar?
          </p>
          <div className="grid grid-cols-2 gap-3">
            {([
              { mode: 'individual' as CloseMode, icon: 'person', title: 'Só a minha parte', desc: 'Pago apenas meu consumo' },
              { mode: 'table'      as CloseMode, icon: 'groups', title: 'Fechar mesa toda', desc: 'Inicia fechamento para todos' },
            ]).map(opt => (
              <button key={opt.mode} onClick={() => setCloseMode(opt.mode)}
                className="flex flex-col items-start gap-2 p-4 rounded-xl text-left transition-all active:scale-95"
                style={{
                  background: closeMode === opt.mode ? 'rgba(249,115,22,0.12)' : 'rgba(30,41,59,0.7)',
                  border: `2px solid ${closeMode === opt.mode ? '#f97316' : '#334155'}`,
                  backdropFilter: 'blur(12px)',
                }}>
                <span className="material-symbols-outlined text-[24px]"
                  style={{ color: closeMode === opt.mode ? '#f97316' : '#a78b7d', fontVariationSettings: closeMode === opt.mode ? "'FILL' 1" : "'FILL' 0" }}>
                  {opt.icon}
                </span>
                <div>
                  <p className="text-sm font-bold" style={{ color: closeMode === opt.mode ? '#ffb690' : '#dae2fd', fontFamily: 'Geist, sans-serif' }}>
                    {opt.title}
                  </p>
                  <p className="text-[11px] mt-0.5" style={{ color: '#a78b7d' }}>{opt.desc}</p>
                </div>
              </button>
            ))}
          </div>
        </section>

        {/* ── Resumo do pedido ────────────────────────────── */}
        {closeMode === 'individual' && (
          <section className="space-y-3">
            <p className="text-[10px] font-mono uppercase tracking-widest" style={{ color: '#a78b7d' }}>Meu consumo</p>
            <div className="rounded-xl p-4 space-y-2.5"
              style={{ background: 'rgba(30,41,59,0.7)', border: '1px solid #334155', backdropFilter: 'blur(12px)' }}>
              {orderItems.slice(0, 5).map((item, i) => (
                <div key={i} className="flex justify-between text-sm" style={{ color: '#e0c0b1' }}>
                  <span>{item.name}</span>
                  <span className="font-mono">{formatCurrency(item.amount)}</span>
                </div>
              ))}
              <div className="pt-2" style={{ borderTop: '1px solid rgba(88,66,55,0.3)' }}>
                <div className="flex justify-between items-end">
                  <span className="text-xs font-mono uppercase tracking-widest" style={{ color: '#7bd0ff' }}>Meu total (c/ taxa)</span>
                  <span className="text-3xl font-black" style={{ color: '#f97316', fontFamily: 'Geist, sans-serif' }}>
                    {formatCurrency(myTotal)}
                  </span>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* ── Participantes (modo Mesa Toda) ──────────────── */}
        {closeMode === 'table' && participants.length > 0 && (
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-mono uppercase tracking-widest" style={{ color: '#a78b7d' }}>
                Quem vai dividir a conta?
              </p>
              <p className="text-[10px] font-mono" style={{ color: '#584237' }}>
                Você está bloqueado como iniciador
              </p>
            </div>
            <div className="rounded-xl overflow-hidden" style={{ border: '1px solid #334155' }}>
              {participants.map((p, i) => {
                const isSelected = selectedIds.has(p.id)
                const locked     = p.isMe
                return (
                  <button key={p.id} onClick={() => toggleParticipant(p.id)}
                    className="w-full flex items-center gap-4 px-4 py-3.5 transition-all text-left"
                    style={{
                      background: isSelected ? 'rgba(249,115,22,0.08)' : 'rgba(30,41,59,0.7)',
                      borderTop: i > 0 ? '1px solid rgba(51,65,85,0.5)' : 'none',
                      cursor: locked ? 'not-allowed' : 'pointer',
                    }}>
                    {/* Checkbox */}
                    <div className="w-5 h-5 rounded flex items-center justify-center shrink-0 relative"
                      style={{
                        background: isSelected ? '#f97316' : 'transparent',
                        border: `2px solid ${isSelected ? '#f97316' : '#584237'}`,
                      }}>
                      {isSelected && (
                        <span className="material-symbols-outlined text-[13px]"
                          style={{ color: '#582200', fontVariationSettings: "'FILL' 1" }}>check</span>
                      )}
                      {locked && (
                        <span className="absolute -top-1.5 -right-1.5 material-symbols-outlined text-[10px]"
                          style={{ color: '#f97316' }}>lock</span>
                      )}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-semibold" style={{ color: '#dae2fd' }}>
                        {p.name}
                        {p.isMe && <span className="text-[10px] font-mono ml-2" style={{ color: '#34d399' }}>(você · iniciador)</span>}
                      </p>
                      {p.total > 0 && (
                        <p className="text-xs font-mono" style={{ color: '#a78b7d' }}>
                          Consumiu {formatCurrency(p.total)}
                        </p>
                      )}
                    </div>
                    <span className="text-sm font-bold font-mono shrink-0"
                      style={{ color: isSelected ? '#f97316' : '#584237' }}>
                      {p.total > 0 ? formatCurrency(p.total) : '—'}
                    </span>
                  </button>
                )
              })}
            </div>
            <div className="flex justify-between items-center rounded-xl px-4 py-3"
              style={{ background: 'rgba(249,115,22,0.08)', border: '1px solid rgba(249,115,22,0.2)' }}>
              <p className="text-sm font-semibold" style={{ color: '#ffb690' }}>Total selecionado</p>
              <p className="text-2xl font-black" style={{ color: '#f97316', fontFamily: 'Geist, sans-serif' }}>
                {formatCurrency(amountToPay)}
              </p>
            </div>
            {selectedIds.size > 1 && (
              <div className="flex items-start gap-2 text-xs rounded-xl px-4 py-3"
                style={{ background: 'rgba(123,208,255,0.08)', border: '1px solid rgba(123,208,255,0.15)', color: '#7bd0ff' }}>
                <span className="material-symbols-outlined text-[15px] shrink-0 mt-0.5">notifications</span>
                <span>
                  {participants.filter(p => selectedIds.has(p.id) && !p.isMe).map(p => p.name.split(' ')[0]).join(', ')} receberão
                  uma notificação para confirmar e pagar a parte deles.
                </span>
              </div>
            )}
          </section>
        )}

        {/* ── Método de pagamento ─────────────────────────── */}
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[18px]" style={{ color: '#7bd0ff' }}>payments</span>
            <p className="text-[10px] font-mono uppercase tracking-widest" style={{ color: '#a78b7d' }}>Forma de Pagamento</p>
          </div>
          <div className="grid grid-cols-3 gap-3">
            {PAYMENT_METHODS.map(m => (
              <button key={m.value} onClick={() => setMethod(m.value)}
                className="flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all active:scale-95"
                style={{
                  background: method === m.value ? 'rgba(249,115,22,0.1)' : 'rgba(30,41,59,0.7)',
                  borderColor: method === m.value ? '#f97316' : '#334155',
                  backdropFilter: 'blur(12px)',
                }}>
                <span className="material-symbols-outlined text-[22px]"
                  style={{ color: method === m.value ? '#f97316' : '#e0c0b1' }}>{m.icon}</span>
                <span className="text-xs font-mono" style={{ color: method === m.value ? '#f97316' : '#e0c0b1' }}>{m.label}</span>
              </button>
            ))}
          </div>
        </section>
      </main>

      {/* CTA */}
      <div className="fixed bottom-20 left-0 right-0 px-6 py-3 z-40"
        style={{ background: 'rgba(11,19,38,0.9)', backdropFilter: 'blur(12px)', borderTop: '1px solid rgba(88,66,55,0.2)' }}>
        <button onClick={handleProceedToPayment}
          className="w-full h-14 rounded-full font-semibold flex items-center justify-center gap-2 active:scale-95 transition-all"
          style={{ background: '#f97316', color: '#582200', boxShadow: '0 8px 30px rgba(249,115,22,0.3)', fontFamily: 'Geist, sans-serif' }}>
          Confirmar e Ir para Pagamento
          <span className="material-symbols-outlined">arrow_forward</span>
        </button>
      </div>

      <CustomerBottomNav slug={params.slug} sessionId={sessionId ?? ''} />
    </div>
  )
}
