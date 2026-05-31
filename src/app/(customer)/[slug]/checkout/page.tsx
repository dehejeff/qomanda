'use client'

import { useEffect, useMemo, useState, useCallback } from 'react'
import { useParams, useSearchParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { PaymentMethod } from '@/types'
import type { AsaasPaymentRequest, AsaasPaymentResponse } from '@/app/api/asaas/payments/route'
import { formatCurrency, generateConfirmationCode } from '@/lib/utils'
import { splitConsumptionByAlcohol, splitPaymentAmounts } from '@/lib/alcohol-split'
import {
  SERVICE_FEE_RATE,
  computeOpenBalance,
  paymentSubtotalCredit,
  amountWithServiceFee,
  unpaidOrderLineItems,
  roundMoney,
} from '@/lib/session-billing'
import type { Order } from '@/types'
import { CustomerBottomNav } from '@/components/customer/bottom-nav'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'

type CloseMode = 'individual' | 'table'
type SplitType = 'equal' | 'custom'
type Step      = 'mode' | 'pix' | 'card' | 'confirmed'

function maskCard(v: string) {
  return v.replace(/\D/g, '').slice(0, 16).replace(/(.{4})/g, '$1 ').trim()
}
function maskExpiry(v: string) {
  const d = v.replace(/\D/g, '').slice(0, 4)
  return d.length > 2 ? `${d.slice(0, 2)}/${d.slice(2)}` : d
}

// ── PIX Screen ───────────────────────────────────────────────
// ── PIX Screen ── Mostra QR Code real gerado pelo Asaas ─────
function PixScreen({
  suggestedAmount,
  fixedAmount,
  pixQrCodeImage,
  pixPayload,
  pixExpiration,
  onConfirmManual,
  onBack,
  loading,
}: {
  suggestedAmount: number
  fixedAmount: boolean
  pixQrCodeImage?: string
  pixPayload?: string
  pixExpiration?: string
  onConfirmManual: (amount: number) => void
  onBack: () => void
  loading: boolean
}) {
  const [amount, setAmount]   = useState(suggestedAmount.toFixed(2))
  const [copied, setCopied]   = useState(false)
  const parsedAmt = parseFloat(amount.replace(',', '.')) || 0
  const extraAmt  = parsedAmt - suggestedAmount

  // Calcula segundos restantes até expiração (Asaas retorna ISO date)
  const [seconds, setSeconds] = useState(() => {
    if (!pixExpiration) return 5 * 60
    const diff = Math.max(0, Math.floor((new Date(pixExpiration).getTime() - Date.now()) / 1000))
    return diff || 5 * 60
  })

  useEffect(() => {
    const t = setInterval(() => setSeconds(s => Math.max(0, s - 1)), 1000)
    return () => clearInterval(t)
  }, [])

  const mm      = String(Math.floor(seconds / 60)).padStart(2, '0')
  const ss      = String(seconds % 60).padStart(2, '0')
  const expired = seconds === 0

  function copyPayload() {
    if (!pixPayload) return
    navigator.clipboard.writeText(pixPayload).then(() => {
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

      {/* QR Code — imagem real do Asaas */}
      <div className="flex flex-col items-center gap-4 rounded-xl p-6"
        style={{ background: 'linear-gradient(135deg,#1e293b,#0f172a)', border: '1px solid #334155' }}>
        <div className="bg-white p-4 rounded-xl">
          {pixQrCodeImage ? (
            <img
              src={`data:image/png;base64,${pixQrCodeImage}`}
              alt="QR Code PIX"
              className="w-44 h-44 object-contain"
            />
          ) : (
            <div className="w-44 h-44 flex items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin" style={{ color: '#334155' }} />
            </div>
          )}
        </div>
        <p className="text-xs text-center leading-relaxed" style={{ color: '#e0c0b1' }}>
          Escaneie o QR Code com o app do seu banco ou copie o código abaixo
        </p>
      </div>

      {/* PIX Copia-e-Cola */}
      {pixPayload && (
        <div className="flex items-center gap-2 rounded-xl px-4 py-3"
          style={{ background: '#1e293b', border: '1px solid #334155' }}>
          <span className="flex-1 text-xs font-mono truncate" style={{ color: '#dae2fd' }}>
            {pixPayload.slice(0, 40)}...
          </span>
          <button onClick={copyPayload}
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
      )}

      {/* Valor */}
      <div className="rounded-xl p-4 space-y-2" style={{ background: '#1e293b', border: '1px solid #334155' }}>
        <div className="flex justify-between items-center">
          <span className="text-[10px] font-mono uppercase tracking-wider" style={{ color: '#a78b7d' }}>
            {fixedAmount ? 'Valor a pagar (definido)' : 'Valor a pagar'}
          </span>
          {!fixedAmount && (
            <span className="text-[10px] font-mono" style={{ color: '#584237' }}>
              Mínimo: {formatCurrency(suggestedAmount)}
            </span>
          )}
        </div>
        {fixedAmount ? (
          <div className="flex items-center gap-2 h-12 px-3 rounded-lg"
            style={{ background: '#0b1326', border: '1px solid #584237' }}>
            <span className="text-sm" style={{ color: '#a78b7d' }}>R$</span>
            <span className="text-xl font-black font-mono" style={{ color: '#ffb690' }}>
              {suggestedAmount.toFixed(2).replace('.', ',')}
            </span>
            <span className="material-symbols-outlined text-[16px] ml-auto" style={{ color: '#584237' }}>lock</span>
          </div>
        ) : (
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm" style={{ color: '#a78b7d' }}>R$</span>
            <input type="number" step="0.01" min={suggestedAmount.toFixed(2)} value={amount}
              onChange={e => setAmount(e.target.value)}
              className="w-full h-12 pl-9 pr-3 rounded-lg text-base font-bold font-mono outline-none"
              style={{ background: '#0b1326', border: `1px solid ${parsedAmt >= suggestedAmount ? '#f97316' : '#f87171'}`, color: '#dae2fd' }}
            />
          </div>
        )}
        {!fixedAmount && extraAmt > 0.01 && (
          <div className="flex items-start gap-2 text-xs rounded-lg px-3 py-2"
            style={{ background: 'rgba(52,211,153,0.08)', color: '#34d399', border: '1px solid rgba(52,211,153,0.15)' }}>
            <span className="material-symbols-outlined text-[14px] shrink-0 mt-0.5">savings</span>
            <span><strong>+{formatCurrency(extraAmt)}</strong> virará saldo da mesa.</span>
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

      <button
        onClick={() => onConfirmManual(fixedAmount ? suggestedAmount : parsedAmt)}
        disabled={loading || expired || (!fixedAmount && parsedAmt < suggestedAmount)}
        className="w-full h-14 rounded-full font-semibold flex items-center justify-center gap-2 active:scale-95 transition-all disabled:opacity-40"
        style={{ background: '#f97316', color: '#582200', boxShadow: '0 8px 30px rgba(249,115,22,0.25)', fontFamily: 'Geist, sans-serif' }}>
        {loading ? <><Loader2 className="h-5 w-5 animate-spin" /> Aguardando confirmação...</> : (
          <><span className="material-symbols-outlined">check_circle</span> Já paguei — confirmar</>
        )}
      </button>
      <p className="text-center text-[10px] font-mono" style={{ color: '#584237' }}>
        A confirmação automática chega via webhook do Asaas em instantes.
      </p>
    </div>
  )
}

// ── Card Screen ──────────────────────────────────────────────
function CardScreen({
  method, suggestedAmount, fixedAmount, onConfirm, onBack, loading,
}: {
  method: 'debit' | 'credit'
  suggestedAmount: number
  fixedAmount: boolean
  onConfirm: (amount: number, cardData?: {
    creditCard: AsaasPaymentRequest['creditCard']
    creditCardHolderInfo: AsaasPaymentRequest['creditCardHolderInfo']
    installmentCount?: number
  }) => void
  onBack: () => void
  loading: boolean
}) {
  const [cardNumber, setCardNumber]     = useState('')
  const [cardName, setCardName]         = useState('')
  const [expiry, setExpiry]             = useState('')
  const [cvv, setCvv]                   = useState('')
  const [showCvv, setShowCvv]           = useState(false)
  const [installments, setInstallments] = useState(1)
  const [amount, setAmount]             = useState(suggestedAmount.toFixed(2))

  const isCredit   = method === 'credit'
  const parsedAmt  = fixedAmount ? suggestedAmount : (parseFloat(amount.replace(',', '.')) || 0)
  const extraAmt   = parsedAmt - suggestedAmount
  const formValid  = cardNumber.replace(/\s/g, '').length === 16 && cardName.trim()
    && expiry.length === 5 && cvv.length >= 3
    && (fixedAmount || parsedAmt >= suggestedAmount)
  const brand = cardNumber.startsWith('4') ? 'Visa' : cardNumber.startsWith('5') ? 'Master' : null

  const inputSt: React.CSSProperties = {
    background: '#0b1326', border: '1px solid #334155', color: '#dae2fd',
    outline: 'none', width: '100%', height: 44, borderRadius: 12, padding: '0 12px', fontSize: 14,
  }
  const onFocus = (e: React.FocusEvent<HTMLInputElement | HTMLSelectElement>) => { e.target.style.borderColor = '#f97316' }
  const onBlur  = (e: React.FocusEvent<HTMLInputElement | HTMLSelectElement>) => { e.target.style.borderColor = '#334155' }

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
        <div className="flex justify-between">
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

      {/* Form */}
      <div className="space-y-3">
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

        {/* Amount */}
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
              <span className="material-symbols-outlined text-[16px] ml-auto" style={{ color: '#584237' }}>lock</span>
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
            <p className="text-xs" style={{ color: '#34d399' }}>
              +{formatCurrency(extraAmt)} virará saldo da mesa 💛
            </p>
          )}
        </div>
      </div>

      <button
        onClick={() => onConfirm(parsedAmt, {
          creditCard: {
            holderName: cardName,
            number: cardNumber.replace(/\s/g, ''),
            expiryMonth: expiry.split('/')[0] ?? '',
            expiryYear: `20${expiry.split('/')[1] ?? ''}`,
            ccv: cvv,
          },
          creditCardHolderInfo: {
            name: cardName,
            email: '',   // preenchido pelo cliente se necessário
            cpfCnpj: '', // descriptografado server-side via session
            phone: '',
          },
          installmentCount: installments,
        })}
        disabled={loading || !formValid}
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
  const requestId   = searchParams.get('request') // pre-filled from notification

  const myCustomerId = typeof window !== 'undefined'
    ? localStorage.getItem('qomanda_customer_id') : null

  type Participant = { id: string; name: string; myConsumption: number; isMe: boolean }

  type AlcoholSplit = { food: number; alcohol: number; hasAlcohol: boolean }

  const [step, setStep]             = useState<Step>('mode')
  const [closeMode, setCloseMode]   = useState<CloseMode>('individual')
  const [splitType, setSplitType]   = useState<SplitType>('equal')
  const [method, setMethod]         = useState<PaymentMethod>('pix')
  const [loading, setLoading]       = useState(true)
  const [paying, setPaying]             = useState(false)
  const [includeServiceFee, setIncludeServiceFee] = useState(true)
  const [confirmationCode, setConfirmationCode]   = useState('')
  const [confirmationCode2, setConfirmationCode2] = useState('')
  // Dados do PIX gerados pelo Asaas
  const [pixQrCodeImage, setPixQrCodeImage] = useState('')
  const [pixPayload, setPixPayload]         = useState('')
  const [pixExpiration, setPixExpiration]   = useState('')
  const [pixPaymentId, setPixPaymentId]     = useState('')  // ID interno para polling
  const [tableNumber, setTableNumber] = useState('')
  const [splitAlcohol, setSplitAlcohol] = useState(false)
  const [alcoholSplitDismissed, setAlcoholSplitDismissed] = useState(false)
  const [restaurantId, setRestaurantId] = useState('')
  const [customerWhatsapp, setCustomerWhatsapp] = useState('')
  const [restaurantName, setRestaurantName] = useState('')
  const [tableSettled, setTableSettled] = useState(false)

  // Amounts
  const [subTotal, setSubTotal]             = useState(0)
  const [mySubtotal, setMySubtotal]         = useState(0)
  const [myOrders, setMyOrders]             = useState<Order[]>([])
  const [sessionPayments, setSessionPayments] = useState<{ amount: number; customer_id: string | null; service_fee_included?: boolean | null }[]>([])
  const [myAlreadyPaid, setMyAlreadyPaid]   = useState(0)

  // Participants for Mesa Toda
  const [participants, setParticipants]   = useState<Participant[]>([])
  const [selectedIds, setSelectedIds]     = useState<Set<string>>(new Set())
  const [customAmounts, setCustomAmounts] = useState<Record<string, string>>({})

  // Individual extra
  const [extraAmount, setExtraAmount] = useState('')

  const myPaymentRows = useMemo(
    () => sessionPayments.filter(p => p.customer_id === myCustomerId),
    [sessionPayments, myCustomerId],
  )

  const myOpen = useMemo(
    () => computeOpenBalance(mySubtotal, myPaymentRows, includeServiceFee),
    [mySubtotal, myPaymentRows, includeServiceFee],
  )

  const sessionOpen = useMemo(
    () => computeOpenBalance(subTotal, sessionPayments, includeServiceFee),
    [subTotal, sessionPayments, includeServiceFee],
  )

  const remaining = sessionOpen.openTotal
  const sessionGrandTotal = useMemo(
    () => amountWithServiceFee(subTotal, includeServiceFee),
    [subTotal, includeServiceFee],
  )

  const unpaidItems = useMemo(
    () => unpaidOrderLineItems(myOrders, myPaymentRows),
    [myOrders, myPaymentRows],
  )

  const alcoholSplit = useMemo(() => {
    const feeMult = includeServiceFee ? 1 + SERVICE_FEE_RATE : 1
    return splitConsumptionByAlcohol(unpaidItems, feeMult, splitAlcohol && includeServiceFee)
  }, [unpaidItems, includeServiceFee, splitAlcohol])

  const myConsumptionFull = amountWithServiceFee(mySubtotal, includeServiceFee)

  function toggleParticipant(id: string) {
    if (id === myCustomerId) return
    setSelectedIds(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  // Computed values
  const selectedParts     = participants.filter(p => selectedIds.has(p.id))
  const equalShare        = selectedParts.length > 0 ? remaining / selectedParts.length : 0
  const customSum         = Object.entries(customAmounts)
    .filter(([id]) => selectedIds.has(id))
    .reduce((s, [, v]) => s + (parseFloat(v) || 0), 0)
  const customSumOk       = Math.abs(customSum - remaining) < 0.02
  const myDefinedAmount   = splitType === 'equal' ? equalShare : (parseFloat(customAmounts[myCustomerId ?? ''] ?? '0') || 0)
  const myIndividualBase  = Math.min(myOpen.openTotal, Math.max(0, remaining))
  const myIndividualTotal = myIndividualBase + (parseFloat(extraAmount) || 0)
  const hasPaidMyShare    = mySubtotal > 0.01 && myOpen.openSubtotal <= 0.02
  const tableCreditForMe  = Math.max(0, myOpen.openTotal - myIndividualBase)

  function getAmountToPay() {
    if (closeMode === 'individual') return myIndividualTotal
    return myDefinedAmount
  }

  const serviceFeeOpenBase = closeMode === 'individual' ? myOpen.openSubtotal : sessionOpen.openSubtotal

  const serviceFeeDisplay = serviceFeeOpenBase <= 0.01
    ? 0
    : roundMoney(serviceFeeOpenBase * SERVICE_FEE_RATE)

  const sessionPaidTotal = useMemo(
    () => roundMoney(sessionPayments.reduce((s, p) => s + Number(p.amount), 0)),
    [sessionPayments],
  )

  useEffect(() => {
    if (!sessionId) { router.replace(`/${params.slug}`); return }

    async function load() {
      const supabase = createClient()

      const [sessionRes, participantsRes, ordersRes, paymentsRes] = await Promise.all([
        supabase.from('sessions').select('*, table:tables(number), restaurant:restaurants(id,name,whatsapp_nfe_enabled)').eq('id', sessionId).single(),
        supabase.from('session_participants').select('customer_id, customer:customers(first_name,last_name,whatsapp)').eq('session_id', sessionId),
        supabase.from('orders').select('id, customer_id, status, created_at, items:order_items(unit_price,quantity,menu_item:menu_items(name,contains_alcohol,category:menu_categories(name)))').eq('session_id', sessionId),
        supabase.from('payments').select('amount, customer_id, service_fee_included').eq('session_id', sessionId).eq('status', 'paid'),
      ])

      const restaurant = (sessionRes.data as any)?.restaurant
      if (restaurant) {
        setRestaurantId(restaurant.id)
        setRestaurantName(restaurant.name)
      }

      // Customer WhatsApp
      const myParticipant = (participantsRes.data ?? []).find((p: any) => p.customer_id === myCustomerId) as any
      if (myParticipant?.customer?.whatsapp) {
        setCustomerWhatsapp(String(myParticipant.customer.whatsapp))
      }

      if (!sessionRes.data) { router.replace(`/${params.slug}`); return }
      setTableNumber((sessionRes.data.table as any)?.number ?? '')

      const billableOrders = (ordersRes.data ?? []).filter((o: any) => o.status !== 'cancelled')
      const allItems   = billableOrders.flatMap((o: any) => o.items ?? [])
      const sub        = allItems.reduce((s: number, i: any) => s + i.unit_price * i.quantity, 0)
      const allPayments = paymentsRes.data ?? []
      const myPaid     = myCustomerId
        ? allPayments.filter((p: any) => p.customer_id === myCustomerId).reduce((s, p) => s + Number(p.amount), 0)
        : 0

      setSubTotal(sub)
      setSessionPayments(allPayments)
      setMyAlreadyPaid(myPaid)

      const myOrdersData = billableOrders.filter((o: any) => o.customer_id === myCustomerId) as unknown as Order[]
      const myAllItems   = myOrdersData.flatMap((o: any) => o.items ?? [])
      const mySub = myAllItems.reduce((s: number, i: any) => s + i.unit_price * i.quantity, 0)
      setMySubtotal(mySub)
      setMyOrders(myOrdersData)

      const myPayRows = allPayments.filter((p: any) => p.customer_id === myCustomerId)
      const myOpenAfterLoad = computeOpenBalance(mySub, myPayRows, true)

      if (myOpenAfterLoad.openSubtotal <= 0.02 && mySub > 0.01) {
        setCloseMode('table')
        setSplitAlcohol(false)
        setAlcoholSplitDismissed(true)
        if (sessionId) sessionStorage.removeItem(`qomanda_split_alcohol_${sessionId}`)
      } else {
        const savedSplit = sessionStorage.getItem(`qomanda_split_alcohol_${sessionId}`)
        const unpaid = unpaidOrderLineItems(myOrdersData, myPayRows)
        const hasAlc = unpaid.some(i => splitConsumptionByAlcohol([i], 1).hasAlcohol)
        if (savedSplit === 'true' && hasAlc) setSplitAlcohol(true)
      }

      // Participants who haven't fully paid yet
      const parts: Participant[] = (participantsRes.data ?? []).map((p: any) => {
        const pOrders = billableOrders.filter((o: any) => o.customer_id === p.customer_id)
        const pSub    = pOrders.flatMap((o: any) => o.items ?? []).reduce((s: number, i: any) => s + i.unit_price * i.quantity, 0)
        const pPay    = allPayments.filter((pay: any) => pay.customer_id === p.customer_id)
        const pOpen   = computeOpenBalance(pSub, pPay, true)
        return {
          id: p.customer_id,
          name: p.customer ? `${p.customer.first_name} ${p.customer.last_name}` : 'Cliente',
          myConsumption: pOpen.openTotal,
          isMe: p.customer_id === myCustomerId,
        }
      })
      setParticipants(parts)

      if (myCustomerId) setSelectedIds(new Set([myCustomerId]))
      const sessionRem = computeOpenBalance(sub, allPayments, true).openTotal
      const equalAmt = parts.length > 0 ? (sessionRem / parts.length).toFixed(2) : '0'
      setCustomAmounts(Object.fromEntries(parts.map(p => [p.id, equalAmt])))
      setLoading(false)
    }
    load()

    const supabase = createClient()
    const ch = supabase.channel('checkout-payments')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'payments', filter: `session_id=eq.${sessionId}` }, load)
      .subscribe()

    return () => { supabase.removeChannel(ch) }
  }, [sessionId, params.slug, router, myCustomerId])

  // Recalculate equal amounts when selection changes or remaining changes
  useEffect(() => {
    if (splitType === 'equal') {
      const eq = selectedParts.length > 0 ? (remaining / selectedParts.length).toFixed(2) : '0'
      setCustomAmounts(prev => {
        const next = { ...prev }
        participants.forEach(p => { next[p.id] = selectedIds.has(p.id) ? eq : '0' })
        return next
      })
    }
  }, [splitType, selectedIds, remaining, participants])

  function setParticipantAmount(id: string, value: string) {
    setCustomAmounts(prev => ({ ...prev, [id]: value }))
  }

  async function sendWhatsApp(phone: string, message: string) {
    if (!restaurantId || !phone) return
    try {
      await fetch('/api/whatsapp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to: phone, restaurantId, message }),
      })
    } catch {
      // WhatsApp failure is non-blocking
    }
  }

  function buildReceiptMessage(
    items: { name: string; amount: number }[],
    total: number,
    code: string,
    label?: string
  ) {
    const date = new Date().toLocaleDateString('pt-BR')
    const itemLines = items.map(i => `• ${i.name} — ${formatCurrency(i.amount)}`).join('\n')
    const header = label
      ? `🧾 *${restaurantName}*\n${label}\nMesa: ${tableNumber} | Data: ${date}`
      : `🧾 *${restaurantName}*\nMesa: ${tableNumber} | Data: ${date}`
    return `${header}\n\n*Itens:*\n${itemLines}\n\n*Total: ${formatCurrency(total)}*\n\nCódigo de confirmação: *${code}*\n\n_A NF-e será emitida e enviada em seguida._`
  }

  async function createCloseRequest() {
    const supabase = createClient()
    const { data: req } = await supabase
      .from('close_requests')
      .insert({ session_id: sessionId, initiator_id: myCustomerId, mode: closeMode, status: 'pending' })
      .select().single()
    if (!req) return

    if (closeMode === 'table') {
      await supabase.from('close_request_participants').insert(
        [...selectedIds].map(cid => ({
          request_id: req.id,
          customer_id: cid,
          amount_owed: splitType === 'equal' ? equalShare : (parseFloat(customAmounts[cid] ?? '0') || 0),
          status: cid === myCustomerId ? 'confirmed' : 'pending',
        }))
      )
    }
  }

  /**
   * Inicia o pagamento via Asaas (ou modo teste sem gateway).
   * Retorna true se foi direto para a tela de confirmação.
   */
  async function submitPayment(
    amount: number,
    splitType: 'food' | 'alcohol' | 'combined',
    cardData?: {
      creditCard: AsaasPaymentRequest['creditCard']
      creditCardHolderInfo: AsaasPaymentRequest['creditCardHolderInfo']
      installmentCount?: number
    },
  ): Promise<AsaasPaymentResponse> {
    const payload: AsaasPaymentRequest = {
      sessionId: sessionId!,
      amount,
      method,
      splitType,
      customerId: myCustomerId,
      serviceFeeIncluded: includeServiceFee,
      ...(cardData ?? {}),
    }

    const res = await fetch('/api/asaas/payments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })

    const data: AsaasPaymentResponse = await res.json()
    if (!res.ok) throw new Error((data as any).error ?? 'Erro ao processar pagamento.')
    if (data.sessionClosed) setTableSettled(true)
    return data
  }

  function alcoholPaymentAmounts() {
    const extra = parseFloat(extraAmount) || 0
    return splitPaymentAmounts(
      getAmountToPay(),
      alcoholSplit.food,
      alcoholSplit.alcohol,
      extra,
    )
  }

  async function processSplitPayments(
    cardData?: {
      creditCard: AsaasPaymentRequest['creditCard']
      creditCardHolderInfo: AsaasPaymentRequest['creditCardHolderInfo']
      installmentCount?: number
    },
  ): Promise<boolean> {
    const { food, alcohol } = alcoholPaymentAmounts()
    const mustSplit = alcoholSplit.hasAlcohol && food >= 0.01 && alcohol >= 0.01

    if (mustSplit) {
      const foodRes = await submitPayment(food, 'food', cardData)
      const alcoholRes = await submitPayment(alcohol, 'alcohol')

      setConfirmationCode(foodRes.confirmationCode)
      setConfirmationCode2(alcoholRes.confirmationCode)

      if (customerWhatsapp) {
        await sendWhatsApp(customerWhatsapp, buildReceiptMessage([], food, foodRes.confirmationCode, '🍽️ Alimentação'))
        await sendWhatsApp(customerWhatsapp, buildReceiptMessage([], alcohol, alcoholRes.confirmationCode, '🍷 Bebidas Alcoólicas'))
      }
      return true
    }

    const singleAmount = food >= 0.01 ? food : alcohol
    const singleType = food >= 0.01 ? 'food' as const : 'alcohol' as const
    if (singleAmount < 0.01) return false

    const data = await submitPayment(singleAmount, singleType, cardData)
    setConfirmationCode(data.confirmationCode)
    if (customerWhatsapp) {
      const label = singleType === 'food' ? '🍽️ Alimentação' : '🍷 Bebidas Alcoólicas'
      await sendWhatsApp(customerWhatsapp, buildReceiptMessage([], singleAmount, data.confirmationCode, label))
    }
    return true
  }

  async function processPayment(
    paidAmount: number,
    cardData?: {
      creditCard: AsaasPaymentRequest['creditCard']
      creditCardHolderInfo: AsaasPaymentRequest['creditCardHolderInfo']
      installmentCount?: number
    },
  ): Promise<boolean> {
    setPaying(true)

    try {
      // Split alcoólico: 2 pagamentos (alimentação + bebidas)
      if (splitAlcohol && closeMode === 'individual') {
        const done = await processSplitPayments(cardData)
        if (!done) {
          toast.error('Nenhum valor a pagar.')
          return false
        }
        setStep('confirmed')
        return true
      }

      const data = await submitPayment(paidAmount, 'combined', cardData)

      if ((method === 'pix' || method === 'debit') && data.status === 'pending') {
        setPixQrCodeImage(data.pixQrCodeImage ?? '')
        setPixPayload(data.pixPayload ?? '')
        setPixExpiration(data.pixExpiration ?? '')
        setPixPaymentId(data.paymentId)

        if (customerWhatsapp) {
          await sendWhatsApp(
            customerWhatsapp,
            buildReceiptMessage([], paidAmount, 'PIX GERADO'),
          )
        }
        return false
      }

      if (data.confirmationCode) {
        setConfirmationCode(data.confirmationCode)
        if (customerWhatsapp) {
          await sendWhatsApp(customerWhatsapp, buildReceiptMessage([], paidAmount, data.confirmationCode))
        }
        setStep('confirmed')
        return true
      }

      return false
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao processar pagamento.')
      return false
    } finally {
      setPaying(false)
    }
  }

  /** Confirmação manual do PIX (produção com gateway) */
  async function confirmPixManually(paidAmount: number) {
    setPaying(true)
    try {
      if (splitAlcohol && closeMode === 'individual') {
        const done = await processSplitPayments()
        if (done) {
          sessionStorage.removeItem(`qomanda_split_alcohol_${sessionId}`)
          setStep('confirmed')
        }
        return
      }

      const res = await fetch(`/api/asaas/payments?id=${pixPaymentId}`)
      const data = await res.json()

      const code = data.confirmation_code || generateConfirmationCode()
      setConfirmationCode(code)
      if (customerWhatsapp) {
        await sendWhatsApp(customerWhatsapp, buildReceiptMessage([], paidAmount, code))
      }
      setStep('confirmed')
    } catch {
      const code = generateConfirmationCode()
      setConfirmationCode(code)
      setStep('confirmed')
    } finally {
      setPaying(false)
    }
  }

  async function handleProceed() {
    if (closeMode === 'table' && splitType === 'custom' && !customSumOk) {
      toast.error('Os valores não fecham com o total da conta. Ajuste os valores.')
      return
    }
    await createCloseRequest()

    // Recibos separados: processar split antes de ir para tela PIX única
    if (splitAlcohol && closeMode === 'individual') {
      if (method === 'credit') {
        setStep('card')
        return
      }
      const confirmed = await processPayment(getAmountToPay())
      if (confirmed) {
        sessionStorage.removeItem(`qomanda_split_alcohol_${sessionId}`)
        setStep('confirmed')
      } else if (method === 'pix' || method === 'debit') {
        setStep('pix')
      }
      return
    }

    if (method === 'pix' || method === 'debit') {
      const confirmed = await processPayment(getAmountToPay())
      if (!confirmed) setStep('pix')
    } else {
      setStep('card')
    }
  }

  const PAYMENT_METHODS = [
    { value: 'pix'    as PaymentMethod, icon: 'qr_code_2',   label: 'PIX'    },
    { value: 'debit'  as PaymentMethod, icon: 'credit_card', label: 'Débito' },
    { value: 'credit' as PaymentMethod, icon: 'contactless', label: 'Crédito'},
  ]

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#0b1326' }}>
        <Loader2 className="h-8 w-8 animate-spin" style={{ color: '#f97316' }} />
      </div>
    )
  }

  // ── CONFIRMED ──────────────────────────────────────────────
  if (step === 'confirmed') {
    if (tableSettled && sessionId) {
      localStorage.removeItem('qomanda_session_id')
      sessionStorage.removeItem(`qomanda_split_alcohol_${sessionId}`)
    }

    return (
      <div className="min-h-screen flex flex-col" style={{ background: '#0b1326', color: '#dae2fd' }}>
        <div className="pointer-events-none fixed top-1/4 left-1/2 -translate-x-1/2 w-80 h-80 rounded-full"
          style={{ background: 'rgba(52,211,153,0.08)', filter: 'blur(80px)' }} />
        <header className="sticky top-0 z-40 flex justify-center items-center h-16"
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
          {tableSettled && (
            <div className="w-full rounded-xl px-5 py-4 flex items-start gap-3"
              style={{ background: 'rgba(123,208,255,0.1)', border: '1px solid rgba(123,208,255,0.3)' }}>
              <span className="material-symbols-outlined text-[22px] shrink-0" style={{ color: '#7bd0ff', fontVariationSettings: "'FILL' 1" }}>table_restaurant</span>
              <div>
                <p className="text-sm font-bold" style={{ color: '#7bd0ff' }}>Mesa quitada!</p>
                <p className="text-xs mt-1 leading-relaxed" style={{ color: '#a78b7d' }}>
                  A conta da mesa {tableNumber} foi paga por completo. A mesa já está liberada para novos clientes no restaurante.
                </p>
              </div>
            </div>
          )}
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
                {formatCurrency(getAmountToPay())}
              </p>
            </div>
          </div>
          {splitAlcohol && confirmationCode && confirmationCode2 ? (
            /* Two receipts */
            <div className="w-full space-y-3">
              <div className="rounded-xl p-5 flex flex-col items-center gap-3"
                style={{ background: 'linear-gradient(135deg,#1e293b,#0f172a)', border: '1px solid rgba(52,211,153,0.3)' }}>
                <p className="text-[10px] font-mono uppercase tracking-widest" style={{ color: '#34d399' }}>🍽️ Recibo Alimentação (Empresa)</p>
                <div className="bg-white rounded-xl px-6 py-4">
                  <p className="text-3xl font-black tracking-widest" style={{ color: '#0b1326' }}>{confirmationCode}</p>
                </div>
                <p className="text-xs text-center" style={{ color: '#34d399' }}>
                  {formatCurrency(alcoholPaymentAmounts().food)} · Reembolsável
                </p>
              </div>
              <div className="rounded-xl p-5 flex flex-col items-center gap-3"
                style={{ background: 'linear-gradient(135deg,#1e293b,#0f172a)', border: '1px solid rgba(249,115,22,0.3)' }}>
                <p className="text-[10px] font-mono uppercase tracking-widest" style={{ color: '#f97316' }}>🍷 Recibo Bebidas (Pessoal)</p>
                <div className="bg-white rounded-xl px-6 py-4">
                  <p className="text-3xl font-black tracking-widest" style={{ color: '#0b1326' }}>{confirmationCode2}</p>
                </div>
                <p className="text-xs text-center" style={{ color: '#a78b7d' }}>
                  {formatCurrency(alcoholPaymentAmounts().alcohol)} · Conta pessoal
                </p>
              </div>
              <p className="text-xs text-center leading-relaxed" style={{ color: '#a78b7d' }}>
                Ambos os recibos foram enviados para o seu WhatsApp 📱
              </p>
            </div>
          ) : (
            <div className="w-full rounded-xl p-6 flex flex-col items-center gap-4"
              style={{ background: 'linear-gradient(135deg,#1e293b,#0f172a)', border: '1px solid #334155' }}>
              <p className="text-[10px] font-mono uppercase tracking-widest" style={{ color: '#a78b7d' }}>Código de validação</p>
              <div className="bg-white rounded-xl px-8 py-5">
                <p className="text-4xl font-black tracking-widest" style={{ color: '#0b1326' }}>{confirmationCode}</p>
              </div>
              <p className="text-xs text-center max-w-[220px] leading-relaxed" style={{ color: '#e0c0b1' }}>
                Apresente ao garçom para liberar a saída · Recibo enviado no WhatsApp 📱
              </p>
            </div>
          )}
          {closeMode === 'table' && selectedParts.filter(p => !p.isMe).length > 0 && (
            <div className="w-full rounded-xl p-4 flex items-start gap-3"
              style={{ background: 'rgba(123,208,255,0.08)', border: '1px solid rgba(123,208,255,0.15)' }}>
              <span className="material-symbols-outlined text-[18px] shrink-0 mt-0.5" style={{ color: '#7bd0ff' }}>notifications</span>
              <p className="text-xs leading-relaxed" style={{ color: '#7bd0ff' }}>
                {selectedParts.filter(p => !p.isMe).map(p => p.name.split(' ')[0]).join(', ')} foram notificados com seus respectivos valores para pagar.
              </p>
            </div>
          )}
          {closeMode === 'individual' && (myIndividualTotal - myOpen.openTotal) > 0.01 && (
            <div className="w-full rounded-xl p-4 flex items-start gap-3"
              style={{ background: 'rgba(52,211,153,0.08)', border: '1px solid rgba(52,211,153,0.2)' }}>
              <span className="material-symbols-outlined text-[18px] shrink-0 mt-0.5" style={{ color: '#34d399' }}>savings</span>
              <p className="text-xs leading-relaxed" style={{ color: '#34d399' }}>
                <strong>+{formatCurrency(myIndividualTotal - myOpen.openTotal)}</strong> ficaram como saldo na mesa. Os outros pagantes vão se beneficiar. 💛
              </p>
            </div>
          )}
          <p className="text-base font-semibold" style={{ color: '#e0c0b1' }}>Volte sempre!</p>
        </main>
        <CustomerBottomNav slug={params.slug} sessionId={sessionId ?? ''} />
      </div>
    )
  }

  // ── PIX / CARD ─────────────────────────────────────────────
  const isTableMode = closeMode === 'table'

  if (step === 'pix') {
    return (
      <div className="min-h-screen flex flex-col" style={{ background: '#0b1326', color: '#dae2fd' }}>
        <header className="sticky top-0 z-40 flex items-center px-6 h-16"
          style={{ background: 'rgba(11,19,38,0.9)', borderBottom: '1px solid rgba(88,66,55,0.3)', backdropFilter: 'blur(12px)' }}>
          <h1 className="text-base font-semibold" style={{ fontFamily: 'Geist, sans-serif' }}>Pagamento · PIX</h1>
        </header>
        <main className="flex-1 px-6 py-6 pb-28">
          <PixScreen
            suggestedAmount={getAmountToPay()}
            fixedAmount={isTableMode}
            pixQrCodeImage={pixQrCodeImage}
            pixPayload={pixPayload}
            pixExpiration={pixExpiration}
            onConfirmManual={confirmPixManually}
            onBack={() => setStep('mode')}
            loading={paying}
          />
        </main>
        <CustomerBottomNav slug={params.slug} sessionId={sessionId ?? ''} />
      </div>
    )
  }

  if (step === 'card') {
    return (
      <div className="min-h-screen flex flex-col" style={{ background: '#0b1326', color: '#dae2fd' }}>
        <header className="sticky top-0 z-40 flex items-center px-6 h-16"
          style={{ background: 'rgba(11,19,38,0.9)', borderBottom: '1px solid rgba(88,66,55,0.3)', backdropFilter: 'blur(12px)' }}>
          <h1 className="text-base font-semibold" style={{ fontFamily: 'Geist, sans-serif' }}>
            Pagamento · {method === 'credit' ? 'Crédito' : 'Débito'}
          </h1>
        </header>
        <main className="flex-1 px-6 py-6 pb-28">
          <CardScreen
            method={method as 'debit' | 'credit'}
            suggestedAmount={getAmountToPay()}
            fixedAmount={isTableMode}
            onConfirm={async (amount, cardData) => {
              const confirmed = await processPayment(amount, cardData)
              if (confirmed) setStep('confirmed')
            }}
            onBack={() => setStep('mode')}
            loading={paying}
          />
        </main>
        <CustomerBottomNav slug={params.slug} sessionId={sessionId ?? ''} />
      </div>
    )
  }

  // ── MODE + SUMMARY ─────────────────────────────────────────
  const canProceed = closeMode === 'individual'
    ? (!hasPaidMyShare && getAmountToPay() >= 0.01)
    : (selectedIds.size > 0 && (splitType === 'equal' || customSumOk))

  const showPaymentFlow = !(closeMode === 'individual' && hasPaidMyShare)

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

      <main className="flex-1 px-6 py-6 pb-56 space-y-5">

        {/* ── Saldo já pago ───────────────────────────── */}
        {sessionPaidTotal > 0 && (
          <div className="rounded-xl px-4 py-3 flex items-center gap-3"
            style={{ background: 'rgba(52,211,153,0.08)', border: '1px solid rgba(52,211,153,0.2)' }}>
            <span className="material-symbols-outlined text-[18px]" style={{ color: '#34d399' }}>savings</span>
            <div>
              <p className="text-xs font-semibold" style={{ color: '#34d399' }}>
                Saldo já pago: {formatCurrency(sessionPaidTotal)}
              </p>
              <p className="text-[10px]" style={{ color: '#a78b7d' }}>
                Total da mesa: {formatCurrency(sessionGrandTotal)} → Restante: {formatCurrency(remaining)}
              </p>
            </div>
          </div>
        )}

        {/* ── Modo de fechamento ──────────────────────── */}
        <section className="space-y-3">
          <p className="text-[10px] font-mono uppercase tracking-widest" style={{ color: '#a78b7d' }}>Como você quer pagar?</p>
          <div className="grid grid-cols-2 gap-3">
            {([
              { mode: 'individual' as CloseMode, icon: 'person',  title: 'Só a minha parte', desc: 'Pago apenas meu consumo' },
              { mode: 'table'      as CloseMode, icon: 'groups',  title: 'Fechar mesa toda',  desc: 'Inicia fechamento coletivo' },
            ]).map(opt => {
              const individualDone = opt.mode === 'individual' && hasPaidMyShare
              return (
              <button
                key={opt.mode}
                disabled={individualDone}
                onClick={() => {
                  if (individualDone) return
                  setCloseMode(opt.mode)
                }}
                className="flex flex-col items-start gap-2 p-4 rounded-xl text-left transition-all active:scale-95 disabled:opacity-60"
                style={{
                  background: closeMode === opt.mode ? 'rgba(249,115,22,0.12)' : 'rgba(30,41,59,0.7)',
                  border: `2px solid ${individualDone ? '#34d399' : closeMode === opt.mode ? '#f97316' : '#334155'}`,
                }}>
                <span className="material-symbols-outlined text-[24px]"
                  style={{ color: individualDone ? '#34d399' : closeMode === opt.mode ? '#f97316' : '#a78b7d', fontVariationSettings: (closeMode === opt.mode || individualDone) ? "'FILL' 1" : "'FILL' 0" }}>
                  {individualDone ? 'check_circle' : opt.icon}
                </span>
                <div>
                  <p className="text-sm font-bold" style={{ color: individualDone ? '#34d399' : closeMode === opt.mode ? '#ffb690' : '#dae2fd', fontFamily: 'Geist, sans-serif' }}>
                    {individualDone ? 'Parte quitada ✓' : opt.title}
                  </p>
                  <p className="text-[11px] mt-0.5" style={{ color: '#a78b7d' }}>
                    {individualDone
                      ? `${formatCurrency(myAlreadyPaid)} pagos`
                      : opt.desc}
                  </p>
                </div>
              </button>
            )})}
          </div>
        </section>

        {/* ── Individual: meu consumo + extra opcional ── */}
        {closeMode === 'individual' && hasPaidMyShare && (
          <section className="space-y-3">
            <div className="rounded-xl px-5 py-4 flex items-start gap-3"
              style={{ background: 'rgba(52,211,153,0.1)', border: '1px solid rgba(52,211,153,0.35)' }}>
              <span className="material-symbols-outlined text-[24px] shrink-0" style={{ color: '#34d399', fontVariationSettings: "'FILL' 1" }}>check_circle</span>
              <div>
                <p className="text-sm font-bold" style={{ color: '#34d399' }}>Sua parte já está quitada!</p>
                <p className="text-xs mt-1 leading-relaxed" style={{ color: '#a78b7d' }}>
                  Você pagou {formatCurrency(myAlreadyPaid)} do seu consumo de {formatCurrency(myConsumptionFull)}.
                  {remaining > 0.01
                    ? ` Falta ${formatCurrency(remaining)} para fechar a mesa — aguarde os outros ou use "Fechar mesa toda".`
                    : ' A mesa está totalmente paga!'}
                </p>
              </div>
            </div>
          </section>
        )}

        {closeMode === 'individual' && !hasPaidMyShare && (
          <section className="space-y-3">
            {/* Crédito da mesa (pagamentos de outros) reduz o que falta */}
            {tableCreditForMe > 0.01 && myIndividualBase > 0.01 && (
              <div className="rounded-xl px-4 py-3 flex items-start gap-3"
                style={{ background: 'rgba(52,211,153,0.1)', border: '1px solid rgba(52,211,153,0.3)' }}>
                <span className="material-symbols-outlined text-[20px] shrink-0 mt-0.5" style={{ color: '#34d399' }}>celebration</span>
                <div>
                  <p className="text-sm font-bold" style={{ color: '#34d399' }}>
                    Saldo da mesa reduziu o seu valor!
                  </p>
                  <p className="text-xs mt-0.5 leading-relaxed" style={{ color: '#a78b7d' }}>
                    Seu saldo em aberto é {formatCurrency(myOpen.openTotal)}
                    {myAlreadyPaid > 0.01 && ` (já pagou ${formatCurrency(myAlreadyPaid)})`}.
                    {' '}Pagamentos na mesa cobrem {formatCurrency(tableCreditForMe)} — você paga apenas {formatCurrency(myIndividualBase)}.
                  </p>
                </div>
              </div>
            )}

            {/* Alcohol split option */}
            {alcoholSplit.hasAlcohol && !splitAlcohol && !alcoholSplitDismissed && (
              <div className="rounded-xl p-4 flex items-start gap-3"
                style={{ background: 'rgba(249,115,22,0.08)', border: '1px solid rgba(249,115,22,0.25)' }}>
                <span className="text-xl shrink-0 mt-0.5">🍷</span>
                <div className="flex-1">
                  <p className="text-sm font-semibold" style={{ color: '#ffb690' }}>
                    Você tem bebidas alcoólicas na conta
                  </p>
                  <p className="text-xs mt-0.5 leading-relaxed" style={{ color: '#a78b7d' }}>
                    Deseja separar alimentação e bebidas em recibos diferentes?
                  </p>
                  <div className="flex gap-2 mt-3">
                    <button onClick={() => {
                      setSplitAlcohol(true)
                      if (sessionId) sessionStorage.setItem(`qomanda_split_alcohol_${sessionId}`, 'true')
                    }}
                      className="text-xs font-mono font-bold px-4 py-2 rounded-lg active:scale-95 transition-all"
                      style={{ background: '#f97316', color: '#582200' }}>
                      Sim, separar recibos
                    </button>
                    <button
                      type="button"
                      onClick={() => setAlcoholSplitDismissed(true)}
                      className="text-xs font-mono px-4 py-2 rounded-lg transition-all active:scale-95"
                      style={{ background: 'transparent', border: '1px solid rgba(88,66,55,0.4)', color: '#a78b7d' }}>
                      Não, pagar tudo junto
                    </button>
                  </div>
                </div>
              </div>
            )}

            {splitAlcohol && (() => {
              const { food, alcohol } = alcoholPaymentAmounts()
              const feeOnFood = includeServiceFee && (alcoholSplit.serviceFeeOnFood ?? 0) > 0.01
              return (
              <div className="rounded-xl overflow-hidden" style={{ border: '1px solid #334155' }}>
                <div className="px-4 py-3 flex items-center gap-2"
                  style={{ background: 'rgba(52,211,153,0.06)', borderBottom: '1px solid rgba(88,66,55,0.2)' }}>
                  <span className="material-symbols-outlined text-[16px]" style={{ color: '#34d399' }}>call_split</span>
                  <span className="text-xs font-mono font-bold uppercase tracking-wider" style={{ color: '#34d399' }}>
                    Recibos separados ativado
                  </span>
                  <button onClick={() => {
                    setSplitAlcohol(false)
                    setAlcoholSplitDismissed(false)
                    if (sessionId) sessionStorage.removeItem(`qomanda_split_alcohol_${sessionId}`)
                  }}
                    className="ml-auto text-[10px] font-mono" style={{ color: '#584237' }}>
                    Desfazer
                  </button>
                </div>
                <div className="divide-y" style={{ borderColor: 'rgba(88,66,55,0.2)' }}>
                  <div className="flex items-center justify-between px-4 py-3">
                    <div>
                      <p className="text-sm font-semibold" style={{ color: '#dae2fd' }}>🍽️ Alimentação</p>
                      {feeOnFood && (
                        <p className="text-[10px] font-mono mt-0.5" style={{ color: '#a78b7d' }}>
                          inclui taxa de serviço ({formatCurrency(alcoholSplit.serviceFeeOnFood!)})
                        </p>
                      )}
                    </div>
                    <p className="text-base font-black font-mono" style={{ color: '#34d399' }}>
                      {formatCurrency(food)}
                    </p>
                  </div>
                  <div className="flex items-center justify-between px-4 py-3">
                    <div>
                      <p className="text-sm font-semibold" style={{ color: '#dae2fd' }}>🍷 Bebidas Alcoólicas</p>
                      <p className="text-[10px] font-mono" style={{ color: '#a78b7d' }}>
                        Conta pessoal{feeOnFood ? ' · sem taxa' : ''}
                      </p>
                    </div>
                    <p className="text-base font-black font-mono" style={{ color: '#ffb690' }}>
                      {formatCurrency(alcohol)}
                    </p>
                  </div>
                </div>
                <div className="px-4 py-3" style={{ borderTop: '1px solid rgba(88,66,55,0.2)', background: 'rgba(30,41,59,0.5)' }}>
                  <p className="text-xs leading-relaxed" style={{ color: '#a78b7d' }}>
                    Você receberá <strong style={{ color: '#dae2fd' }}>2 recibos</strong> no WhatsApp — alimentação (RH{feeOnFood ? ', com taxa de serviço' : ''}) e bebidas (pessoal, sem taxa).
                  </p>
                </div>
              </div>
              )
            })()}

            {remaining <= 0 && (
              <div className="rounded-xl px-4 py-3 flex items-start gap-3"
                style={{ background: 'rgba(52,211,153,0.1)', border: '1px solid rgba(52,211,153,0.3)' }}>
                <span className="material-symbols-outlined text-[20px] shrink-0" style={{ color: '#34d399', fontVariationSettings: "'FILL' 1" }}>check_circle</span>
                <p className="text-sm font-bold" style={{ color: '#34d399' }}>
                  A conta da mesa já está totalmente coberta! Nenhum pagamento necessário.
                </p>
              </div>
            )}

            <div className="rounded-xl p-5 space-y-3"
              style={{ background: 'rgba(30,41,59,0.7)', border: '1px solid #334155', backdropFilter: 'blur(12px)' }}>
              <div className="flex justify-between items-center">
                <div>
                  <span className="text-sm font-semibold" style={{ color: '#dae2fd' }}>Saldo em aberto</span>
                  {myAlreadyPaid > 0.01 && (
                    <p className="text-[10px] font-mono mt-0.5" style={{ color: '#34d399' }}>
                      Já pago: {formatCurrency(myAlreadyPaid)}
                    </p>
                  )}
                  {myOpen.openSubtotal < mySubtotal - 0.01 && (
                    <p className="text-[10px] font-mono mt-0.5" style={{ color: '#a78b7d' }}>
                      Subtotal pendente: {formatCurrency(myOpen.openSubtotal)}
                      {!includeServiceFee && ' (sem taxa)'}
                    </p>
                  )}
                </div>
                <span className="text-2xl font-black" style={{ color: '#f97316', fontFamily: 'Geist, sans-serif' }}>
                  {formatCurrency(myIndividualBase)}
                </span>
              </div>

              {/* Extra contribution — only makes sense if they can still pay */}
              {myIndividualBase > 0.01 && (
                <div style={{ borderTop: '1px solid rgba(88,66,55,0.3)', paddingTop: 12 }}>
                  <p className="text-[10px] font-mono uppercase tracking-wider mb-2" style={{ color: '#a78b7d' }}>
                    Contribuição extra para a mesa (opcional)
                  </p>
                  <div className="flex items-center gap-3">
                    <div className="relative flex-1">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm" style={{ color: '#a78b7d' }}>R$</span>
                      <input
                        type="number" step="0.01" min="0" placeholder="0,00" value={extraAmount}
                        onChange={e => setExtraAmount(e.target.value)}
                        className="w-full h-11 pl-9 pr-3 rounded-lg font-mono outline-none text-sm"
                        style={{ background: '#0b1326', border: '1px solid #584237', color: '#dae2fd' }}
                        onFocus={e => (e.target.style.borderColor = '#f97316')}
                        onBlur={e => (e.target.style.borderColor = '#584237')}
                      />
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-[10px] font-mono" style={{ color: '#a78b7d' }}>Total a pagar</p>
                      <p className="text-lg font-black" style={{ color: '#ffb690', fontFamily: 'Geist, sans-serif' }}>
                        {formatCurrency(myIndividualTotal)}
                      </p>
                    </div>
                  </div>
                  {(parseFloat(extraAmount) || 0) > 0.01 && (
                    <p className="text-xs mt-2 leading-relaxed" style={{ color: '#34d399' }}>
                      O valor extra vira saldo da mesa — quem pagar por último pagará menos.
                    </p>
                  )}
                </div>
              )}
            </div>
          </section>
        )}

        {/* ── Mesa Toda: participantes + divisão ─────── */}
        {closeMode === 'table' && (
          <section className="space-y-4">
            {/* Participant selection */}
            <div className="space-y-2">
              <p className="text-[10px] font-mono uppercase tracking-widest" style={{ color: '#a78b7d' }}>
                Quem vai dividir? (você é o iniciador — obrigatório)
              </p>
              <div className="rounded-xl overflow-hidden" style={{ border: '1px solid #334155' }}>
                {participants.map((p, i) => {
                  const sel    = selectedIds.has(p.id)
                  const locked = p.isMe
                  return (
                    <button key={p.id} onClick={() => toggleParticipant(p.id)}
                      className="w-full flex items-center gap-3 px-4 py-3.5 text-left"
                      style={{
                        background: sel ? 'rgba(249,115,22,0.08)' : 'rgba(30,41,59,0.7)',
                        borderTop: i > 0 ? '1px solid rgba(51,65,85,0.5)' : 'none',
                        cursor: locked ? 'not-allowed' : 'pointer',
                      }}>
                      <div className="w-5 h-5 rounded flex items-center justify-center shrink-0 relative"
                        style={{
                          background: sel ? '#f97316' : 'transparent',
                          border: `2px solid ${sel ? '#f97316' : '#584237'}`,
                        }}>
                        {sel && <span className="material-symbols-outlined text-[13px]" style={{ color: '#582200', fontVariationSettings: "'FILL' 1" }}>check</span>}
                        {locked && <span className="absolute -top-1.5 -right-1.5 material-symbols-outlined text-[10px]" style={{ color: '#f97316' }}>lock</span>}
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-semibold" style={{ color: '#dae2fd' }}>
                          {p.name}
                          {p.isMe && <span className="text-[10px] font-mono ml-2" style={{ color: '#34d399' }}>(você · iniciador)</span>}
                        </p>
                        {p.myConsumption > 0 && (
                          <p className="text-xs font-mono" style={{ color: '#a78b7d' }}>Consumiu {formatCurrency(p.myConsumption)}</p>
                        )}
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Split type */}
            <div className="space-y-3">
              <div className="flex gap-2 p-1 rounded-xl" style={{ background: '#131b2e', border: '1px solid rgba(88,66,55,0.35)' }}>
                {([
                  { type: 'equal' as SplitType, label: '= Dividir igualmente' },
                  { type: 'custom' as SplitType, label: '≠ Definir valores'   },
                ]).map(opt => (
                  <button key={opt.type} onClick={() => setSplitType(opt.type)}
                    className="flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all"
                    style={{
                      background: splitType === opt.type ? '#f97316' : 'transparent',
                      color: splitType === opt.type ? '#582200' : '#a78b7d',
                      fontFamily: 'Geist, sans-serif',
                    }}>
                    {opt.label}
                  </button>
                ))}
              </div>

              {/* Per-person amounts */}
              <div className="rounded-xl overflow-hidden" style={{ border: '1px solid #334155' }}>
                {selectedParts.map((p, i) => (
                  <div key={p.id} className="flex items-center gap-3 px-4 py-3"
                    style={{ borderTop: i > 0 ? '1px solid rgba(51,65,85,0.4)' : 'none', background: 'rgba(30,41,59,0.5)' }}>
                    <div className="flex-1">
                      <p className="text-sm font-semibold" style={{ color: '#dae2fd' }}>{p.name}</p>
                      {p.isMe && <p className="text-[10px] font-mono" style={{ color: '#34d399' }}>você</p>}
                    </div>
                    {splitType === 'equal' ? (
                      <div className="flex items-center gap-1 h-10 px-3 rounded-lg"
                        style={{ background: '#0b1326', border: '1px solid #584237' }}>
                        <span className="text-sm" style={{ color: '#a78b7d' }}>R$</span>
                        <span className="font-bold font-mono text-sm" style={{ color: '#ffb690' }}>
                          {equalShare.toFixed(2).replace('.', ',')}
                        </span>
                      </div>
                    ) : (
                      <div className="relative">
                        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs" style={{ color: '#a78b7d' }}>R$</span>
                        <input
                          type="number" step="0.01" min="0"
                          value={customAmounts[p.id] ?? ''}
                          onChange={e => setParticipantAmount(p.id, e.target.value)}
                          className="w-28 h-10 pl-7 pr-2 rounded-lg text-sm font-mono font-bold outline-none"
                          style={{ background: '#0b1326', border: `1px solid ${customSumOk ? '#f97316' : '#f87171'}`, color: '#dae2fd' }}
                        />
                      </div>
                    )}
                  </div>
                ))}

                {/* Sum indicator */}
                <div className="flex justify-between items-center px-4 py-3"
                  style={{
                    borderTop: '1px solid rgba(88,66,55,0.3)',
                    background: customSumOk || splitType === 'equal' ? 'rgba(52,211,153,0.06)' : 'rgba(248,113,113,0.06)',
                  }}>
                  <p className="text-xs font-mono uppercase tracking-wider"
                    style={{ color: customSumOk || splitType === 'equal' ? '#34d399' : '#f87171' }}>
                    {splitType === 'equal'
                      ? `Total: ${formatCurrency(remaining)} ✓`
                      : customSumOk
                        ? `Total: ${formatCurrency(customSum)} ✓ Fechado!`
                        : `Total definido: ${formatCurrency(customSum)} — Falta ${formatCurrency(remaining - customSum)}`
                    }
                  </p>
                  <p className="text-xs font-mono" style={{ color: '#a78b7d' }}>
                    Necessário: {formatCurrency(remaining)}
                  </p>
                </div>
              </div>

              {splitType === 'custom' && !customSumOk && (
                <p className="text-xs text-center" style={{ color: '#f87171' }}>
                  A soma dos valores deve ser exatamente {formatCurrency(remaining)}
                </p>
              )}
            </div>
          </section>
        )}

        {/* ── Taxa de serviço opcional ────────────────── */}
        <section>
          <div className="flex items-center justify-between rounded-xl px-4 py-3.5"
            style={{ background: '#1e293b', border: '1px solid #334155' }}>
            <div>
              <p className="text-sm font-semibold" style={{ color: '#dae2fd' }}>Taxa de serviço (10%)</p>
              <p className="text-xs mt-0.5 leading-relaxed" style={{ color: '#a78b7d' }}>
                {includeServiceFee
                  ? serviceFeeOpenBase > 0.01
                    ? `+ ${formatCurrency(serviceFeeDisplay)} incluídos (sobre ${formatCurrency(serviceFeeOpenBase)} em aberto ${closeMode === 'individual' ? 'da sua conta' : 'da mesa'})`
                    : 'Nada em aberto para aplicar taxa'
                  : serviceFeeOpenBase > 0.01
                    ? `Sem taxa — você paga ${formatCurrency(closeMode === 'individual' ? myOpen.openSubtotal : sessionOpen.openSubtotal)} de consumo`
                    : 'Você optou por não incluir a taxa de serviço'}
              </p>
              {!includeServiceFee && (
                <p className="text-[10px] font-mono mt-1" style={{ color: '#584237' }}>
                  A taxa é individual; outros da mesa podem incluir normalmente.
                </p>
              )}
            </div>
            <button
              onClick={() => setIncludeServiceFee(v => !v)}
              className="relative w-11 h-6 rounded-full transition-colors shrink-0 ml-4"
              style={{ background: includeServiceFee ? '#f97316' : '#334155' }}>
              <span className="absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all"
                style={{ left: includeServiceFee ? '1.375rem' : '0.125rem' }} />
            </button>
          </div>
        </section>

        {/* ── Método de pagamento ─────────────────────── */}
        {showPaymentFlow && (
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
                }}>
                <span className="material-symbols-outlined text-[22px]" style={{ color: method === m.value ? '#f97316' : '#e0c0b1' }}>{m.icon}</span>
                <span className="text-xs font-mono" style={{ color: method === m.value ? '#f97316' : '#e0c0b1' }}>{m.label}</span>
              </button>
            ))}
          </div>
        </section>
        )}
      </main>

      {/* CTA */}
      {showPaymentFlow && (
      <div className="fixed bottom-20 left-0 right-0 px-6 py-3 z-40"
        style={{ background: 'rgba(11,19,38,0.9)', backdropFilter: 'blur(12px)', borderTop: '1px solid rgba(88,66,55,0.2)' }}>
        <button
          onClick={handleProceed}
          disabled={!canProceed}
          className="w-full h-14 rounded-full font-semibold flex items-center justify-center gap-2 active:scale-95 transition-all disabled:opacity-40"
          style={{ background: '#f97316', color: '#582200', boxShadow: '0 8px 30px rgba(249,115,22,0.3)', fontFamily: 'Geist, sans-serif' }}>
          Confirmar e Ir para Pagamento
          <span className="material-symbols-outlined">arrow_forward</span>
        </button>
      </div>
      )}

      <CustomerBottomNav slug={params.slug} sessionId={sessionId ?? ''} />
    </div>
  )
}
