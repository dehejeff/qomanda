'use client'

import { useEffect, useState, useRef } from 'react'
import { useParams, useSearchParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { loadStripe } from '@stripe/stripe-js'
import type { PaymentMethod } from '@/types'
import { formatCurrency, generateConfirmationCode } from '@/lib/utils'
import { mockOrders } from '@/lib/dev-mock'
import { CustomerBottomNav } from '@/components/customer/bottom-nav'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!)

type Step = 'summary' | 'pix' | 'card' | 'confirmed'

// ── Helpers ────────────────────────────────────────────────
function maskCard(v: string) {
  const d = v.replace(/\D/g, '').slice(0, 16)
  return d.replace(/(.{4})/g, '$1 ').trim()
}
function maskExpiry(v: string) {
  const d = v.replace(/\D/g, '').slice(0, 4)
  return d.length > 2 ? `${d.slice(0, 2)}/${d.slice(2)}` : d
}

// ── PIX Screen ─────────────────────────────────────────────
function PixScreen({
  amount,
  onConfirm,
  onBack,
  loading,
}: {
  amount: number
  onConfirm: () => void
  onBack: () => void
  loading: boolean
}) {
  const PIX_KEY = 'qomanda@pagamentos.com.br'
  const [copied, setCopied] = useState(false)
  const [seconds, setSeconds] = useState(5 * 60)

  useEffect(() => {
    const t = setInterval(() => setSeconds(s => Math.max(0, s - 1)), 1000)
    return () => clearInterval(t)
  }, [])

  const mm = String(Math.floor(seconds / 60)).padStart(2, '0')
  const ss = String(seconds % 60).padStart(2, '0')
  const expired = seconds === 0

  function copy() {
    navigator.clipboard.writeText(PIX_KEY).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Back + title */}
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="p-2 -ml-2 rounded-full" style={{ color: '#ffb690' }}>
          <span className="material-symbols-outlined">arrow_back</span>
        </button>
        <h2 className="text-lg font-semibold" style={{ fontFamily: 'Geist, sans-serif' }}>Pague via PIX</h2>
      </div>

      {/* Amount */}
      <div className="rounded-xl p-4 flex justify-between items-center" style={{ background: '#1e293b', border: '1px solid #334155' }}>
        <span className="text-sm" style={{ color: '#a78b7d' }}>Valor a pagar</span>
        <span className="text-2xl font-black" style={{ color: '#f97316', fontFamily: 'Geist, sans-serif' }}>
          {formatCurrency(amount)}
        </span>
      </div>

      {/* QR Code */}
      <div className="flex flex-col items-center gap-4 rounded-xl p-6" style={{ background: 'linear-gradient(135deg, #1e293b, #0f172a)', border: '1px solid #334155' }}>
        <div className="bg-white p-4 rounded-xl">
          {/* Placeholder QR — será gerado pelo Stripe na integração */}
          <div className="w-44 h-44 flex items-center justify-center" style={{ background: '#f0f0f0' }}>
            <span className="material-symbols-outlined text-[80px]" style={{ color: '#334155', fontVariationSettings: "'FILL' 1" }}>
              qr_code_2
            </span>
          </div>
        </div>
        <p className="text-xs text-center max-w-[220px] leading-relaxed" style={{ color: '#e0c0b1' }}>
          Escaneie o QR Code com o app do seu banco ou copie a chave abaixo
        </p>
      </div>

      {/* PIX key copy */}
      <div>
        <p className="text-[10px] font-mono uppercase tracking-widest mb-2" style={{ color: '#a78b7d' }}>Chave PIX</p>
        <div className="flex items-center gap-2 rounded-xl px-4 py-3" style={{ background: '#1e293b', border: '1px solid #334155' }}>
          <span className="flex-1 text-sm font-mono truncate" style={{ color: '#dae2fd' }}>{PIX_KEY}</span>
          <button
            onClick={copy}
            className="flex items-center gap-1.5 text-xs font-mono px-3 py-1.5 rounded-lg transition-all active:scale-95 shrink-0"
            style={{
              background: copied ? 'rgba(52,211,153,0.15)' : 'rgba(249,115,22,0.12)',
              color: copied ? '#34d399' : '#f97316',
              border: `1px solid ${copied ? 'rgba(52,211,153,0.3)' : 'rgba(249,115,22,0.2)'}`,
            }}
          >
            <span className="material-symbols-outlined text-[14px]">{copied ? 'check' : 'content_copy'}</span>
            {copied ? 'Copiado!' : 'Copiar'}
          </button>
        </div>
      </div>

      {/* Countdown */}
      <div
        className="flex items-center justify-between rounded-xl px-4 py-3"
        style={{
          background: expired ? 'rgba(248,113,113,0.1)' : 'rgba(249,115,22,0.08)',
          border: `1px solid ${expired ? 'rgba(248,113,113,0.25)' : 'rgba(249,115,22,0.2)'}`,
        }}
      >
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

      {/* Confirm button (simulated — Stripe fará a verificação real) */}
      <button
        onClick={onConfirm}
        disabled={loading || expired}
        className="w-full h-14 rounded-full font-semibold flex items-center justify-center gap-2 active:scale-95 transition-all disabled:opacity-40"
        style={{ background: '#f97316', color: '#582200', boxShadow: '0 8px 30px rgba(249,115,22,0.25)', fontFamily: 'Geist, sans-serif' }}
      >
        {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : (
          <><span className="material-symbols-outlined">check_circle</span> Já realizei o pagamento</>
        )}
      </button>

      <p className="text-center text-[10px] font-mono" style={{ color: '#584237' }}>
        A confirmação automática será ativada na integração com o Stripe
      </p>
    </div>
  )
}

