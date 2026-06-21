'use client'

import { useEffect, useMemo, useState, useCallback } from 'react'
import { useParams, useSearchParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { PaymentMethod } from '@/types'
import { formatCurrency, generateConfirmationCode } from '@/lib/utils'
import { splitConsumptionByAlcohol, splitPaymentAmounts } from '@/lib/alcohol-split'
import { buildReceiptWhatsAppMessage, type PaymentReceiptRecord } from '@/lib/payment-receipt'
import { PaymentReceiptList } from '@/components/payment-receipt-list'
import Link from 'next/link'
import {
  SERVICE_FEE_RATE,
  computeOpenBalance,
  paymentSubtotalCredit,
  amountWithServiceFee,
  amountWithServiceFeeExCouvert,
  unpaidOrderLineItems,
  roundMoney,
  isBillableItem,
  orderItemLineTotal,
} from '@/lib/session-billing'
import type { Order } from '@/types'
import { CustomerBottomNav } from '@/components/customer/bottom-nav'
import { CardPaymentScreen, type CardPaymentPayload } from '@/components/customer/card-payment-screen'
import {
  type CustomerOffer,
  computeOfferDiscount,
  isOfferRedeemable,
} from '@/lib/customer-offers'
import { customerAuthFetch } from '@/lib/customer-auth'
import {
  computeSplitGate,
  buildSplitInviteMessage,
  type ActiveCloseRequest,
} from '@/lib/close-request'
import type { PublicPaymentConfig } from '@/lib/restaurant-payment-config'
import { MANUAL_PIX_KEY_TYPE_LABELS } from '@/lib/restaurant-payment-config'
import { formatServiceLocationLabel } from '@/lib/counter-orders'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'

type SessionPaymentRow = PaymentReceiptRecord & { customer_id: string | null }

type CloseMode = 'individual' | 'table'
type SplitType = 'equal' | 'custom'
type Step      = 'mode' | 'pix' | 'card' | 'cash_amount' | 'cash_pending' | 'manual_pix' | 'manual_pix_pending' | 'confirmed'

// ── PIX manual — chave do restaurante ────────────────────────
function ManualPixScreen({
  suggestedAmount,
  fixedAmount,
  manual,
  onSubmit,
  onBack,
  loading,
  splitInfo,
}: {
  suggestedAmount: number
  fixedAmount: boolean
  manual: NonNullable<PublicPaymentConfig['manual']>
  onSubmit: (amount: number) => void
  onBack: () => void
  loading: boolean
  splitInfo?: { food: number; alcohol: number } | null
}) {
  const [amount, setAmount] = useState(suggestedAmount.toFixed(2))
  const [copied, setCopied] = useState(false)
  const parsedAmt = parseFloat(amount.replace(',', '.')) || 0
  const extraAmt = parsedAmt - suggestedAmount
  const valid = parsedAmt >= suggestedAmount - 0.02

  function copyPixKey() {
    navigator.clipboard.writeText(manual.pixKey).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  const bankLine = manual.bankAccount
    ? [manual.bankName, manual.bankAgency ? `Ag ${manual.bankAgency}` : null, manual.bankAccount + (manual.bankAccountDigit ? `-${manual.bankAccountDigit}` : '')]
        .filter(Boolean)
        .join(' · ')
    : null

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="p-2 -ml-2 rounded-full" style={{ color: '#ffb690' }}>
          <span className="material-symbols-outlined">arrow_back</span>
        </button>
        <h2 className="text-lg font-semibold" style={{ fontFamily: 'Geist, sans-serif' }}>PIX do restaurante</h2>
      </div>

      <div className="rounded-xl p-5 space-y-4"
        style={{ background: 'linear-gradient(135deg,#1e293b,#0f172a)', border: '1px solid #334155' }}>
        {manual.holderName && (
          <p className="text-sm font-semibold text-center" style={{ color: '#dae2fd' }}>{manual.holderName}</p>
        )}
        <div className="flex flex-col items-center gap-2">
          <span className="material-symbols-outlined text-[48px]" style={{ color: '#34d399' }}>qr_code_2</span>
          <p className="text-[10px] font-mono uppercase tracking-wider" style={{ color: '#a78b7d' }}>
            {manual.pixKeyType ? MANUAL_PIX_KEY_TYPE_LABELS[manual.pixKeyType] : 'Chave PIX'}
          </p>
        </div>
        <div className="flex items-center gap-2 rounded-xl px-4 py-3"
          style={{ background: '#0b1326', border: '1px solid #334155' }}>
          <span className="flex-1 text-sm font-mono break-all" style={{ color: '#dae2fd' }}>{manual.pixKey}</span>
          <button onClick={copyPixKey}
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
        {bankLine && (
          <p className="text-xs text-center font-mono" style={{ color: '#a78b7d' }}>Conta: {bankLine}</p>
        )}
        {manual.notes && (
          <p className="text-xs text-center leading-relaxed" style={{ color: '#e0c0b1' }}>{manual.notes}</p>
        )}
        <p className="text-xs text-center leading-relaxed" style={{ color: '#e0c0b1' }}>
          Transfira o valor abaixo para esta chave. O pagamento cai direto na conta do restaurante.
        </p>
      </div>

      <div className="rounded-xl p-4 space-y-2" style={{ background: '#1e293b', border: '1px solid #334155' }}>
        <div className="flex justify-between items-center">
          <span className="text-[10px] font-mono uppercase tracking-wider" style={{ color: '#a78b7d' }}>
            {fixedAmount ? 'Valor a pagar (definido)' : 'Valor a transferir'}
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
          </div>
        ) : (
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm" style={{ color: '#a78b7d' }}>R$</span>
            <input type="number" step="0.01" min={suggestedAmount.toFixed(2)} value={amount}
              onChange={e => setAmount(e.target.value)}
              className="w-full h-12 pl-9 pr-3 rounded-lg text-base font-bold font-mono outline-none"
              style={{ background: '#0b1326', border: `1px solid ${valid ? '#f97316' : '#f87171'}`, color: '#dae2fd' }}
            />
          </div>
        )}
        {!fixedAmount && extraAmt > 0.01 && (
          <p className="text-xs" style={{ color: '#34d399' }}>+{formatCurrency(extraAmt)} virará saldo da mesa.</p>
        )}
      </div>

      {splitInfo && (
        <div className="rounded-xl p-4 space-y-2"
          style={{ background: 'rgba(52,211,153,0.06)', border: '1px solid rgba(52,211,153,0.2)' }}>
          <p className="text-[10px] font-mono uppercase tracking-widest" style={{ color: '#a78b7d' }}>
            Divisão para reembolso
          </p>
          <div className="flex justify-between text-sm">
            <span style={{ color: '#34d399' }}>🍽️ Alimentação (empresa)</span>
            <span className="font-mono font-semibold" style={{ color: '#34d399' }}>{formatCurrency(splitInfo.food)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span style={{ color: '#a78b7d' }}>🍷 Bebidas (pessoal)</span>
            <span className="font-mono font-semibold" style={{ color: '#a78b7d' }}>{formatCurrency(splitInfo.alcohol)}</span>
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={() => onSubmit(fixedAmount ? suggestedAmount : parsedAmt)}
        disabled={loading || !valid}
        className="w-full h-14 rounded-full font-semibold flex items-center justify-center gap-2 active:scale-95 transition-all disabled:opacity-40"
        style={{ background: '#34d399', color: '#064e3b', boxShadow: '0 8px 30px rgba(52,211,153,0.25)', fontFamily: 'Geist, sans-serif' }}
      >
        {loading ? <><Loader2 className="h-5 w-5 animate-spin" /> Registrando...</> : (
          <><span className="material-symbols-outlined">check_circle</span> Já transferi — avisar restaurante</>
        )}
      </button>
    </div>
  )
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
        A confirmação automática chega em instantes após o pagamento.
      </p>
    </div>
  )
}

// ── Dinheiro — informar valor a pagar ────────────────────────
function CashAmountScreen({
  minimumOwed,
  amount,
  onAmountChange,
  onSubmit,
  onBack,
  loading,
  splitInfo,
}: {
  minimumOwed: number
  amount: string
  onAmountChange: (value: string) => void
  onSubmit: () => void
  onBack: () => void
  loading: boolean
  splitInfo?: { food: number; alcohol: number } | null
}) {
  const parsed = parseFloat(amount.replace(',', '.')) || 0
  const extra = Math.max(0, roundMoney(parsed - minimumOwed))
  const valid = parsed >= minimumOwed - 0.02

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="p-2 -ml-2 rounded-full" style={{ color: '#ffb690' }}>
          <span className="material-symbols-outlined">arrow_back</span>
        </button>
        <h2 className="text-lg font-semibold" style={{ fontFamily: 'Geist, sans-serif' }}>Quanto vai pagar?</h2>
      </div>

      <div className="rounded-xl p-5 space-y-4"
        style={{ background: 'rgba(30,41,59,0.7)', border: '1px solid #334155' }}>
        <div>
          <p className="text-[10px] font-mono uppercase tracking-wider mb-2" style={{ color: '#a78b7d' }}>
            Valor em dinheiro
          </p>
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-lg font-mono" style={{ color: '#a78b7d' }}>R$</span>
            <input
              type="number"
              step="0.01"
              min={minimumOwed}
              value={amount}
              onChange={e => onAmountChange(e.target.value)}
              className="w-full h-14 pl-12 pr-4 rounded-xl font-mono text-2xl font-black outline-none"
              style={{ background: '#0b1326', border: '2px solid #584237', color: '#ffb690' }}
              onFocus={e => (e.target.style.borderColor = '#f97316')}
              onBlur={e => (e.target.style.borderColor = '#584237')}
            />
          </div>
          <p className="text-[10px] font-mono mt-2" style={{ color: '#584237' }}>
            Mínimo: {formatCurrency(minimumOwed)} (sua parte nesta mesa)
          </p>
        </div>

        <div className="space-y-2 pt-2" style={{ borderTop: '1px solid rgba(88,66,55,0.3)' }}>
          <div className="flex justify-between text-sm">
            <span style={{ color: '#a78b7d' }}>Sua conta</span>
            <span className="font-mono font-semibold" style={{ color: '#dae2fd' }}>{formatCurrency(minimumOwed)}</span>
          </div>
          {extra > 0.01 && (
            <div className="flex justify-between text-sm">
              <span style={{ color: '#34d399' }}>Extra para a mesa</span>
              <span className="font-mono font-semibold" style={{ color: '#34d399' }}>+ {formatCurrency(extra)}</span>
            </div>
          )}
          <div className="flex justify-between pt-2" style={{ borderTop: '1px solid rgba(88,66,55,0.2)' }}>
            <span className="text-sm font-semibold" style={{ color: '#dae2fd' }}>Total em dinheiro</span>
            <span className="text-xl font-black font-mono" style={{ color: '#f97316' }}>{formatCurrency(valid ? parsed : minimumOwed)}</span>
          </div>
        </div>

        {extra > 0.01 && (
          <p className="text-xs leading-relaxed" style={{ color: '#34d399' }}>
            O extra vira saldo da mesa — quem pagar depois pagará menos.
          </p>
        )}
      </div>

      {splitInfo && (
        <div className="rounded-xl p-4 space-y-2"
          style={{ background: 'rgba(52,211,153,0.06)', border: '1px solid rgba(52,211,153,0.2)' }}>
          <p className="text-[10px] font-mono uppercase tracking-widest" style={{ color: '#a78b7d' }}>
            Divisão para reembolso
          </p>
          <div className="flex justify-between text-sm">
            <span style={{ color: '#34d399' }}>🍽️ Alimentação (empresa)</span>
            <span className="font-mono font-semibold" style={{ color: '#34d399' }}>{formatCurrency(splitInfo.food)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span style={{ color: '#a78b7d' }}>🍷 Bebidas (pessoal)</span>
            <span className="font-mono font-semibold" style={{ color: '#a78b7d' }}>{formatCurrency(splitInfo.alcohol)}</span>
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={onSubmit}
        disabled={loading || !valid}
        className="w-full h-14 rounded-full font-semibold flex items-center justify-center gap-2 active:scale-95 transition-all disabled:opacity-40"
        style={{ background: '#f97316', color: '#582200', boxShadow: '0 8px 30px rgba(249,115,22,0.25)', fontFamily: 'Geist, sans-serif' }}
      >
        {loading ? <><Loader2 className="h-5 w-5 animate-spin" /> Registrando...</> : (
          <><span className="material-symbols-outlined">payments</span> Informar ao restaurante</>
        )}
      </button>
    </div>
  )
}

// ── Dinheiro — aguarda confirmação do restaurante ────────────
function CashPendingScreen({
  amount,
  minimumOwed,
  tableNumber,
  isCounter = false,
  paymentId,
  onBack,
  onCancel,
  cancelling,
  variant = 'cash',
  splitInfo,
}: {
  amount: number
  minimumOwed?: number
  tableNumber: string
  isCounter?: boolean
  paymentId?: string
  onBack: () => void
  onCancel: () => void
  cancelling: boolean
  variant?: 'cash' | 'pix'
  splitInfo?: { food: number; alcohol: number } | null
}) {
  const extra = minimumOwed != null ? Math.max(0, roundMoney(amount - minimumOwed)) : 0
  const isPix = variant === 'pix'
  // Local: "no balcão" (counter), "na Mesa X" (salão) ou genérico
  const localPhrase = isCounter ? ' no balcão' : tableNumber ? ` na Mesa ${tableNumber}` : ''

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="p-2 -ml-2 rounded-full" style={{ color: '#ffb690' }}>
          <span className="material-symbols-outlined">arrow_back</span>
        </button>
        <h2 className="text-lg font-semibold" style={{ fontFamily: 'Geist, sans-serif' }}>
          {isPix ? 'PIX enviado' : 'Pagamento em dinheiro'}
        </h2>
      </div>

      <div className="flex flex-col items-center gap-4 rounded-xl p-6 text-center"
        style={{ background: 'linear-gradient(135deg,#1e293b,#0f172a)', border: '1px solid #334155' }}>
        <div className="w-16 h-16 rounded-full flex items-center justify-center"
          style={{
            background: isPix ? 'rgba(52,211,153,0.12)' : 'rgba(249,115,22,0.12)',
            border: `2px solid ${isPix ? 'rgba(52,211,153,0.35)' : 'rgba(249,115,22,0.35)'}`,
          }}>
          <span className="material-symbols-outlined text-[32px]" style={{ color: isPix ? '#34d399' : '#f97316' }}>
            {isPix ? 'qr_code_2' : 'payments'}
          </span>
        </div>
        <div>
          <p className="text-2xl font-black" style={{ color: '#ffb690', fontFamily: 'Geist, sans-serif' }}>
            {formatCurrency(amount)}
          </p>
          {extra > 0.01 && minimumOwed != null && (
            <p className="text-xs font-mono mt-2" style={{ color: '#34d399' }}>
              Conta {formatCurrency(minimumOwed)} + extra {formatCurrency(extra)} para a mesa
            </p>
          )}
          <p className="text-sm mt-2 leading-relaxed" style={{ color: '#e0c0b1' }}>
            {isPix
              ? `Transferência PIX informada${localPhrase}. Aguarde o restaurante confirmar o recebimento.`
              : `Entregue este valor ao garçom ou caixa${localPhrase || ' do restaurante'}.`}
          </p>
        </div>
      </div>

      {/* Código de referência — cliente mostra ao caixa */}
      {paymentId && (
        <div className="rounded-xl p-5 text-center space-y-2"
          style={{ background: 'linear-gradient(135deg,rgba(249,115,22,0.1),rgba(249,115,22,0.05))', border: '2px solid rgba(249,115,22,0.35)' }}>
          <p className="text-[10px] font-mono uppercase tracking-widest" style={{ color: '#a78b7d' }}>
            Código de referência — mostre ao caixa
          </p>
          <p className="text-4xl font-black font-mono tracking-widest" style={{ color: '#f97316', letterSpacing: '0.15em' }}>
            #{paymentId.slice(-6).toUpperCase()}
          </p>
          <p className="text-[11px]" style={{ color: '#584237' }}>
            O caixa usa este código para confirmar o recebimento
          </p>
        </div>
      )}

      {splitInfo && (
        <div className="rounded-xl p-4 space-y-2"
          style={{ background: 'rgba(52,211,153,0.06)', border: '1px solid rgba(52,211,153,0.2)' }}>
          <p className="text-[10px] font-mono uppercase tracking-widest" style={{ color: '#a78b7d' }}>
            Divisão para reembolso
          </p>
          <div className="flex justify-between text-sm">
            <span style={{ color: '#34d399' }}>🍽️ Alimentação (empresa)</span>
            <span className="font-mono font-semibold" style={{ color: '#34d399' }}>{formatCurrency(splitInfo.food)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span style={{ color: '#a78b7d' }}>🍷 Bebidas (pessoal)</span>
            <span className="font-mono font-semibold" style={{ color: '#a78b7d' }}>{formatCurrency(splitInfo.alcohol)}</span>
          </div>
        </div>
      )}

      <div className="rounded-xl px-4 py-4 flex items-start gap-3"
        style={{ background: 'rgba(123,208,255,0.08)', border: '1px solid rgba(123,208,255,0.2)' }}>
        <span className="material-symbols-outlined text-[20px] shrink-0 mt-0.5 animate-pulse" style={{ color: '#7bd0ff' }}>hourglass_top</span>
        <div>
          <p className="text-sm font-bold" style={{ color: '#7bd0ff' }}>Aguardando confirmação do caixa</p>
          <p className="text-xs mt-1 leading-relaxed" style={{ color: '#a78b7d' }}>
            Entregue o dinheiro e mostre o código acima. Após confirmação você receberá o comprovante de pagamento.
          </p>
        </div>
      </div>

      <button
        type="button"
        onClick={onCancel}
        disabled={cancelling}
        className="w-full h-12 rounded-xl text-sm font-mono transition-all active:scale-95 disabled:opacity-40"
        style={{ background: 'transparent', border: '1px solid rgba(88,66,55,0.4)', color: '#a78b7d' }}
      >
        {cancelling ? 'Cancelando…' : 'Cancelar solicitação'}
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

  function goBack() {
    if (typeof window !== 'undefined' && window.history.length > 1) {
      router.back()
    } else {
      router.push(`/${params.slug}/orders${sessionId ? `?session=${sessionId}` : ''}`)
    }
  }
  const requestId   = searchParams.get('request') // pre-filled from notification

  const myCustomerId = typeof window !== 'undefined'
    ? localStorage.getItem('kicomanda_customer_id') : null

  type Participant = { id: string; name: string; myConsumption: number; isMe: boolean; whatsapp: string | null }

  type AlcoholSplit = { food: number; alcohol: number; hasAlcohol: boolean }

  const [step, setStep]             = useState<Step>('mode')
  const [closeMode, setCloseMode]   = useState<CloseMode>('individual')
  const [showTableConfirm, setShowTableConfirm] = useState(false)
  const [showDoublePayConfirm, setShowDoublePayConfirm] = useState(false)
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
  const [pendingCashPaymentId, setPendingCashPaymentId] = useState('')
  const [pendingCashAmount, setPendingCashAmount] = useState(0)
  const [pendingCashMinOwed, setPendingCashMinOwed] = useState(0)
  const [pendingManualPixPaymentId, setPendingManualPixPaymentId] = useState('')
  const [pendingManualPixAmount, setPendingManualPixAmount] = useState(0)
  const [pendingManualPixMinOwed, setPendingManualPixMinOwed] = useState(0)
  const [pendingCashSplitInfo, setPendingCashSplitInfo] = useState<{ food: number; alcohol: number } | null>(null)
  const [pendingManualPixSplitInfo, setPendingManualPixSplitInfo] = useState<{ food: number; alcohol: number } | null>(null)
  const [paymentConfig, setPaymentConfig] = useState<PublicPaymentConfig | null>(null)
  const [cashAmountInput, setCashAmountInput] = useState('')
  const [tableNumber, setTableNumber] = useState('')
  const [isCounterSession, setIsCounterSession] = useState(false)
  const [splitAlcohol, setSplitAlcohol] = useState(false)
  const [alcoholSplitDismissed, setAlcoholSplitDismissed] = useState(false)
  const [restaurantId, setRestaurantId] = useState('')
  const [customerWhatsapp, setCustomerWhatsapp] = useState('')
  const [restaurantName, setRestaurantName] = useState('')
  const [tableSettled, setTableSettled] = useState(false)

  // Amounts
  const [subTotal, setSubTotal]             = useState(0)
  const [mySubtotal, setMySubtotal]         = useState(0)
  // Parte de couvert (entrada/artístico) — fica fora da base da taxa de serviço.
  const [subCouvert, setSubCouvert]         = useState(0)
  const [myCouvert, setMyCouvert]           = useState(0)
  const [myOrders, setMyOrders]             = useState<Order[]>([])
  const [sessionPayments, setSessionPayments] = useState<SessionPaymentRow[]>([])
  const [myAlreadyPaid, setMyAlreadyPaid]   = useState(0)
  const [offers, setOffers]                 = useState<CustomerOffer[]>([])
  const [applyingOfferId, setApplyingOfferId] = useState<string | null>(null)

  // Participants for Mesa Toda
  const [participants, setParticipants]   = useState<Participant[]>([])
  const [selectedIds, setSelectedIds]     = useState<Set<string>>(new Set())
  const [customAmounts, setCustomAmounts] = useState<Record<string, string>>({})

  // Divisão da conta com aceite (item 5)
  const [activeCloseRequest, setActiveCloseRequest] = useState<ActiveCloseRequest | null>(null)
  const [splitActing, setSplitActing] = useState(false)

  // Individual extra
  const [extraAmount, setExtraAmount] = useState('')

  const myPaymentRows = useMemo(
    () => sessionPayments.filter(p => p.customer_id === myCustomerId),
    [sessionPayments, myCustomerId],
  )

  const receiptContext = useMemo(
    () => ({ restaurantName, tableNumber }),
    [restaurantName, tableNumber],
  )

  const myOpen = useMemo(
    () => computeOpenBalance(mySubtotal, myPaymentRows, includeServiceFee, myCouvert),
    [mySubtotal, myPaymentRows, includeServiceFee, myCouvert],
  )

  const sessionOpen = useMemo(
    () => computeOpenBalance(subTotal, sessionPayments, includeServiceFee, subCouvert),
    [subTotal, sessionPayments, includeServiceFee, subCouvert],
  )

  const remaining = sessionOpen.openTotal
  const sessionGrandTotal = useMemo(
    () => amountWithServiceFeeExCouvert(subTotal, subCouvert, includeServiceFee),
    [subTotal, subCouvert, includeServiceFee],
  )

  const unpaidItems = useMemo(
    () => unpaidOrderLineItems(myOrders, myPaymentRows),
    [myOrders, myPaymentRows],
  )

  const redeemableOffers = useMemo(
    () => offers.filter(o => isOfferRedeemable(o)),
    [offers],
  )

  const appliedOffers = useMemo(
    () => offers.filter(o => o.status === 'redeemed' && o.redeemed_session_id === sessionId),
    [offers, sessionId],
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
  const sessionFullySettled = subTotal > 0.01 && remaining <= 0.02
  const tableCreditForMe  = Math.max(0, myOpen.openTotal - myIndividualBase)

  const usesManualPix = paymentConfig?.provider === 'manual' && paymentConfig.manualReady

  const availablePaymentMethods = useMemo(() => {
    const all: { value: PaymentMethod; icon: string; label: string; disabled: boolean }[] = [
      { value: 'pix',    icon: 'qr_code_2',   label: 'PIX',      disabled: false },
      { value: 'debit',  icon: 'credit_card', label: 'Débito',   disabled: false },
      { value: 'credit', icon: 'contactless', label: 'Crédito',  disabled: false },
      { value: 'cash',   icon: 'payments',    label: 'Dinheiro', disabled: false },
    ]
    if (usesManualPix) {
      return all.filter(m => m.value === 'pix' || m.value === 'cash')
    }
    if (paymentConfig?.provider === 'manual' && !paymentConfig.manualReady) {
      return all.filter(m => m.value === 'cash')
    }
    if (paymentConfig && paymentConfig.digitalMethods.length === 0 && !usesManualPix) {
      return all.filter(m => m.value === 'cash')
    }
    return all.map(m => {
      if (m.value === 'pix') {
        const pixOk = usesManualPix || Boolean(paymentConfig?.digitalMethods.includes('pix'))
        return { ...m, disabled: !pixOk }
      }
      if (m.value === 'debit' || m.value === 'credit') {
        return { ...m, disabled: !paymentConfig?.digitalMethods.includes(m.value) }
      }
      return m
    })
  }, [usesManualPix, paymentConfig, splitAlcohol])

  useEffect(() => {
    if (!usesManualPix && (method === 'debit' || method === 'credit')) {
      setMethod('pix')
    }
  }, [usesManualPix, method])

  // Estado do cliente atual dentro de uma divisão de conta com aceite (item 5).
  const splitGate = useMemo(
    () => computeSplitGate(activeCloseRequest, myCustomerId, myAlreadyPaid),
    [activeCloseRequest, myCustomerId, myAlreadyPaid],
  )
  // Pagando a cota fixa da divisão (todos já aceitaram).
  const splitShareAmount = splitGate.kind === 'pay' ? splitGate.amount : null
  const splitPayMode = splitGate.kind === 'pay'
  // Quando a divisão exige aceite/aguardo/bloqueio, o checkout normal some.
  const hideNormalCheckout =
    splitGate.kind === 'invited' ||
    splitGate.kind === 'waiting' ||
    splitGate.kind === 'locked' ||
    splitGate.kind === 'paid'

  /** Mínimo que o cliente deve pagar (sem extra) — dinheiro e PIX manual. */
  const cashMinimumOwed = splitShareAmount != null
    ? splitShareAmount
    : closeMode === 'individual' ? myIndividualBase : myDefinedAmount

  function getAmountToPay() {
    if (splitShareAmount != null) return splitShareAmount
    if (closeMode === 'individual') return myIndividualTotal
    return myDefinedAmount
  }

  // Base da taxa = consumo em aberto MENOS a parte de couvert (couvert não leva taxa).
  const openCouvertBase = closeMode === 'individual'
    ? Math.min(myCouvert, myOpen.openSubtotal)
    : Math.min(subCouvert, sessionOpen.openSubtotal)
  const serviceFeeOpenBase = Math.max(
    0,
    roundMoney((closeMode === 'individual' ? myOpen.openSubtotal : sessionOpen.openSubtotal) - openCouvertBase),
  )

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

      // Couvert artístico: materializa (se na janela do show) antes de ler a conta.
      await fetch('/api/customer/couvert/artistico', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sessionId }),
      }).catch(() => {})

      const [sessionRes, participantsRes, ordersRes, paymentsRes, pendingCashRes, pendingManualPixRes] = await Promise.all([
        supabase.from('sessions').select('*, table:tables(number), restaurant:restaurants(id,name,whatsapp_nfe_enabled)').eq('id', sessionId).single(),
        supabase.from('session_participants').select('customer_id, customer:customers(first_name,last_name,whatsapp)').eq('session_id', sessionId),
        supabase.from('orders').select('id, customer_id, status, created_at, items:order_items(unit_price,quantity,cancelled_qty,cancelled_at,menu_item:menu_items(name,contains_alcohol,couvert_kind,category:menu_categories(name)))').eq('session_id', sessionId),
        supabase.from('payments').select('id, amount, customer_id, method, split_type, service_fee_included, confirmation_code, paid_at, created_at').eq('session_id', sessionId).eq('status', 'paid'),
        myCustomerId
          ? supabase.from('payments').select('id, amount, status, confirmation_code').eq('session_id', sessionId).eq('customer_id', myCustomerId).eq('method', 'cash').eq('status', 'pending').maybeSingle()
          : Promise.resolve({ data: null }),
        myCustomerId
          ? supabase.from('payments').select('id, amount, status, confirmation_code, asaas_payment_id').eq('session_id', sessionId).eq('customer_id', myCustomerId).eq('method', 'pix').eq('status', 'pending').maybeSingle()
          : Promise.resolve({ data: null }),
      ])

      const restaurant = (sessionRes.data as any)?.restaurant
      if (restaurant) {
        setRestaurantId(restaurant.id)
        setRestaurantName(restaurant.name)
        try {
          const cfgRes = await fetch(`/api/public/payment-config?restaurantId=${encodeURIComponent(restaurant.id)}`)
          if (cfgRes.ok) setPaymentConfig(await cfgRes.json())
        } catch { /* ignore */ }
      }

      // Ofertas do cliente neste restaurante (ativas ou já resgatadas nesta sessão)
      if (myCustomerId && restaurant?.id) {
        const { data: offerData } = await supabase
          .from('customer_offers')
          .select('*')
          .eq('customer_id', myCustomerId)
          .eq('restaurant_id', restaurant.id)
          .in('status', ['active', 'redeemed'])
          .order('created_at', { ascending: false })
        setOffers((offerData ?? []) as CustomerOffer[])
      }

      // Customer WhatsApp
      const myParticipant = (participantsRes.data ?? []).find((p: any) => p.customer_id === myCustomerId) as any
      if (myParticipant?.customer?.whatsapp) {
        setCustomerWhatsapp(String(myParticipant.customer.whatsapp))
      }

      if (!sessionRes.data) { router.replace(`/${params.slug}`); return }
      setTableNumber((sessionRes.data.table as any)?.number ?? '')
      setIsCounterSession((sessionRes.data as { service_mode?: string }).service_mode === 'counter')

      const billableOrders = (ordersRes.data ?? []).filter((o: any) => o.status !== 'cancelled')
      const billableItems = (items: any[]) => (items ?? []).filter(isBillableItem)
      const allItems   = billableOrders.flatMap((o: any) => billableItems(o.items))
      const sub        = allItems.reduce((s: number, i: any) => s + orderItemLineTotal(i), 0)
      // Couvert (entrada/artístico) — separa para tirar da base da taxa de serviço.
      const couvertOf = (items: any[]) => roundMoney(
        items
          .filter((i: any) => (i.menu_item?.couvert_kind ?? 'none') !== 'none')
          .reduce((s: number, i: any) => s + orderItemLineTotal(i), 0),
      )
      const subCouvertLocal = couvertOf(allItems)
      const allPayments = paymentsRes.data ?? []
      const myPaid     = myCustomerId
        ? allPayments.filter((p: any) => p.customer_id === myCustomerId).reduce((s, p) => s + Number(p.amount), 0)
        : 0

      setSubTotal(sub)
      setSubCouvert(subCouvertLocal)
      setSessionPayments((allPayments as SessionPaymentRow[]) ?? [])
      setMyAlreadyPaid(myPaid)

      const myOrdersData = billableOrders.filter((o: any) => o.customer_id === myCustomerId) as unknown as Order[]
      const myAllItems   = myOrdersData.flatMap((o: any) => billableItems(o.items))
      const mySub = myAllItems.reduce((s: number, i: any) => s + orderItemLineTotal(i), 0)
      const myCouvertLocal = couvertOf(myAllItems)
      setMySubtotal(mySub)
      setMyCouvert(myCouvertLocal)
      setMyOrders(myOrdersData)

      const myPayRows = allPayments.filter((p: any) => p.customer_id === myCustomerId)
      const myOpenAfterLoad = computeOpenBalance(mySub, myPayRows, true, myCouvertLocal)
      const sessionRemAfterLoad = computeOpenBalance(sub, allPayments, true, subCouvertLocal).openTotal

      if (sessionRemAfterLoad <= 0.02 && sub > 0.01) {
        setCloseMode('individual')
        setSplitAlcohol(false)
        setAlcoholSplitDismissed(true)
        if (sessionId) sessionStorage.removeItem(`kicomanda_split_alcohol_${sessionId}`)
      } else if (myOpenAfterLoad.openSubtotal <= 0.02 && mySub > 0.01) {
        setCloseMode('table')
        setSplitAlcohol(false)
        setAlcoholSplitDismissed(true)
        if (sessionId) sessionStorage.removeItem(`kicomanda_split_alcohol_${sessionId}`)
      } else {
        const savedSplit = sessionStorage.getItem(`kicomanda_split_alcohol_${sessionId}`)
        const unpaid = unpaidOrderLineItems(myOrdersData, myPayRows)
        const hasAlc = unpaid.some(i => splitConsumptionByAlcohol([i], 1).hasAlcohol)
        if (savedSplit === 'true' && hasAlc) setSplitAlcohol(true)
      }

      // Participants who haven't fully paid yet
      const parts: Participant[] = (participantsRes.data ?? []).map((p: any) => {
        const pOrders = billableOrders.filter((o: any) => o.customer_id === p.customer_id)
        const pItems  = pOrders.flatMap((o: any) => o.items ?? [])
        const pSub    = pItems.reduce((s: number, i: any) => s + orderItemLineTotal(i), 0)
        const pPay    = allPayments.filter((pay: any) => pay.customer_id === p.customer_id)
        const pOpen   = computeOpenBalance(pSub, pPay, true, couvertOf(pItems))
        return {
          id: p.customer_id,
          name: p.customer ? `${p.customer.first_name} ${p.customer.last_name}` : 'Cliente',
          myConsumption: pOpen.openTotal,
          isMe: p.customer_id === myCustomerId,
          whatsapp: p.customer?.whatsapp ? String(p.customer.whatsapp) : null,
        }
      })
      setParticipants(parts)

      // Divisão de conta ativa (com aceite) — carrega request + participantes.
      const { data: crRow } = await supabase
        .from('close_requests')
        .select('id, initiator_id, status')
        .eq('session_id', sessionId)
        .eq('mode', 'table')
        .eq('status', 'pending')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (crRow) {
        const { data: crParts } = await supabase
          .from('close_request_participants')
          .select('id, customer_id, amount_owed, status, customer:customers(first_name,last_name)')
          .eq('request_id', crRow.id)
        const partsMapped = (crParts ?? []).map((cp: any) => ({
          id: cp.id,
          customerId: cp.customer_id,
          name: cp.customer ? `${cp.customer.first_name ?? ''} ${cp.customer.last_name ?? ''}`.trim() || 'Cliente' : 'Cliente',
          amountOwed: Number(cp.amount_owed),
          status: cp.status as 'pending' | 'confirmed' | 'paid' | 'declined',
        }))
        const initiator = partsMapped.find(p => p.customerId === crRow.initiator_id)
        setActiveCloseRequest({
          id: crRow.id,
          initiatorId: crRow.initiator_id,
          initiatorName: initiator?.name ?? 'Um cliente',
          participants: partsMapped,
        })
      } else {
        setActiveCloseRequest(null)
      }

      if (myCustomerId) setSelectedIds(new Set([myCustomerId]))
      const sessionRem = computeOpenBalance(sub, allPayments, true, subCouvertLocal).openTotal
      const equalAmt = parts.length > 0 ? (sessionRem / parts.length).toFixed(2) : '0'
      setCustomAmounts(Object.fromEntries(parts.map(p => [p.id, equalAmt])))

      const pendingCash = (pendingCashRes as { data: { id: string; amount: number } | null }).data
      const pendingManualPixRaw = (pendingManualPixRes as { data: { id: string; amount: number; asaas_payment_id?: string | null } | null }).data
      const pendingManualPix = pendingManualPixRaw && !pendingManualPixRaw.asaas_payment_id ? pendingManualPixRaw : null

      if (pendingManualPix) {
        setPendingManualPixPaymentId(pendingManualPix.id)
        setPendingManualPixAmount(Number(pendingManualPix.amount))
        setStep(prev => prev === 'confirmed' ? prev : 'manual_pix_pending')
      } else if (pendingCash) {
        setPendingCashPaymentId(pendingCash.id)
        setPendingCashAmount(Number(pendingCash.amount))
        setStep(prev => prev === 'confirmed' ? prev : 'cash_pending')
      }

      if (sessionRem <= 0.02 && sub > 0.01) setTableSettled(true)

      setLoading(false)
    }
    load()

    const supabase = createClient()
    const ch = supabase.channel('checkout-payments')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'payments', filter: `session_id=eq.${sessionId}` }, load)
      // Divisão da conta: convites, aceites e cancelamentos recarregam o estado.
      .on('postgres_changes', { event: '*', schema: 'public', table: 'close_requests', filter: `session_id=eq.${sessionId}` }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'close_request_participants' }, load)
      .subscribe()

    return () => { supabase.removeChannel(ch) }
  }, [sessionId, params.slug, router, myCustomerId])

  // Confirmação em tempo real quando o restaurante valida pagamento em dinheiro
  useEffect(() => {
    if (!pendingCashPaymentId) return

    const supabase = createClient()
    const ch = supabase
      .channel(`cash-payment-${pendingCashPaymentId}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'payments',
        filter: `id=eq.${pendingCashPaymentId}`,
      }, (payload) => {
        const row = payload.new as { status?: string; confirmation_code?: string; amount?: number }
        if (row.status !== 'paid' || !row.confirmation_code) return

        setConfirmationCode(row.confirmation_code)
        setPendingCashPaymentId('')
        if (row.amount) setPendingCashAmount(Number(row.amount))
        setStep('confirmed')

        if (customerWhatsapp) {
          sendReceiptWhatsApp(Number(row.amount ?? pendingCashAmount), row.confirmation_code, 'combined')
        }
      })
      .subscribe()

    return () => { supabase.removeChannel(ch) }
  }, [pendingCashPaymentId, customerWhatsapp, pendingCashAmount])

  // Confirmação em tempo real — PIX manual
  useEffect(() => {
    if (!pendingManualPixPaymentId) return

    const supabase = createClient()
    const ch = supabase
      .channel(`manual-pix-payment-${pendingManualPixPaymentId}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'payments',
        filter: `id=eq.${pendingManualPixPaymentId}`,
      }, (payload) => {
        const row = payload.new as { status?: string; confirmation_code?: string; amount?: number }
        if (row.status !== 'paid' || !row.confirmation_code) return

        setConfirmationCode(row.confirmation_code)
        setPendingManualPixPaymentId('')
        if (row.amount) setPendingManualPixAmount(Number(row.amount))
        setStep('confirmed')

        if (customerWhatsapp) {
          sendReceiptWhatsApp(Number(row.amount ?? pendingManualPixAmount), row.confirmation_code, 'combined')
        }
      })
      .subscribe()

    return () => { supabase.removeChannel(ch) }
  }, [pendingManualPixPaymentId, customerWhatsapp, pendingManualPixAmount])

  async function processManualPixPayment(amount: number, minimumOwed: number): Promise<void> {
    setPendingManualPixSplitInfo(splitAlcohol && alcoholSplit.hasAlcohol ? alcoholPaymentAmounts() : null)
    setPaying(true)
    try {
      const res = await fetch('/api/payments/manual-pix', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          amount,
          splitType: 'combined',
          customerId: myCustomerId,
          serviceFeeIncluded: includeServiceFee,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Erro ao registrar PIX manual.')
      setPendingManualPixPaymentId(data.paymentId)
      setPendingManualPixAmount(data.amount)
      setPendingManualPixMinOwed(minimumOwed)
      setStep('manual_pix_pending')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao registrar PIX manual.')
    } finally {
      setPaying(false)
    }
  }

  async function cancelManualPixPayment() {
    if (!pendingManualPixPaymentId || !myCustomerId) return
    setPaying(true)
    try {
      const res = await fetch(
        `/api/payments/manual-pix?paymentId=${encodeURIComponent(pendingManualPixPaymentId)}&customerId=${encodeURIComponent(myCustomerId)}`,
        { method: 'DELETE' },
      )
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Erro ao cancelar.')
      setPendingManualPixPaymentId('')
      setPendingManualPixAmount(0)
      setPendingManualPixSplitInfo(null)
      setStep('manual_pix')
      toast.message('Solicitação de PIX cancelada.')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao cancelar.')
    } finally {
      setPaying(false)
    }
  }

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

  async function sendReceiptWhatsApp(
    amount: number,
    code: string,
    splitType: PaymentReceiptRecord['split_type'] = 'combined',
  ) {
    if (!customerWhatsapp) return
    const payment: PaymentReceiptRecord = {
      id: '',
      amount,
      method,
      split_type: splitType,
      service_fee_included: includeServiceFee,
      confirmation_code: code,
      paid_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
    }
    await sendWhatsApp(customerWhatsapp, buildReceiptWhatsAppMessage(payment, receiptContext))
  }

  function shareForCustomer(cid: string) {
    return splitType === 'equal' ? equalShare : (parseFloat(customAmounts[cid] ?? '0') || 0)
  }

  /** Notifica via WhatsApp os participantes convidados a aceitar a divisão. */
  async function notifySplitInvites(requestId: string) {
    if (typeof window === 'undefined') return
    const link = `${window.location.origin}/${params.slug}/checkout?session=${sessionId}&request=${requestId}`
    const initiatorName = participants.find(p => p.isMe)?.name ?? 'Um cliente'
    for (const p of selectedParts) {
      if (p.isMe || !p.whatsapp) continue
      const message = buildSplitInviteMessage({
        restaurantName,
        tableNumber,
        initiatorName,
        amount: shareForCustomer(p.id),
        link,
      })
      await sendWhatsApp(p.whatsapp, message)
    }
  }

  async function createCloseRequest() {
    // Idempotente: se já existe uma divisão ativa, não cria outra.
    if (activeCloseRequest) return

    const supabase = createClient()
    const { data: req } = await supabase
      .from('close_requests')
      .insert({ session_id: sessionId, initiator_id: myCustomerId, mode: closeMode, status: 'pending' })
      .select().single()
    if (!req) return

    if (closeMode === 'table') {
      const now = new Date().toISOString()
      await supabase.from('close_request_participants').insert(
        [...selectedIds].map(cid => ({
          request_id: req.id,
          customer_id: cid,
          amount_owed: shareForCustomer(cid),
          // O iniciador já entra aceito; os demais precisam aceitar.
          status: cid === myCustomerId ? 'confirmed' : 'pending',
          confirmed_at: cid === myCustomerId ? now : null,
        }))
      )
      // Convida os demais participantes (item 5).
      if (selectedParts.some(p => !p.isMe)) {
        await notifySplitInvites(req.id)
      }
    }
  }

  async function acceptSplit() {
    if (splitGate.kind !== 'invited') return
    setSplitActing(true)
    try {
      const supabase = createClient()
      const { error } = await supabase
        .from('close_request_participants')
        .update({ status: 'confirmed', confirmed_at: new Date().toISOString() })
        .eq('id', splitGate.participantId)
      if (error) throw error
      toast.success('Você aceitou a sua parte da divisão.')
    } catch {
      toast.error('Não foi possível aceitar agora. Tente novamente.')
    } finally {
      setSplitActing(false)
    }
  }

  async function declineSplit() {
    if (splitGate.kind !== 'invited' || !activeCloseRequest) return
    setSplitActing(true)
    try {
      const supabase = createClient()
      await supabase
        .from('close_request_participants')
        .update({ status: 'declined' })
        .eq('id', splitGate.participantId)
      // Recusar cancela a divisão — todos voltam ao fluxo normal de pagamento.
      await supabase
        .from('close_requests')
        .update({ status: 'cancelled' })
        .eq('id', activeCloseRequest.id)
      toast.message('Você recusou a divisão. O grupo foi avisado.')
    } catch {
      toast.error('Não foi possível recusar agora. Tente novamente.')
    } finally {
      setSplitActing(false)
    }
  }

  // Quando meus pagamentos cobrem a cota da divisão, marca minha linha como paga.
  useEffect(() => {
    if (!activeCloseRequest || !myCustomerId) return
    const mine = activeCloseRequest.participants.find(p => p.customerId === myCustomerId)
    if (!mine || mine.status === 'paid') return
    if (myAlreadyPaid >= mine.amountOwed - 0.02) {
      const supabase = createClient()
      void supabase
        .from('close_request_participants')
        .update({ status: 'paid', amount_paid: myAlreadyPaid, paid_at: new Date().toISOString() })
        .eq('id', mine.id)
    }
  }, [activeCloseRequest, myAlreadyPaid, myCustomerId])

  /**
   * Aplica um benefício: registra o desconto como crédito ('offer') na sessão.
   * O saldo recalcula automaticamente e o cliente paga apenas o restante.
   */
  async function applyOffer(offer: CustomerOffer) {
    if (!sessionId || !myCustomerId) return
    if (applyingOfferId) return

    const discount = computeOfferDiscount(
      offer.benefit_type,
      offer.benefit_value,
      myOpen.openSubtotal,
      includeServiceFee,
      unpaidItems,
    )

    if (discount.discountTotal <= 0.01) {
      toast.error('Sem valor em aberto para aplicar este benefício.')
      return
    }

    setApplyingOfferId(offer.id)

    const supabase = createClient()

    // 1) marca a oferta como resgatada (evita reuso)
    const { error: offerErr } = await supabase
      .from('customer_offers')
      .update({
        status: 'redeemed',
        redeemed_at: new Date().toISOString(),
        redeemed_session_id: sessionId,
      })
      .eq('id', offer.id)
      .eq('status', 'active')

    if (offerErr) {
      toast.error('Erro ao aplicar o benefício.')
      setApplyingOfferId(null)
      return
    }

    // 2) registra o crédito do desconto como pagamento 'offer' (absorvido pelo restaurante)
    const { error: payErr } = await supabase.from('payments').insert({
      session_id: sessionId,
      restaurant_id: restaurantId,
      customer_id: myCustomerId,
      amount: discount.discountTotal,
      method: 'offer',
      split_type: 'combined',
      status: 'paid',
      service_fee_included: includeServiceFee,
      paid_at: new Date().toISOString(),
    })

    if (payErr) {
      // rollback do resgate se o crédito falhar
      await supabase.from('customer_offers')
        .update({ status: 'active', redeemed_at: null, redeemed_session_id: null })
        .eq('id', offer.id)
      toast.error('Erro ao aplicar o benefício.')
      setApplyingOfferId(null)
      return
    }

    toast.success('Benefício aplicado à sua conta!')
    setApplyingOfferId(null)
    // o canal realtime de payments dispara o reload automaticamente
  }

  async function processCashPayment(amount: number, minimumOwed: number): Promise<void> {
    setPaying(true)
    try {
      const res = await fetch('/api/payments/cash', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          amount,
          splitType: 'combined',
          customerId: myCustomerId,
          serviceFeeIncluded: includeServiceFee,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Erro ao registrar pagamento em dinheiro.')
      setPendingCashPaymentId(data.paymentId)
      setPendingCashAmount(data.amount)
      setPendingCashMinOwed(minimumOwed)
      setStep('cash_pending')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao registrar pagamento em dinheiro.')
    } finally {
      setPaying(false)
    }
  }

  async function submitCashAmount() {
    const parsed = parseFloat(cashAmountInput.replace(',', '.')) || 0
    if (parsed < cashMinimumOwed - 0.02) {
      toast.error(`O valor mínimo é ${formatCurrency(cashMinimumOwed)}.`)
      return
    }
    setPendingCashSplitInfo(splitAlcohol && alcoholSplit.hasAlcohol ? alcoholPaymentAmounts() : null)
    await processCashPayment(parsed, cashMinimumOwed)
  }

  async function cancelCashPayment() {
    if (!pendingCashPaymentId || !myCustomerId) return
    setPaying(true)
    try {
      const res = await fetch(
        `/api/payments/cash?paymentId=${encodeURIComponent(pendingCashPaymentId)}&customerId=${encodeURIComponent(myCustomerId)}`,
        { method: 'DELETE' },
      )
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Erro ao cancelar.')
      setPendingCashPaymentId('')
      setPendingCashAmount(0)
      setPendingCashSplitInfo(null)
      setStep('mode')
      toast.message('Solicitação de pagamento em dinheiro cancelada.')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao cancelar.')
    } finally {
      setPaying(false)
    }
  }

  /**
   * Inicia pagamento digital (Asaas ou Mercado Pago).
   */
  async function submitPayment(
    amount: number,
    splitType: 'food' | 'alcohol' | 'combined',
    cardPayload?: CardPaymentPayload,
  ): Promise<{
    paymentId: string
    confirmationCode: string
    pixQrCodeImage?: string
    pixPayload?: string
    pixExpiration?: string
    status: 'pending' | 'paid'
    sessionClosed?: boolean
  }> {
    if (method === 'cash') {
      throw new Error('Pagamento em dinheiro usa fluxo separado.')
    }

    const usesMp = paymentConfig?.provider === 'mercado_pago'
    const endpoint = usesMp ? '/api/mercadopago/payments' : '/api/asaas/payments'

    const payload = usesMp
      ? {
          sessionId: sessionId!,
          amount,
          method,
          splitType,
          customerId: myCustomerId,
          serviceFeeIncluded: includeServiceFee,
          installmentCount: cardPayload?.installmentCount,
          cardToken: cardPayload?.cardToken,
          paymentMethodId: cardPayload?.mpPaymentMethodId,
        }
      : {
          sessionId: sessionId!,
          amount,
          method,
          splitType,
          customerId: myCustomerId,
          serviceFeeIncluded: includeServiceFee,
          ...(cardPayload ?? {}),
        }

    const res = await customerAuthFetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })

    const data = await res.json()
    if (!res.ok) throw new Error((data as { error?: string }).error ?? 'Erro ao processar pagamento.')
    if (data.sessionClosed) setTableSettled(true)

    return {
      paymentId: data.paymentId,
      confirmationCode: data.confirmationCode ?? '',
      pixQrCodeImage: data.pixQrCodeImage,
      pixPayload: data.pixPayload,
      pixExpiration: data.pixExpiration,
      status: data.status,
      sessionClosed: data.sessionClosed,
    }
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

  async function processSplitPayments(cardPayload?: CardPaymentPayload): Promise<boolean> {
    const { food, alcohol } = alcoholPaymentAmounts()
    const mustSplit = alcoholSplit.hasAlcohol && food >= 0.01 && alcohol >= 0.01

    if (mustSplit) {
      const foodRes = await submitPayment(food, 'food', cardPayload)
      const alcoholRes = await submitPayment(alcohol, 'alcohol')

      setConfirmationCode(foodRes.confirmationCode)
      setConfirmationCode2(alcoholRes.confirmationCode)

      if (customerWhatsapp) {
        await sendReceiptWhatsApp(food, foodRes.confirmationCode, 'food')
        await sendReceiptWhatsApp(alcohol, alcoholRes.confirmationCode, 'alcohol')
      }
      return true
    }

    const singleAmount = food >= 0.01 ? food : alcohol
    const singleType = food >= 0.01 ? 'food' as const : 'alcohol' as const
    if (singleAmount < 0.01) return false

    const data = await submitPayment(singleAmount, singleType, cardPayload)
    setConfirmationCode(data.confirmationCode)
    if (customerWhatsapp) {
      await sendReceiptWhatsApp(singleAmount, data.confirmationCode, singleType)
    }
    return true
  }

  async function processPayment(
    paidAmount: number,
    cardPayload?: CardPaymentPayload,
  ): Promise<boolean> {
    setPaying(true)

    try {
      // Split alcoólico: 2 pagamentos (alimentação + bebidas)
      if (splitAlcohol && closeMode === 'individual') {
        const done = await processSplitPayments(cardPayload)
        if (!done) {
          toast.error('Nenhum valor a pagar.')
          return false
        }
        setStep('confirmed')
        return true
      }

      const data = await submitPayment(paidAmount, 'combined', cardPayload)

      if ((method === 'pix' || method === 'debit') && data.status === 'pending') {
        setPixQrCodeImage(data.pixQrCodeImage ?? '')
        setPixPayload(data.pixPayload ?? '')
        setPixExpiration(data.pixExpiration ?? '')
        setPixPaymentId(data.paymentId)

        if (customerWhatsapp) {
          await sendReceiptWhatsApp(paidAmount, 'PIX GERADO')
        }
        return false
      }

      if (data.confirmationCode) {
        setConfirmationCode(data.confirmationCode)
        if (customerWhatsapp) {
          await sendReceiptWhatsApp(paidAmount, data.confirmationCode)
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
          sessionStorage.removeItem(`kicomanda_split_alcohol_${sessionId}`)
          setStep('confirmed')
        }
        return
      }

      const res = await fetch(
        `${paymentConfig?.provider === 'mercado_pago' ? '/api/mercadopago/payments' : '/api/asaas/payments'}?id=${pixPaymentId}`,
      )
      const data = await res.json()

      const code = data.confirmation_code || generateConfirmationCode()
      setConfirmationCode(code)
      if (customerWhatsapp) {
        await sendReceiptWhatsApp(paidAmount, code)
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

  async function handleProceed(opts?: { confirmedDoublePay?: boolean }) {
    if (closeMode === 'table' && splitType === 'custom' && !customSumOk) {
      toast.error('Os valores não fecham com o total da conta. Ajuste os valores.')
      return
    }

    // Item 5: ao dividir com outras pessoas, cria a divisão e AGUARDA os
    // aceites — ninguém paga antes de todos aceitarem.
    const splittingWithOthers = closeMode === 'table' && selectedParts.some(p => !p.isMe)
    if (splittingWithOthers && !activeCloseRequest) {
      setPaying(true)
      try {
        await createCloseRequest()
        toast.success('Convite de divisão enviado! Aguardando os participantes aceitarem.')
      } finally {
        setPaying(false)
      }
      return
    }

    // Trava contra pagamento duplo: se este cliente já realizou um pagamento
    // nesta sessão, pede confirmação explícita antes de iniciar outro.
    if (myAlreadyPaid > 0.01 && !opts?.confirmedDoublePay) {
      setShowDoublePayConfirm(true)
      return
    }

    if (method === 'cash') {
      await createCloseRequest()
      setCashAmountInput(cashMinimumOwed > 0.01 ? cashMinimumOwed.toFixed(2) : '0.00')
      setStep('cash_amount')
      return
    }

    if (method === 'pix' && usesManualPix) {
      await createCloseRequest()
      setStep('manual_pix')
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
        sessionStorage.removeItem(`kicomanda_split_alcohol_${sessionId}`)
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

  const PAYMENT_METHODS = availablePaymentMethods

  useEffect(() => {
    if (step !== 'confirmed' || !tableSettled || !sessionId) return
    const timer = setTimeout(() => {
      router.push(`/${params.slug}/home?session=${sessionId}`)
    }, 5000)
    return () => clearTimeout(timer)
  }, [step, tableSettled, sessionId, router, params.slug])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#0b1326' }}>
        <Loader2 className="h-8 w-8 animate-spin" style={{ color: '#f97316' }} />
      </div>
    )
  }

  // ── CONFIRMED ──────────────────────────────────────────────
  if (step === 'confirmed') {
    const confirmedPaidAmount = pendingCashAmount > 0.01 ? pendingCashAmount : getAmountToPay()
    const confirmedTableExtra = pendingCashAmount > 0.01 && pendingCashMinOwed > 0.01
      ? Math.max(0, roundMoney(pendingCashAmount - pendingCashMinOwed))
      : Math.max(0, myIndividualTotal - myOpen.openTotal)

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
                  A conta da {formatServiceLocationLabel(tableNumber, isCounterSession ? 'counter' : 'dine_in')} foi paga por completo. A mesa já está liberada para novos clientes no restaurante.
                </p>
              </div>
            </div>
          )}
          <div className="w-full rounded-xl p-5 flex justify-between items-center"
            style={{ background: '#171f33', border: '1px solid #334155' }}>
            <div>
              <p className="text-[10px] font-mono uppercase tracking-widest mb-1" style={{ color: '#a78b7d' }}>{isCounterSession ? 'Local' : 'Mesa'}</p>
              <p className="text-xl font-bold" style={{ fontFamily: 'Geist, sans-serif' }}>{formatServiceLocationLabel(tableNumber, isCounterSession ? 'counter' : 'dine_in')}</p>
            </div>
            <div className="w-px h-10" style={{ background: '#584237' }} />
            <div className="text-right">
              <p className="text-[10px] font-mono uppercase tracking-widest mb-1" style={{ color: '#a78b7d' }}>Você pagou</p>
              <p className="text-xl font-black" style={{ color: '#f97316', fontFamily: 'Geist, sans-serif' }}>
                {formatCurrency(confirmedPaidAmount)}
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
          {closeMode === 'individual' && confirmedTableExtra > 0.01 && (
            <div className="w-full rounded-xl p-4 flex items-start gap-3"
              style={{ background: 'rgba(52,211,153,0.08)', border: '1px solid rgba(52,211,153,0.2)' }}>
              <span className="material-symbols-outlined text-[18px] shrink-0 mt-0.5" style={{ color: '#34d399' }}>savings</span>
              <p className="text-xs leading-relaxed" style={{ color: '#34d399' }}>
                <strong>+{formatCurrency(confirmedTableExtra)}</strong> ficaram como saldo na mesa. Os outros pagantes vão se beneficiar. 💛
              </p>
            </div>
          )}
          <p className="text-base font-semibold" style={{ color: '#e0c0b1' }}>Volte sempre!</p>
          {tableSettled && (
            <>
              <button
                type="button"
                onClick={() => router.push(`/${params.slug}/home?session=${sessionId}`)}
                className="w-full h-12 rounded-xl text-sm font-bold font-mono flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
                style={{ background: '#f97316', color: '#582200', boxShadow: '0 8px 24px rgba(249,115,22,0.25)' }}
              >
                <span className="material-symbols-outlined text-[20px]">home</span>
                Ver código na página inicial
              </button>
              <p className="text-[11px] font-mono text-center" style={{ color: '#584237' }}>
                Redirecionando para o início em alguns segundos…
              </p>
            </>
          )}
        </main>
        <CustomerBottomNav slug={params.slug} sessionId={sessionId ?? ''} />
      </div>
    )
  }

  // ── PIX / CARD / DINHEIRO ───────────────────────────────────
  const isTableMode = closeMode === 'table'

  if (step === 'manual_pix' && paymentConfig?.manual) {
    return (
      <div className="min-h-screen flex flex-col" style={{ background: '#0b1326', color: '#dae2fd' }}>
        <header className="sticky top-0 z-40 flex items-center px-6 h-16"
          style={{ background: 'rgba(11,19,38,0.9)', borderBottom: '1px solid rgba(88,66,55,0.3)', backdropFilter: 'blur(12px)' }}>
          <h1 className="text-base font-semibold" style={{ fontFamily: 'Geist, sans-serif' }}>Pagamento · PIX</h1>
        </header>
        <main className="flex-1 px-6 py-6 pb-28">
          <ManualPixScreen
            suggestedAmount={getAmountToPay()}
            fixedAmount={isTableMode}
            manual={paymentConfig.manual}
            onSubmit={async (amount) => {
              await processManualPixPayment(amount, cashMinimumOwed)
            }}
            onBack={() => setStep('mode')}
            loading={paying}
            splitInfo={splitAlcohol && alcoholSplit.hasAlcohol ? alcoholPaymentAmounts() : null}
          />
        </main>
        <CustomerBottomNav slug={params.slug} sessionId={sessionId ?? ''} />
      </div>
    )
  }

  if (step === 'manual_pix_pending') {
    return (
      <div className="min-h-screen flex flex-col" style={{ background: '#0b1326', color: '#dae2fd' }}>
        <header className="sticky top-0 z-40 flex items-center px-6 h-16"
          style={{ background: 'rgba(11,19,38,0.9)', borderBottom: '1px solid rgba(88,66,55,0.3)', backdropFilter: 'blur(12px)' }}>
          <h1 className="text-base font-semibold" style={{ fontFamily: 'Geist, sans-serif' }}>Pagamento · PIX</h1>
        </header>
        <main className="flex-1 px-6 py-6 pb-28">
          <CashPendingScreen
            amount={pendingManualPixAmount || getAmountToPay()}
            minimumOwed={pendingManualPixMinOwed > 0.01 ? pendingManualPixMinOwed : undefined}
            tableNumber={tableNumber}
            isCounter={isCounterSession}
            onBack={() => setStep('manual_pix')}
            onCancel={cancelManualPixPayment}
            cancelling={paying}
            variant="pix"
            splitInfo={pendingManualPixSplitInfo}
          />
        </main>
        <CustomerBottomNav slug={params.slug} sessionId={sessionId ?? ''} />
      </div>
    )
  }

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

  if (step === 'cash_amount') {
    return (
      <div className="min-h-screen flex flex-col" style={{ background: '#0b1326', color: '#dae2fd' }}>
        <header className="sticky top-0 z-40 flex items-center px-6 h-16"
          style={{ background: 'rgba(11,19,38,0.9)', borderBottom: '1px solid rgba(88,66,55,0.3)', backdropFilter: 'blur(12px)' }}>
          <h1 className="text-base font-semibold" style={{ fontFamily: 'Geist, sans-serif' }}>Pagamento · Dinheiro</h1>
        </header>
        <main className="flex-1 px-6 py-6 pb-28">
          <CashAmountScreen
            minimumOwed={cashMinimumOwed}
            amount={cashAmountInput}
            onAmountChange={setCashAmountInput}
            onSubmit={submitCashAmount}
            onBack={() => setStep('mode')}
            loading={paying}
            splitInfo={splitAlcohol && alcoholSplit.hasAlcohol ? alcoholPaymentAmounts() : null}
          />
        </main>
        <CustomerBottomNav slug={params.slug} sessionId={sessionId ?? ''} />
      </div>
    )
  }

  if (step === 'cash_pending') {
    return (
      <div className="min-h-screen flex flex-col" style={{ background: '#0b1326', color: '#dae2fd' }}>
        <header className="sticky top-0 z-40 flex items-center px-6 h-16"
          style={{ background: 'rgba(11,19,38,0.9)', borderBottom: '1px solid rgba(88,66,55,0.3)', backdropFilter: 'blur(12px)' }}>
          <h1 className="text-base font-semibold" style={{ fontFamily: 'Geist, sans-serif' }}>Pagamento · Dinheiro</h1>
        </header>
        <main className="flex-1 px-6 py-6 pb-28">
          <CashPendingScreen
            amount={pendingCashAmount || parseFloat(cashAmountInput) || cashMinimumOwed}
            minimumOwed={pendingCashMinOwed > 0.01 ? pendingCashMinOwed : undefined}
            tableNumber={tableNumber}
            isCounter={isCounterSession}
            paymentId={pendingCashPaymentId}
            onBack={() => setStep('cash_amount')}
            onCancel={cancelCashPayment}
            cancelling={paying}
            splitInfo={pendingCashSplitInfo}
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
            Pagamento · Crédito
          </h1>
        </header>
        <main className="flex-1 px-6 py-6 pb-28">
          <CardPaymentScreen
            customerId={myCustomerId}
            suggestedAmount={getAmountToPay()}
            fixedAmount={isTableMode}
            gatewayProvider={paymentConfig?.provider === 'mercado_pago' ? 'mercado_pago' : 'asaas'}
            mercadoPagoPublicKey={paymentConfig?.mercadoPagoPublicKey}
            onConfirm={async (amount, payload) => {
              const confirmed = await processPayment(amount, payload)
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
  const canProceed = splitPayMode
    ? getAmountToPay() >= 0.01
    : closeMode === 'individual'
      ? (!hasPaidMyShare && getAmountToPay() >= 0.01)
      : (selectedIds.size > 0 && (splitType === 'equal' || customSumOk))

  const showPaymentFlow = splitPayMode
    || (!(closeMode === 'individual' && hasPaidMyShare) && !sessionFullySettled)

  const closeModeOptions = [
    { mode: 'individual' as CloseMode, icon: 'person', title: isCounterSession ? 'Pagar meu pedido' : 'Só a minha parte', desc: isCounterSession ? 'PIX, cartão ou dinheiro' : 'Pago apenas meu consumo' },
    ...(sessionFullySettled || isCounterSession
      ? []
      : [{ mode: 'table' as CloseMode, icon: 'groups', title: 'Pagar pela mesa toda ou dividir', desc: 'Pague tudo ou divida entre os participantes' }]),
  ]

  return (
    <div className="min-h-screen flex flex-col" style={{ background: '#0b1326', color: '#dae2fd' }}>
      <div className="pointer-events-none fixed top-1/4 right-0 w-64 h-64 rounded-full"
        style={{ background: 'rgba(123,208,255,0.04)', filter: 'blur(80px)' }} />
      <header className="sticky top-0 z-40 flex items-center px-6 h-16"
        style={{ background: 'rgba(11,19,38,0.9)', borderBottom: '1px solid rgba(88,66,55,0.3)', backdropFilter: 'blur(12px)' }}>
        <button onClick={goBack} className="p-2 -ml-2 mr-3 rounded-full" style={{ color: '#ffb690' }}>
          <span className="material-symbols-outlined">arrow_back</span>
        </button>
        <h1 className="text-base font-semibold" style={{ fontFamily: 'Geist, sans-serif' }}>
          {isCounterSession ? 'Pagamento' : 'Fechar Conta'}
        </h1>
      </header>

      <main className="flex-1 px-6 py-6 pb-56 space-y-5">

        {/* ── Divisão da conta com aceite (item 5) ── */}
        {splitGate.kind === 'invited' && (
          <section className="space-y-4">
            <div className="rounded-2xl p-5 space-y-4"
              style={{ background: 'linear-gradient(135deg,#1e293b,#0f172a)', border: '1px solid rgba(249,115,22,0.4)' }}>
              <div className="flex items-start gap-3">
                <div className="w-11 h-11 rounded-full flex items-center justify-center shrink-0"
                  style={{ background: 'rgba(249,115,22,0.15)' }}>
                  <span className="material-symbols-outlined text-[24px]" style={{ color: '#f97316' }}>group_add</span>
                </div>
                <div>
                  <p className="text-base font-bold" style={{ color: '#ffb690', fontFamily: 'Geist, sans-serif' }}>Convite para dividir a conta</p>
                  <p className="text-xs mt-1 leading-relaxed" style={{ color: '#a78b7d' }}>
                    <strong>{splitGate.initiatorName}</strong> quer dividir a conta com você
                    {splitGate.others.length > 0 && ` e ${splitGate.others.join(', ')}`}.
                  </p>
                </div>
              </div>
              <div className="rounded-xl p-4 text-center" style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(88,66,55,0.3)' }}>
                <p className="text-[10px] font-mono uppercase tracking-widest" style={{ color: '#a78b7d' }}>Sua parte</p>
                <p className="text-3xl font-black mt-1" style={{ color: '#ffb690', fontFamily: 'Geist, sans-serif' }}>{formatCurrency(splitGate.amount)}</p>
              </div>
              <p className="text-[11px] leading-relaxed" style={{ color: '#584237' }}>
                A divisão só é fechada quando <strong>todos</strong> aceitarem. Depois disso cada um escolhe como pagar a sua parte.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={declineSplit}
                  disabled={splitActing}
                  className="flex-1 h-12 rounded-xl text-sm font-bold transition-all active:scale-95 disabled:opacity-50"
                  style={{ background: 'transparent', border: '1px solid #584237', color: '#a78b7d' }}>
                  Recusar
                </button>
                <button
                  onClick={acceptSplit}
                  disabled={splitActing}
                  className="flex-[2] h-12 rounded-xl text-sm font-bold transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
                  style={{ background: '#f97316', color: '#582200' }}>
                  {splitActing ? <Loader2 className="h-5 w-5 animate-spin" /> : <>Aceitar minha parte · {formatCurrency(splitGate.amount)}</>}
                </button>
              </div>
            </div>
          </section>
        )}

        {splitGate.kind === 'waiting' && (
          <section className="space-y-4">
            <div className="rounded-2xl p-6 text-center space-y-4"
              style={{ background: 'linear-gradient(135deg,#1e293b,#0f172a)', border: '1px solid rgba(123,208,255,0.3)' }}>
              <div className="w-16 h-16 mx-auto rounded-full flex items-center justify-center"
                style={{ background: 'rgba(123,208,255,0.1)', border: '2px solid rgba(123,208,255,0.3)' }}>
                <span className="material-symbols-outlined text-[32px] animate-pulse" style={{ color: '#7bd0ff' }}>hourglass_top</span>
              </div>
              <div>
                <p className="text-lg font-black" style={{ color: '#7bd0ff', fontFamily: 'Geist, sans-serif' }}>Você aceitou sua parte</p>
                <p className="text-sm mt-1" style={{ color: '#dae2fd' }}>Sua parte: <strong>{formatCurrency(splitGate.amount)}</strong></p>
                <p className="text-xs mt-3 leading-relaxed" style={{ color: '#a78b7d' }}>
                  Aguardando <strong>{splitGate.pendingNames.join(', ')}</strong> aceitar
                  {splitGate.pendingNames.length === 1 ? '' : 'em'}. O pagamento abre automaticamente quando todos confirmarem.
                </p>
              </div>
            </div>
          </section>
        )}

        {splitGate.kind === 'locked' && (
          <section className="space-y-4">
            <div className="rounded-2xl p-6 text-center space-y-4"
              style={{ background: 'linear-gradient(135deg,#1e293b,#0f172a)', border: '1px solid rgba(251,191,36,0.3)' }}>
              <div className="w-16 h-16 mx-auto rounded-full flex items-center justify-center"
                style={{ background: 'rgba(251,191,36,0.1)', border: '2px solid rgba(251,191,36,0.3)' }}>
                <span className="material-symbols-outlined text-[32px]" style={{ color: '#fbbf24' }}>lock</span>
              </div>
              <div>
                <p className="text-lg font-black" style={{ color: '#fbbf24', fontFamily: 'Geist, sans-serif' }}>Divisão em andamento</p>
                <p className="text-xs mt-2 leading-relaxed max-w-[280px] mx-auto" style={{ color: '#a78b7d' }}>
                  <strong>{splitGate.initiatorName}</strong> iniciou uma divisão da conta com pessoas selecionadas.
                  Enquanto a divisão estiver ativa, o pagamento fica disponível apenas para quem foi escolhido.
                </p>
              </div>
              <button
                onClick={goBack}
                className="mx-auto flex items-center justify-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold transition-all active:scale-95"
                style={{ background: 'rgba(30,41,59,0.7)', border: '1px solid #334155', color: '#ffb690' }}>
                <span className="material-symbols-outlined text-[18px]">arrow_back</span>
                Voltar
              </button>
            </div>
          </section>
        )}

        {splitGate.kind === 'paid' && (
          <section className="space-y-4">
            <div className="rounded-2xl p-6 text-center space-y-4"
              style={{ background: 'rgba(52,211,153,0.1)', border: '1px solid rgba(52,211,153,0.4)' }}>
              <div className="w-16 h-16 mx-auto rounded-full flex items-center justify-center"
                style={{ background: 'rgba(52,211,153,0.15)', border: '2px solid rgba(52,211,153,0.4)' }}>
                <span className="material-symbols-outlined text-[32px]" style={{ color: '#34d399', fontVariationSettings: "'FILL' 1" }}>check_circle</span>
              </div>
              <div>
                <p className="text-lg font-black" style={{ color: '#34d399', fontFamily: 'Geist, sans-serif' }}>Sua parte da divisão está paga</p>
                <p className="text-sm mt-1" style={{ color: '#dae2fd' }}>{formatCurrency(splitGate.amount)} pagos</p>
              </div>
              {myPaymentRows.length > 0 && (
                <Link
                  href={`/${params.slug}/receipts?session=${sessionId}`}
                  className="mx-auto flex items-center justify-center gap-2 px-6 py-3 rounded-xl text-xs font-mono font-semibold transition-all active:scale-95"
                  style={{ background: 'rgba(30,41,59,0.7)', border: '1px solid #334155', color: '#ffb690' }}>
                  <span className="material-symbols-outlined text-[16px]">history</span>
                  Ver seus recibos
                </Link>
              )}
            </div>
          </section>
        )}

        {/* Cabeçalho do pagamento da cota (todos aceitaram) */}
        {splitPayMode && (
          <section className="space-y-2">
            <div className="rounded-2xl p-5"
              style={{ background: 'linear-gradient(135deg,#1e293b,#0f172a)', border: '1px solid rgba(52,211,153,0.35)' }}>
              <div className="flex items-center gap-2 mb-2">
                <span className="material-symbols-outlined text-[18px]" style={{ color: '#34d399' }}>handshake</span>
                <p className="text-[10px] font-mono uppercase tracking-widest" style={{ color: '#34d399' }}>Todos aceitaram — pague a sua parte</p>
              </div>
              <p className="text-3xl font-black" style={{ color: '#ffb690', fontFamily: 'Geist, sans-serif' }}>{formatCurrency(splitGate.amount)}</p>
              {splitGate.alreadyPaid > 0.01 && (
                <p className="text-xs font-mono mt-1" style={{ color: '#34d399' }}>já pago {formatCurrency(splitGate.alreadyPaid)}</p>
              )}
              <p className="text-[11px] mt-2 leading-relaxed" style={{ color: '#584237' }}>
                Este é o valor combinado na divisão. Escolha a forma de pagamento abaixo.
              </p>
            </div>
          </section>
        )}

        {/* ── View simplificada: pessoa já pagou sua parte ── */}
        {hasPaidMyShare && splitGate.kind === 'none' && (
          <div className="flex flex-col items-center justify-center py-20 space-y-6">
            <div className="w-20 h-20 rounded-full flex items-center justify-center"
              style={{ background: 'rgba(52,211,153,0.15)', border: '2px solid rgba(52,211,153,0.4)' }}>
              <span className="material-symbols-outlined text-[40px]" style={{ color: '#34d399', fontVariationSettings: "'FILL' 1" }}>check_circle</span>
            </div>
            <div className="text-center space-y-2">
              <p className="text-2xl font-black" style={{ fontFamily: 'Geist, sans-serif', color: '#34d399' }}>Sua parte quitada</p>
              <p className="text-sm font-semibold" style={{ color: '#dae2fd' }}>{formatCurrency(myAlreadyPaid)} pagos</p>
              {remaining > 0.01 && (
                <p className="text-xs" style={{ color: '#a78b7d' }}>
                  Falta {formatCurrency(remaining)} para fechar a mesa
                </p>
              )}
              {remaining <= 0.01 && (
                <p className="text-xs" style={{ color: '#34d399' }}>
                  A mesa está totalmente paga!
                </p>
              )}
            </div>
            {myPaymentRows.length > 0 && (
              <Link
                href={`/${params.slug}/receipts?session=${sessionId}`}
                className="flex items-center justify-center gap-2 px-6 py-3 rounded-xl text-xs font-mono font-semibold transition-all active:scale-95"
                style={{ background: 'rgba(30,41,59,0.7)', border: '1px solid #334155', color: '#ffb690' }}
              >
                <span className="material-symbols-outlined text-[16px]">history</span>
                Ver seus recibos
              </Link>
            )}
            <button
              onClick={goBack}
              className="flex items-center justify-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold transition-all active:scale-95"
              style={{ background: '#f97316', color: '#582200' }}
            >
              <span className="material-symbols-outlined">arrow_back</span>
              Voltar
            </button>
          </div>
        )}

        {/* ── Content normal (quando não pagou ainda) ── */}
        {((!hasPaidMyShare && splitGate.kind === 'none') || splitPayMode) && (
        <>

        {/* ── Saldo já pago ───────────────────────────── */}
        {sessionPaidTotal > 0 && (
          <div className="rounded-xl px-4 py-3 flex items-center gap-3"
            style={{
              background: sessionFullySettled ? 'rgba(52,211,153,0.12)' : 'rgba(52,211,153,0.08)',
              border: `1px solid ${sessionFullySettled ? 'rgba(52,211,153,0.35)' : 'rgba(52,211,153,0.2)'}`,
            }}>
            <span className="material-symbols-outlined text-[18px]" style={{ color: '#34d399', fontVariationSettings: sessionFullySettled ? "'FILL' 1" : "'FILL' 0" }}>
              {sessionFullySettled ? 'check_circle' : 'savings'}
            </span>
            <div>
              <p className="text-xs font-semibold" style={{ color: '#34d399' }}>
                {sessionFullySettled ? 'Mesa quitada!' : `Saldo já pago: ${formatCurrency(sessionPaidTotal)}`}
              </p>
              <p className="text-[10px]" style={{ color: '#a78b7d' }}>
                {sessionFullySettled
                  ? `${formatCurrency(sessionPaidTotal)} recebidos — nada mais a pagar na mesa.`
                  : `Total da mesa: ${formatCurrency(sessionGrandTotal)} → Restante: ${formatCurrency(remaining)}`}
              </p>
            </div>
          </div>
        )}

        {/* ── Modo de fechamento ──────────────────────── */}
        {!sessionFullySettled && splitGate.kind === 'none' && (
        <section className="space-y-3">
          <p className="text-[10px] font-mono uppercase tracking-widest" style={{ color: '#a78b7d' }}>Como você quer pagar?</p>

          {/* Opção primária: minha parte */}
          {!hasPaidMyShare && (
            <button
              onClick={() => setCloseMode('individual')}
              className="w-full flex items-center gap-4 p-4 rounded-xl text-left transition-all active:scale-[0.98]"
              style={{
                background: closeMode === 'individual' ? 'rgba(249,115,22,0.12)' : 'rgba(30,41,59,0.7)',
                border: `2px solid ${closeMode === 'individual' ? '#f97316' : '#334155'}`,
              }}>
              <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
                style={{ background: closeMode === 'individual' ? 'rgba(249,115,22,0.2)' : '#1e293b' }}>
                <span className="material-symbols-outlined text-[20px]"
                  style={{ color: closeMode === 'individual' ? '#f97316' : '#a78b7d', fontVariationSettings: closeMode === 'individual' ? "'FILL' 1" : "'FILL' 0" }}>
                  person
                </span>
              </div>
              <div className="flex-1">
                <p className="text-base font-bold" style={{ color: closeMode === 'individual' ? '#ffb690' : '#dae2fd', fontFamily: 'Geist, sans-serif' }}>
                  {isCounterSession ? 'Pagar meu pedido' : 'Só a minha parte'}
                </p>
                <p className="text-xs mt-0.5" style={{ color: '#a78b7d' }}>
                  {isCounterSession ? 'PIX, cartão ou dinheiro' : 'Pago apenas o que consumi'}
                </p>
              </div>
              {closeMode === 'individual' && (
                <span className="material-symbols-outlined text-[18px]" style={{ color: '#f97316', fontVariationSettings: "'FILL' 1" }}>radio_button_checked</span>
              )}
            </button>
          )}

          {hasPaidMyShare && (
            <div className="w-full flex items-center gap-4 p-4 rounded-xl"
              style={{ background: 'rgba(52,211,153,0.08)', border: '2px solid rgba(52,211,153,0.3)' }}>
              <span className="material-symbols-outlined text-[24px]" style={{ color: '#34d399', fontVariationSettings: "'FILL' 1" }}>check_circle</span>
              <div>
                <p className="text-sm font-bold" style={{ color: '#34d399' }}>Sua parte quitada ✓</p>
                <p className="text-xs" style={{ color: '#a78b7d' }}>{formatCurrency(myAlreadyPaid)} pagos</p>
              </div>
            </div>
          )}

          {/* Opção secundária: mesa toda — com fricção intencional */}
          {!sessionFullySettled && !isCounterSession && (
            <div>
              <button
                onClick={() => setShowTableConfirm(true)}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-all active:scale-[0.98]"
                style={{
                  background: closeMode === 'table' ? 'rgba(251,191,36,0.08)' : 'transparent',
                  border: `1px solid ${closeMode === 'table' ? 'rgba(251,191,36,0.4)' : 'rgba(88,66,55,0.3)'}`,
                }}>
                <span className="material-symbols-outlined text-[18px]" style={{ color: closeMode === 'table' ? '#fbbf24' : '#584237' }}>groups</span>
                <div className="flex-1">
                  <p className="text-sm font-semibold" style={{ color: closeMode === 'table' ? '#fbbf24' : '#a78b7d' }}>
                    Pagar pela mesa toda ou dividir
                  </p>
                  <p className="text-[11px]" style={{ color: '#584237' }}>
                    {closeMode === 'table'
                      ? `Pagando por todos · ${formatCurrency(remaining)}`
                      : 'Pague tudo ou divida a conta entre os participantes'}
                  </p>
                </div>
                <span className="material-symbols-outlined text-[16px]" style={{ color: '#584237' }}>chevron_right</span>
              </button>
            </div>
          )}
        </section>
        )}

        {/* ── Modal confirmação: fechar mesa toda ── */}
        {showTableConfirm && (
          <div className="fixed inset-0 z-[70] flex items-end justify-center px-4 pb-8"
            style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}>
            <div className="w-full max-w-md rounded-2xl p-6 space-y-5"
              style={{ background: '#1e293b', border: '1px solid rgba(251,191,36,0.4)' }}>
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
                  style={{ background: 'rgba(251,191,36,0.15)' }}>
                  <span className="material-symbols-outlined text-[22px]" style={{ color: '#fbbf24', fontVariationSettings: "'FILL' 1" }}>warning</span>
                </div>
                <div>
                  <p className="text-base font-bold" style={{ color: '#fbbf24' }}>Pagar pela mesa toda ou dividir?</p>
                  <p className="text-xs mt-1 leading-relaxed" style={{ color: '#a78b7d' }}>
                    Aqui você pode pagar a conta inteira da mesa <strong>ou dividir o valor</strong> entre os participantes — é só escolher quem paga e quanto na próxima etapa.
                  </p>
                </div>
              </div>

              <div className="rounded-xl p-4 space-y-2" style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(88,66,55,0.3)' }}>
                <div className="flex justify-between text-sm">
                  <span style={{ color: '#a78b7d' }}>Total da mesa</span>
                  <span className="font-bold" style={{ color: '#ffb690' }}>{formatCurrency(remaining)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span style={{ color: '#a78b7d' }}>Pessoas na mesa</span>
                  <span className="font-bold">{participants.length || '—'}</span>
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setShowTableConfirm(false)}
                  className="flex-1 py-3 rounded-xl text-sm font-bold transition-all active:scale-95"
                  style={{ background: '#131b2e', color: '#a78b7d', border: '1px solid #334155' }}>
                  Cancelar
                </button>
                <button
                  onClick={() => { setCloseMode('table'); setShowTableConfirm(false) }}
                  className="flex-[2] py-3 rounded-xl text-sm font-bold transition-all active:scale-95"
                  style={{ background: 'rgba(251,191,36,0.15)', color: '#fbbf24', border: '1px solid rgba(251,191,36,0.4)' }}>
                  Continuar · pagar ou dividir {formatCurrency(remaining)}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Modal: confirmação de pagamento duplo ── */}
        {showDoublePayConfirm && (
          <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center px-4 pb-8 sm:pb-0"
            style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}>
            <div className="w-full max-w-md rounded-2xl p-6 space-y-5"
              style={{ background: '#1e293b', border: '1px solid rgba(248,113,113,0.4)' }}>
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
                  style={{ background: 'rgba(248,113,113,0.15)' }}>
                  <span className="material-symbols-outlined text-[22px]" style={{ color: '#f87171', fontVariationSettings: "'FILL' 1" }}>warning</span>
                </div>
                <div>
                  <p className="text-base font-bold" style={{ color: '#f87171' }}>Você já pagou nesta mesa</p>
                  <p className="text-xs mt-1 leading-relaxed" style={{ color: '#a78b7d' }}>
                    Já registramos um pagamento seu de <strong style={{ color: '#dae2fd' }}>{formatCurrency(myAlreadyPaid)}</strong>.
                    Se você pagar de novo, será cobrado mais uma vez. Tem certeza que deseja pagar novamente?
                  </p>
                </div>
              </div>

              {myPaymentRows.length > 0 && (
                <PaymentReceiptList
                  payments={myPaymentRows}
                  context={receiptContext}
                  variant="customer"
                  compact
                  title="Seus pagamentos já registrados"
                />
              )}

              <div className="flex gap-3">
                <button
                  onClick={() => setShowDoublePayConfirm(false)}
                  className="flex-[2] py-3 rounded-xl text-sm font-bold transition-all active:scale-95"
                  style={{ background: '#131b2e', color: '#a78b7d', border: '1px solid #334155' }}>
                  Não, já paguei
                </button>
                <button
                  onClick={() => { setShowDoublePayConfirm(false); void handleProceed({ confirmedDoublePay: true }) }}
                  className="flex-1 py-3 rounded-xl text-sm font-bold transition-all active:scale-95"
                  style={{ background: 'rgba(248,113,113,0.15)', color: '#f87171', border: '1px solid rgba(248,113,113,0.4)' }}>
                  Pagar de novo
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Parte quitada + recibos ── */}
        {(hasPaidMyShare || sessionFullySettled) && (
          <section className="space-y-3">
            <div className="rounded-xl px-5 py-4 flex items-start gap-3"
              style={{ background: 'rgba(52,211,153,0.1)', border: '1px solid rgba(52,211,153,0.35)' }}>
              <span className="material-symbols-outlined text-[24px] shrink-0" style={{ color: '#34d399', fontVariationSettings: "'FILL' 1" }}>check_circle</span>
              <div>
                <p className="text-sm font-bold" style={{ color: '#34d399' }}>
                  {sessionFullySettled && !hasPaidMyShare
                    ? 'A mesa está totalmente paga!'
                    : 'Sua parte já está quitada!'}
                </p>
                <p className="text-xs mt-1 leading-relaxed" style={{ color: '#a78b7d' }}>
                  {sessionFullySettled && !hasPaidMyShare
                    ? 'Todos os pagamentos da mesa foram recebidos. Você não precisa pagar nada.'
                    : (
                      <>
                        Você pagou {formatCurrency(myAlreadyPaid)} do seu consumo de {formatCurrency(myConsumptionFull)}.
                        {remaining > 0.01
                          ? ` Falta ${formatCurrency(remaining)} para fechar a mesa.`
                          : ' A mesa está totalmente paga!'}
                      </>
                    )}
                </p>
              </div>
            </div>
            {myPaymentRows.length > 0 && (
              <>
                <PaymentReceiptList
                  payments={myPaymentRows}
                  context={receiptContext}
                  variant="customer"
                  compact
                  title="Seus recibos"
                />
                <Link
                  href={`/${params.slug}/receipts?session=${sessionId}`}
                  className="flex items-center justify-center gap-2 w-full py-3 rounded-xl text-xs font-mono font-semibold transition-all active:scale-95"
                  style={{ background: 'rgba(30,41,59,0.7)', border: '1px solid #334155', color: '#ffb690' }}
                >
                  <span className="material-symbols-outlined text-[16px]">history</span>
                  Ver histórico completo
                </Link>
              </>
            )}
          </section>
        )}

        {myPaymentRows.length > 0 && !hasPaidMyShare && (
          <section className="space-y-3">
            <PaymentReceiptList
              payments={myPaymentRows}
              context={receiptContext}
              variant="customer"
              compact
              title="Pagamentos anteriores"
            />
          </section>
        )}

        {closeMode === 'individual' && !hasPaidMyShare && splitGate.kind === 'none' && (
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
                      if (sessionId) sessionStorage.setItem(`kicomanda_split_alcohol_${sessionId}`, 'true')
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
                    if (sessionId) sessionStorage.removeItem(`kicomanda_split_alcohol_${sessionId}`)
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

            {(redeemableOffers.length > 0 || appliedOffers.length > 0) && (
              <div className="rounded-xl p-4 space-y-3"
                style={{ background: 'rgba(52,211,153,0.06)', border: '1px solid rgba(52,211,153,0.25)' }}>
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-[18px]" style={{ color: '#34d399' }}>redeem</span>
                  <p className="text-sm font-semibold" style={{ color: '#dae2fd' }}>Seus benefícios</p>
                </div>

                {appliedOffers.map(o => (
                  <div key={o.id} className="flex items-center justify-between rounded-lg px-3 py-2"
                    style={{ background: 'rgba(52,211,153,0.12)', border: '1px solid rgba(52,211,153,0.3)' }}>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold truncate" style={{ color: '#34d399' }}>{o.label}</p>
                      <p className="text-[10px] font-mono" style={{ color: '#a78b7d' }}>Aplicado à sua conta</p>
                    </div>
                    <span className="material-symbols-outlined text-[20px]" style={{ color: '#34d399', fontVariationSettings: "'FILL' 1" }}>check_circle</span>
                  </div>
                ))}

                {redeemableOffers.map(o => {
                  const est = computeOfferDiscount(o.benefit_type, o.benefit_value, myOpen.openSubtotal, includeServiceFee, unpaidItems)
                  const noValue = est.discountTotal <= 0.01
                  return (
                    <div key={o.id} className="flex items-center justify-between gap-3 rounded-lg px-3 py-2"
                      style={{ background: 'rgba(30,41,59,0.7)', border: '1px solid #334155' }}>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <p className="text-sm font-semibold truncate" style={{ color: '#dae2fd' }}>{o.label}</p>
                          <span className="text-[8px] font-mono px-1.5 py-0.5 rounded-full shrink-0"
                            style={o.source_rule_id
                              ? { background: 'rgba(52,211,153,0.15)', color: '#34d399', border: '1px solid rgba(52,211,153,0.3)' }
                              : { background: 'rgba(249,115,22,0.15)', color: '#ffb690', border: '1px solid rgba(249,115,22,0.3)' }}>
                            {o.source_rule_id ? 'FIDELIDADE' : 'CORTESIA'}
                          </span>
                        </div>
                        <p className="text-[10px] font-mono" style={{ color: noValue ? '#a78b7d' : '#34d399' }}>
                          {noValue ? 'Sem valor em aberto' : `Desconto de ${formatCurrency(est.discountTotal)}`}
                          {est.freeItemName ? ` · ${est.freeItemName}` : ''}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => applyOffer(o)}
                        disabled={noValue || applyingOfferId !== null}
                        className="shrink-0 px-3 py-1.5 rounded-lg text-xs font-bold font-mono transition-opacity disabled:opacity-40"
                        style={{ background: '#34d399', color: '#052e1b' }}
                      >
                        {applyingOfferId === o.id ? '...' : 'Aplicar'}
                      </button>
                    </div>
                  )
                })}
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

              {/* Extra contribution — oculto no dinheiro (valor extra na tela de dinheiro) */}
              {myIndividualBase > 0.01 && method !== 'cash' && (
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
        {closeMode === 'table' && splitGate.kind === 'none' && (
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

        {/* ── Couvert (destacado, sem taxa) ───────────── */}
        {splitGate.kind === 'none' && openCouvertBase > 0.01 && (
          <section>
            <div className="flex items-center justify-between rounded-xl px-4 py-3.5"
              style={{ background: 'rgba(249,115,22,0.08)', border: '1px solid rgba(249,115,22,0.25)' }}>
              <div className="flex items-center gap-2.5">
                <span className="material-symbols-outlined text-[20px]" style={{ color: '#f97316' }}>bakery_dining</span>
                <div>
                  <p className="text-sm font-semibold" style={{ color: '#ffb690' }}>Couvert</p>
                  <p className="text-[11px] mt-0.5" style={{ color: '#a78b7d' }}>
                    Incluso na conta {closeMode === 'individual' ? '' : 'da mesa '}· sem taxa de serviço
                  </p>
                </div>
              </div>
              <span className="text-sm font-bold font-mono" style={{ color: '#ffb690' }}>
                {formatCurrency(openCouvertBase)}
              </span>
            </div>
          </section>
        )}

        {/* ── Taxa de serviço opcional ────────────────── */}
        {splitGate.kind === 'none' && (
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
        )}

        {/* ── Método de pagamento ─────────────────────── */}
        {showPaymentFlow && (
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[18px]" style={{ color: '#7bd0ff' }}>payments</span>
            <p className="text-[10px] font-mono uppercase tracking-widest" style={{ color: '#a78b7d' }}>Forma de Pagamento</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {PAYMENT_METHODS.map(m => (
              <button
                key={m.value}
                onClick={() => !m.disabled && setMethod(m.value)}
                disabled={m.disabled}
                className="flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
                style={{
                  background: method === m.value ? 'rgba(249,115,22,0.1)' : 'rgba(30,41,59,0.7)',
                  borderColor: method === m.value ? '#f97316' : '#334155',
                }}>
                <span className="material-symbols-outlined text-[22px]" style={{ color: method === m.value ? '#f97316' : '#e0c0b1' }}>{m.icon}</span>
                <span className="text-xs font-mono" style={{ color: method === m.value ? '#f97316' : '#e0c0b1' }}>{m.label}</span>
              </button>
            ))}
          </div>
          {splitAlcohol && (
            <p className="text-[10px] font-mono text-center" style={{ color: '#a78b7d' }}>
              Dinheiro indisponível com recibos separados — use PIX ou cartão.
            </p>
          )}
        </section>
        )}
        </>
        )}
      </main>

      {/* CTA */}
      {sessionFullySettled && !showPaymentFlow && splitGate.kind === 'none' && (
        <div className="fixed bottom-20 left-0 right-0 px-6 py-3 z-40"
          style={{ background: 'rgba(11,19,38,0.88)', backdropFilter: 'blur(12px)', borderTop: '1px solid rgba(88,66,55,0.2)' }}>
          <div className="w-full h-14 rounded-xl flex items-center justify-center gap-2"
            style={{ background: 'rgba(52,211,153,0.12)', border: '1px solid rgba(52,211,153,0.3)' }}>
            <span className="material-symbols-outlined text-[20px]" style={{ color: '#34d399', fontVariationSettings: "'FILL' 1" }}>check_circle</span>
            <span className="text-sm font-semibold" style={{ color: '#34d399' }}>Mesa quitada — obrigado!</span>
          </div>
        </div>
      )}
      {showPaymentFlow && (splitGate.kind === 'none' || splitPayMode) && (
      <div className="fixed bottom-20 left-0 right-0 px-6 py-3 z-40"
        style={{ background: 'rgba(11,19,38,0.9)', backdropFilter: 'blur(12px)', borderTop: '1px solid rgba(88,66,55,0.2)' }}>
        <button
          onClick={() => handleProceed()}
          disabled={!canProceed || paying}
          className="w-full h-14 rounded-full font-semibold flex items-center justify-center gap-2 active:scale-95 transition-all disabled:opacity-40"
          style={{ background: '#f97316', color: '#582200', boxShadow: '0 8px 30px rgba(249,115,22,0.3)', fontFamily: 'Geist, sans-serif' }}>
          {paying ? (
            <><Loader2 className="h-5 w-5 animate-spin" /> Processando...</>
          ) : method === 'cash' ? (
            <>Informar valor em dinheiro<span className="material-symbols-outlined">payments</span></>
          ) : (
            <>Confirmar e Ir para Pagamento<span className="material-symbols-outlined">arrow_forward</span></>
          )}
        </button>
      </div>
      )}

      <CustomerBottomNav slug={params.slug} sessionId={sessionId ?? ''} />
    </div>
  )
}