// ── Card Screen ────────────────────────────────────────────
function CardScreen({
  method,
  amount,
  onConfirm,
  onBack,
  loading,
}: {
  method: 'debit' | 'credit'
  amount: number
  onConfirm: () => void
  onBack: () => void
  loading: boolean
}) {
  const [cardNumber, setCardNumber] = useState('')
  const [cardName, setCardName] = useState('')
  const [expiry, setExpiry] = useState('')
  const [cvv, setCvv] = useState('')
  const [showCvv, setShowCvv] = useState(false)
  const [installments, setInstallments] = useState(1)

  const isCredit = method === 'credit'
  const formValid = cardNumber.replace(/\s/g, '').length === 16 && cardName.trim() && expiry.length === 5 && cvv.length >= 3

  // Detect card brand by first digit
  const brand = cardNumber.startsWith('4') ? 'visa' : cardNumber.startsWith('5') ? 'mastercard' : cardNumber.startsWith('3') ? 'amex' : null
  const brandIcon = brand === 'visa' ? 'credit_card' : brand === 'mastercard' ? 'credit_card' : 'credit_card'

  const inputStyle = {
    background: '#0b1326',
    border: '1px solid #334155',
    color: '#dae2fd',
    outline: 'none',
  }

  function handleFocus(e: React.FocusEvent<HTMLInputElement>) {
    e.target.style.borderColor = '#f97316'
  }
  function handleBlur(e: React.FocusEvent<HTMLInputElement>) {
    e.target.style.borderColor = '#334155'
  }

  const installmentOptions = isCredit
    ? [1, 2, 3, 6, 12].map(n => ({ n, value: amount / n }))
    : []

  return (
    <div className="flex flex-col gap-5">
      {/* Back + title */}
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="p-2 -ml-2 rounded-full" style={{ color: '#ffb690' }}>
          <span className="material-symbols-outlined">arrow_back</span>
        </button>
        <h2 className="text-lg font-semibold" style={{ fontFamily: 'Geist, sans-serif' }}>
          {isCredit ? 'Cartão de Crédito' : 'Cartão de Débito'}
        </h2>
      </div>

      {/* Amount */}
      <div className="rounded-xl p-4 flex justify-between items-center" style={{ background: '#1e293b', border: '1px solid #334155' }}>
        <span className="text-sm" style={{ color: '#a78b7d' }}>Valor a pagar</span>
        <span className="text-2xl font-black" style={{ color: '#f97316', fontFamily: 'Geist, sans-serif' }}>
          {formatCurrency(amount)}
        </span>
      </div>

      {/* Card preview */}
      <div
        className="rounded-xl p-5 h-40 flex flex-col justify-between relative overflow-hidden"
        style={{ background: 'linear-gradient(135deg, #1e3a5f 0%, #0f2027 100%)', border: '1px solid #334155' }}
      >
        <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(circle at 80% 20%, #7bd0ff 0%, transparent 60%)' }} />
        <div className="flex justify-between items-start">
          <span className="text-xs font-mono uppercase tracking-widest" style={{ color: 'rgba(218,226,253,0.5)' }}>
            {isCredit ? 'Crédito' : 'Débito'}
          </span>
          <span className="material-symbols-outlined text-[28px]" style={{ color: 'rgba(218,226,253,0.6)' }}>
            {brandIcon}
          </span>
        </div>
        <div>
          <p className="text-xl font-mono tracking-[0.2em]" style={{ color: cardNumber ? '#dae2fd' : 'rgba(218,226,253,0.25)' }}>
            {cardNumber || '•••• •••• •••• ••••'}
          </p>
          <div className="flex justify-between items-end mt-2">
            <p className="text-xs font-mono uppercase" style={{ color: cardName ? '#dae2fd' : 'rgba(218,226,253,0.25)' }}>
              {cardName || 'NOME DO TITULAR'}
            </p>
            <p className="text-xs font-mono" style={{ color: expiry ? '#dae2fd' : 'rgba(218,226,253,0.25)' }}>
              {expiry || 'MM/AA'}
            </p>
          </div>
        </div>
      </div>

      {/* Form */}
      <div className="space-y-3">
        {/* Card number */}
        <div className="flex flex-col gap-1.5">
          <label className="text-[10px] font-mono uppercase tracking-widest" style={{ color: '#a78b7d' }}>
            Número do Cartão
          </label>
          <div className="relative">
            <input
              type="text"
              inputMode="numeric"
              value={cardNumber}
              onChange={e => setCardNumber(maskCard(e.target.value))}
              placeholder="0000 0000 0000 0000"
              maxLength={19}
              className="w-full h-12 px-4 rounded-xl text-sm font-mono placeholder:opacity-30"
              style={inputStyle}
              onFocus={handleFocus}
              onBlur={handleBlur}
            />
            {brand && (
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-mono font-bold uppercase" style={{ color: '#7bd0ff' }}>
                {brand}
              </span>
            )}
          </div>
        </div>

        {/* Name */}
        <div className="flex flex-col gap-1.5">
          <label className="text-[10px] font-mono uppercase tracking-widest" style={{ color: '#a78b7d' }}>
            Nome do Titular
          </label>
          <input
            type="text"
            value={cardName}
            onChange={e => setCardName(e.target.value.toUpperCase())}
            placeholder="COMO ESTÁ NO CARTÃO"
            autoComplete="cc-name"
            className="w-full h-12 px-4 rounded-xl text-sm font-mono placeholder:opacity-30"
            style={inputStyle}
            onFocus={handleFocus}
            onBlur={handleBlur}
          />
        </div>

        {/* Expiry + CVV */}
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-mono uppercase tracking-widest" style={{ color: '#a78b7d' }}>Validade</label>
            <input
              type="text"
              inputMode="numeric"
              value={expiry}
              onChange={e => setExpiry(maskExpiry(e.target.value))}
              placeholder="MM/AA"
              maxLength={5}
              autoComplete="cc-exp"
              className="w-full h-12 px-4 rounded-xl text-sm font-mono placeholder:opacity-30"
              style={inputStyle}
              onFocus={handleFocus}
              onBlur={handleBlur}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-mono uppercase tracking-widest" style={{ color: '#a78b7d' }}>CVV</label>
            <div className="relative">
              <input
                type={showCvv ? 'text' : 'password'}
                inputMode="numeric"
                value={cvv}
                onChange={e => setCvv(e.target.value.replace(/\D/g, '').slice(0, 4))}
                placeholder="•••"
                autoComplete="cc-csc"
                className="w-full h-12 pl-4 pr-10 rounded-xl text-sm font-mono placeholder:opacity-30"
                style={inputStyle}
                onFocus={handleFocus}
                onBlur={handleBlur}
              />
              <button
                type="button"
                onClick={() => setShowCvv(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2"
                style={{ color: '#584237' }}
              >
                <span className="material-symbols-outlined text-[18px]">{showCvv ? 'visibility_off' : 'visibility'}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Installments (credit only) */}
        {isCredit && (
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-mono uppercase tracking-widest" style={{ color: '#a78b7d' }}>
              Parcelas
            </label>
            <select
              value={installments}
              onChange={e => setInstallments(Number(e.target.value))}
              className="w-full h-12 px-4 rounded-xl text-sm font-mono"
              style={{ ...inputStyle, appearance: 'none' }}
            >
              {installmentOptions.map(o => (
                <option key={o.n} value={o.n}>
                  {o.n}x de {formatCurrency(o.value)}{o.n === 1 ? ' (sem juros)' : ''}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Stripe badge */}
      <div className="flex items-center justify-center gap-2 py-2">
        <span className="material-symbols-outlined text-[16px]" style={{ color: '#584237' }}>lock</span>
        <span className="text-[10px] font-mono" style={{ color: '#584237' }}>
          Pagamento seguro · Integração Stripe em breve
        </span>
      </div>

      {/* Confirm */}
      <button
        onClick={onConfirm}
        disabled={loading || !formValid}
        className="w-full h-14 rounded-full font-semibold flex items-center justify-center gap-2 active:scale-95 transition-all disabled:opacity-40"
        style={{ background: '#f97316', color: '#582200', boxShadow: '0 8px 30px rgba(249,115,22,0.25)', fontFamily: 'Geist, sans-serif' }}
      >
        {loading ? (
          <><Loader2 className="h-5 w-5 animate-spin" /> Processando...</>
        ) : (
          <><span className="material-symbols-outlined">lock</span> Confirmar Pagamento</>
        )}
      </button>
    </div>
  )
}

// ── Main Page ──────────────────────────────────────────────
export default function CheckoutPage() {
  const params = useParams<{ slug: string }>()
  const searchParams = useSearchParams()
  const router = useRouter()
  const sessionId = searchParams.get('session')

  const [step, setStep] = useState<Step>('summary')
  const [total, setTotal] = useState(0)
  const [splitCount, setSplitCount] = useState(1)
  const [method, setMethod] = useState<PaymentMethod>('pix')
  const [loading, setLoading] = useState(true)
  const [paying, setPaying] = useState(false)
  const [confirmationCode, setConfirmationCode] = useState('')
  const [tableNumber, setTableNumber] = useState('')
  const [orderItems, setOrderItems] = useState<{ name: string; amount: number }[]>([])

  useEffect(() => {
    if (!sessionId) { router.replace(`/${params.slug}`); return }

    if (params.slug === 'demo') {
      const items = mockOrders.flatMap(o => o.items ?? []).map(i => ({
        name: `${i.quantity}x ${i.menu_item?.name ?? 'Item'}`,
        amount: i.unit_price * i.quantity,
      }))
      setOrderItems(items)
      setTotal(items.reduce((s, i) => s + i.amount, 0))
      setTableNumber('04')
      setLoading(false)
      return
    }

    async function loadData() {
      const supabase = createClient()
      const { data: session } = await supabase
        .from('sessions').select('*, table:tables(number)').eq('id', sessionId).single()
      if (!session) { router.replace(`/${params.slug}`); return }
      setTableNumber((session.table as any)?.number ?? '')

      const { data: items } = await supabase
        .from('order_items')
        .select('unit_price, quantity, menu_item:menu_items(name), order:orders!inner(session_id)')
        .eq('order.session_id', sessionId)

      const mapped = (items ?? []).map((i: any) => ({
        name: `${i.quantity}x ${i.menu_item?.name ?? 'Item'}`,
        amount: i.unit_price * i.quantity,
      }))
      setOrderItems(mapped)
      setTotal(mapped.reduce((s: number, i) => s + i.amount, 0))
      setLoading(false)
    }
    loadData()
  }, [sessionId, params.slug, router])

  async function processPayment() {
    setPaying(true)
    const amountToPay = grandTotal / splitCount

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
        body: JSON.stringify({ session_id: sessionId, amount: amountToPay, method }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Erro ao processar pagamento')

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

  function handleConfirmPayment() {
    if (method === 'pix') setStep('pix')
    else setStep('card')
  }

  const serviceFee = total * 0.1
  const grandTotal = total + serviceFee
  const amountPerPerson = grandTotal / splitCount

  const PAYMENT_METHODS = [
    { value: 'pix'    as PaymentMethod, icon: 'qr_code_2',          label: 'PIX'    },
    { value: 'debit'  as PaymentMethod, icon: 'credit_card',        label: 'Débito' },
    { value: 'credit' as PaymentMethod, icon: 'contactless',        label: 'Crédito'},
  ]

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#0b1326' }}>
        <Loader2 className="h-8 w-8 animate-spin" style={{ color: '#f97316' }} />
      </div>
    )
  }

  // ── CONFIRMED ──────────────────────────────────────────
  if (step === 'confirmed') {
    return (
      <div className="min-h-screen flex flex-col" style={{ background: '#0b1326', color: '#dae2fd' }}>
        <div className="pointer-events-none fixed top-1/4 left-1/2 -translate-x-1/2 w-80 h-80 rounded-full" style={{ background: 'rgba(52,211,153,0.08)', filter: 'blur(80px)' }} />
        <header className="sticky top-0 z-40 flex justify-center items-center px-6 h-16" style={{ background: 'rgba(11,19,38,0.85)', borderBottom: '1px solid rgba(88,66,55,0.3)', backdropFilter: 'blur(12px)' }}>
          <h1 className="text-base font-semibold" style={{ fontFamily: 'Geist, sans-serif', color: '#ffb690' }}>Pagamento</h1>
        </header>
        <main className="flex-1 flex flex-col items-center px-6 py-8 pb-28 gap-6">
          <div className="flex flex-col items-center text-center">
            <div className="w-20 h-20 rounded-full flex items-center justify-center mb-4" style={{ background: 'rgba(52,211,153,0.1)', filter: 'drop-shadow(0 0 20px rgba(52,211,153,0.2))' }}>
              <span className="material-symbols-outlined text-[52px]" style={{ color: '#34d399', fontVariationSettings: "'FILL' 1" }}>check_circle</span>
            </div>
            <h2 className="text-[28px] font-bold tracking-tight" style={{ fontFamily: 'Geist, sans-serif' }}>Obrigado!</h2>
            <p className="text-sm mt-1" style={{ color: '#e0c0b1' }}>Seu pagamento foi processado com sucesso.</p>
          </div>
          <div className="w-full rounded-xl p-5 flex justify-between items-center" style={{ background: '#171f33', border: '1px solid #334155' }}>
            <div>
              <p className="text-[10px] font-mono uppercase tracking-widest mb-1" style={{ color: '#a78b7d' }}>Mesa</p>
              <p className="text-xl font-bold" style={{ fontFamily: 'Geist, sans-serif' }}>Mesa {tableNumber}</p>
            </div>
            <div className="w-px h-10" style={{ background: '#584237' }} />
            <div className="text-right">
              <p className="text-[10px] font-mono uppercase tracking-widest mb-1" style={{ color: '#a78b7d' }}>Total Pago</p>
              <p className="text-xl font-bold" style={{ color: '#f97316', fontFamily: 'Geist, sans-serif' }}>
                {formatCurrency(amountPerPerson)}
              </p>
            </div>
          </div>
          <div className="w-full rounded-xl p-6 flex flex-col items-center gap-4" style={{ background: 'linear-gradient(135deg, #1e293b, #0f172a)', border: '1px solid #334155' }}>
            <p className="text-[10px] font-mono uppercase tracking-widest" style={{ color: '#a78b7d' }}>Código de validação</p>
            <div className="bg-white rounded-xl px-8 py-5">
              <p className="text-4xl font-black tracking-widest" style={{ color: '#0b1326' }}>{confirmationCode}</p>
            </div>
            <p className="text-xs text-center max-w-[220px] leading-relaxed" style={{ color: '#e0c0b1' }}>
              Apresente este código ao garçom para liberar a saída
            </p>
          </div>
          <div className="text-center">
            <p className="text-base font-semibold" style={{ color: '#e0c0b1' }}>Volte sempre!</p>
            <p className="text-xs mt-1 italic" style={{ color: '#584237' }}>Qomanda agradece a preferência.</p>
          </div>
        </main>
        <CustomerBottomNav slug={params.slug} sessionId={sessionId ?? ''} />
      </div>
    )
  }

  // ── PIX SCREEN ─────────────────────────────────────────
  if (step === 'pix') {
    return (
      <div className="min-h-screen flex flex-col" style={{ background: '#0b1326', color: '#dae2fd' }}>
        <div className="pointer-events-none fixed top-0 right-0 w-64 h-64 rounded-full" style={{ background: 'rgba(249,115,22,0.05)', filter: 'blur(80px)' }} />
        <header className="sticky top-0 z-40 flex items-center px-6 h-16" style={{ background: 'rgba(11,19,38,0.85)', borderBottom: '1px solid rgba(88,66,55,0.3)', backdropFilter: 'blur(12px)' }}>
          <h1 className="text-base font-semibold" style={{ fontFamily: 'Geist, sans-serif' }}>Pagamento</h1>
        </header>
        <main className="flex-1 px-6 py-6 pb-28 relative z-10">
          <PixScreen
            amount={amountPerPerson}
            onConfirm={processPayment}
            onBack={() => setStep('summary')}
            loading={paying}
          />
        </main>
        <CustomerBottomNav slug={params.slug} sessionId={sessionId ?? ''} />
      </div>
    )
  }

  // ── CARD SCREEN ────────────────────────────────────────
  if (step === 'card') {
    return (
      <div className="min-h-screen flex flex-col" style={{ background: '#0b1326', color: '#dae2fd' }}>
        <div className="pointer-events-none fixed top-0 right-0 w-64 h-64 rounded-full" style={{ background: 'rgba(123,208,255,0.05)', filter: 'blur(80px)' }} />
        <header className="sticky top-0 z-40 flex items-center px-6 h-16" style={{ background: 'rgba(11,19,38,0.85)', borderBottom: '1px solid rgba(88,66,55,0.3)', backdropFilter: 'blur(12px)' }}>
          <h1 className="text-base font-semibold" style={{ fontFamily: 'Geist, sans-serif' }}>Pagamento</h1>
        </header>
        <main className="flex-1 px-6 py-6 pb-28 relative z-10">
          <CardScreen
            method={method as 'debit' | 'credit'}
            amount={amountPerPerson}
            onConfirm={processPayment}
            onBack={() => setStep('summary')}
            loading={paying}
          />
        </main>
        <CustomerBottomNav slug={params.slug} sessionId={sessionId ?? ''} />
      </div>
    )
  }

  // ── SUMMARY ────────────────────────────────────────────
  return (
    <div className="min-h-screen flex flex-col" style={{ background: '#0b1326', color: '#dae2fd' }}>
      <div className="pointer-events-none fixed top-1/4 right-0 w-64 h-64 rounded-full" style={{ background: 'rgba(123,208,255,0.05)', filter: 'blur(80px)' }} />
      <header className="sticky top-0 z-40 flex items-center px-6 h-16" style={{ background: 'rgba(11,19,38,0.85)', borderBottom: '1px solid rgba(88,66,55,0.3)', backdropFilter: 'blur(12px)' }}>
        <button onClick={() => router.back()} className="p-2 -ml-2 mr-3 rounded-full" style={{ color: '#ffb690' }}>
          <span className="material-symbols-outlined">arrow_back</span>
        </button>
        <h1 className="text-base font-semibold" style={{ fontFamily: 'Geist, sans-serif' }}>Fechar Conta</h1>
      </header>

      <main className="flex-1 px-6 py-6 pb-32 space-y-6 relative z-10">
        {/* Order summary */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold" style={{ fontFamily: 'Geist, sans-serif' }}>Resumo do Pedido</h2>
            <span className="text-xs font-mono px-2 py-1 rounded-lg" style={{ background: '#222a3d', color: '#ffb690' }}>Mesa {tableNumber}</span>
          </div>
          <div className="rounded-xl p-4 space-y-3" style={{ background: 'rgba(30,41,59,0.7)', border: '1px solid #334155', backdropFilter: 'blur(12px)' }}>
            {orderItems.map((item, i) => (
              <div key={i} className="flex justify-between text-sm" style={{ color: '#e0c0b1' }}>
                <span>{item.name}</span>
                <span className="font-mono">{formatCurrency(item.amount)}</span>
              </div>
            ))}
            <div className="flex justify-between text-sm pt-2" style={{ color: '#e0c0b1', borderTop: '1px solid rgba(88,66,55,0.3)' }}>
              <span>Taxa de Serviço (10%)</span>
              <span className="font-mono">{formatCurrency(serviceFee)}</span>
            </div>
            <div className="pt-2" style={{ borderTop: '1px solid rgba(88,66,55,0.3)' }}>
              <div className="flex justify-between items-end">
                <span className="text-xs font-mono uppercase tracking-widest" style={{ color: '#7bd0ff' }}>Total</span>
                <span className="text-[40px] font-black leading-none" style={{ color: '#f97316', fontFamily: 'Geist, sans-serif' }}>
                  {formatCurrency(grandTotal)}
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* Split */}
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[20px]" style={{ color: '#7bd0ff' }}>groups</span>
            <h3 className="text-xs font-mono uppercase tracking-wider" style={{ color: '#dae2fd' }}>Dividir Conta</h3>
          </div>
          <div className="rounded-xl p-4 flex items-center justify-between" style={{ background: 'rgba(30,41,59,0.7)', border: '1px solid #334155', backdropFilter: 'blur(12px)' }}>
            <span className="text-sm" style={{ color: '#e0c0b1' }}>Número de pessoas</span>
            <div className="flex items-center gap-4 rounded-full px-2 py-1" style={{ background: '#2d3449' }}>
              <button onClick={() => setSplitCount(Math.max(1, splitCount - 1))} className="w-10 h-10 rounded-full flex items-center justify-center active:scale-90 transition-all" style={{ color: '#f97316' }}>
                <span className="material-symbols-outlined">remove</span>
              </button>
              <span className="text-xl font-bold w-5 text-center" style={{ fontFamily: 'Geist, sans-serif' }}>{splitCount}</span>
              <button onClick={() => setSplitCount(splitCount + 1)} className="w-10 h-10 rounded-full flex items-center justify-center active:scale-90 transition-all" style={{ color: '#f97316' }}>
                <span className="material-symbols-outlined">add</span>
              </button>
            </div>
          </div>
          {splitCount > 1 && (
            <div className="flex justify-between items-center rounded-lg px-4 py-3" style={{ background: 'rgba(123,208,255,0.08)', border: '1px solid rgba(123,208,255,0.15)' }}>
              <span className="text-sm" style={{ color: '#7bd0ff' }}>Cada pessoa paga:</span>
              <span className="font-semibold font-mono" style={{ color: '#7bd0ff' }}>{formatCurrency(amountPerPerson)}</span>
            </div>
          )}
        </section>

        {/* Payment method */}
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[20px]" style={{ color: '#7bd0ff' }}>payments</span>
            <h3 className="text-xs font-mono uppercase tracking-wider" style={{ color: '#dae2fd' }}>Forma de Pagamento</h3>
          </div>
          <div className="grid grid-cols-3 gap-3">
            {PAYMENT_METHODS.map(m => (
              <button
                key={m.value}
                onClick={() => setMethod(m.value)}
                className="flex flex-col items-center justify-center gap-2 p-4 rounded-xl border-2 transition-all active:scale-95"
                style={{
                  background: method === m.value ? 'rgba(249,115,22,0.1)' : 'rgba(30,41,59,0.7)',
                  borderColor: method === m.value ? '#f97316' : '#334155',
                  backdropFilter: 'blur(12px)',
                }}
              >
                <span className="material-symbols-outlined text-[22px]" style={{ color: method === m.value ? '#f97316' : '#e0c0b1' }}>
                  {m.icon}
                </span>
                <span className="text-xs font-mono" style={{ color: method === m.value ? '#f97316' : '#e0c0b1' }}>
                  {m.label}
                </span>
              </button>
            ))}
          </div>
        </section>
      </main>

      <div className="fixed bottom-20 left-0 right-0 px-6 py-3 z-40" style={{ background: 'rgba(11,19,38,0.85)', backdropFilter: 'blur(12px)', borderTop: '1px solid rgba(88,66,55,0.2)' }}>
        <button
          onClick={handleConfirmPayment}
          className="w-full h-14 rounded-full font-semibold flex items-center justify-center gap-2 active:scale-95 transition-all"
          style={{ background: '#f97316', color: '#582200', boxShadow: '0 8px 30px rgba(249,115,22,0.3)', fontFamily: 'Geist, sans-serif' }}
        >
          Continuar para Pagamento
          <span className="material-symbols-outlined">arrow_forward</span>
        </button>
      </div>

      <CustomerBottomNav slug={params.slug} sessionId={sessionId ?? ''} />
    </div>
  )
}
