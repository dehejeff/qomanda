'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { formatCurrency } from '@/lib/utils'
import {
  buildReceiptWhatsAppMessage,
  formatReceiptDate,
  paymentMethodLabel,
  splitReceiptMeta,
  type PaymentReceiptRecord,
  type ReceiptContext,
} from '@/lib/payment-receipt'

type Props = {
  payment: PaymentReceiptRecord
  context: ReceiptContext
  variant?: 'customer' | 'dashboard'
  compact?: boolean
}

const ACCENT = {
  customer: {
    food: { border: 'rgba(52,211,153,0.3)', label: '#34d399', emoji: '🍽️' },
    alcohol: { border: 'rgba(0,230,118,0.3)', label: '#00E676', emoji: '🍷' },
    neutral: { border: '#30363D', label: '#8B949E', emoji: '🧾' },
    codeBg: '#ffffff',
    codeText: '#0D1117',
    muted: '#8B949E',
    text: '#FFFFFF',
  },
  dashboard: {
    food: { border: 'rgba(52,211,153,0.35)', label: '#34d399', emoji: '🍽️' },
    alcohol: { border: 'rgba(0,230,118,0.35)', label: '#00E676', emoji: '🍷' },
    neutral: { border: 'var(--outline-variant)', label: 'var(--on-surface-variant)', emoji: '🧾' },
    codeBg: 'var(--surface-container-highest)',
    codeText: 'var(--on-surface)',
    muted: 'var(--on-surface-variant)',
    text: 'var(--on-surface)',
  },
} as const

export function PaymentReceiptCard({ payment, context, variant = 'customer', compact = false }: Props) {
  const [copied, setCopied] = useState(false)
  const meta = splitReceiptMeta(payment.split_type)
  const accent = ACCENT[variant][meta.accent]
  const code = payment.confirmation_code

  async function copyCode() {
    if (!code) return
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
      toast.success('Código copiado!')
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error('Não foi possível copiar.')
    }
  }

  const feeNote = payment.service_fee_included === false ? ' · sem taxa' : ''

  if (variant === 'dashboard') {
    return (
      <div className="rounded-xl p-4 space-y-3 tonal-layer-1 ghost-border" style={{ borderColor: accent.border }}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-on-surface">
              {accent.emoji} {meta.title}
            </p>
            <p className="text-[10px] font-mono text-on-surface-variant mt-0.5">
              {formatCurrency(payment.amount)} · {paymentMethodLabel(payment.method)}{feeNote}
            </p>
            <p className="text-[10px] font-mono text-on-surface-variant">
              {formatReceiptDate(payment.paid_at, payment.created_at)}
            </p>
          </div>
          {code && (
            <button
              type="button"
              onClick={copyCode}
              className="shrink-0 px-3 py-2 rounded-lg font-mono text-sm font-black tracking-widest bg-surface-container-highest hover:bg-surface-container-high transition-colors"
              title="Copiar código"
            >
              {copied ? '✓' : code}
            </button>
          )}
        </div>
        {!code && (
          <p className="text-[10px] font-mono text-on-surface-variant">Código pendente de confirmação</p>
        )}
      </div>
    )
  }

  return (
    <div
      className={`rounded-xl flex flex-col items-center gap-3 ${compact ? 'p-4' : 'p-5'}`}
      style={{
        background: 'linear-gradient(135deg,#21262D,#0f172a)',
        border: `1px solid ${accent.border}`,
      }}
    >
      <div className="w-full text-center">
        <p className="text-[10px] font-mono uppercase tracking-widest" style={{ color: accent.label }}>
          {accent.emoji} {meta.title}
        </p>
        <p className="text-[10px] font-mono mt-1" style={{ color: ACCENT.customer.muted }}>
          {formatCurrency(payment.amount)} · {paymentMethodLabel(payment.method)}{feeNote}
        </p>
        <p className="text-[10px] font-mono" style={{ color: ACCENT.customer.muted }}>
          {formatReceiptDate(payment.paid_at, payment.created_at)}
        </p>
      </div>

      {code ? (
        <>
          <div className="rounded-xl px-6 py-4" style={{ background: ACCENT.customer.codeBg }}>
            <p className={`font-black tracking-widest text-center ${compact ? 'text-2xl' : 'text-3xl'}`} style={{ color: ACCENT.customer.codeText }}>
              {code}
            </p>
          </div>
          <div className="flex gap-2 w-full">
            <button
              type="button"
              onClick={copyCode}
              className="flex-1 h-9 rounded-lg text-xs font-mono font-semibold transition-all active:scale-95"
              style={{ background: 'rgba(52,211,153,0.12)', color: '#34d399', border: '1px solid rgba(52,211,153,0.25)' }}
            >
              {copied ? 'Copiado!' : 'Copiar código'}
            </button>
          </div>
          <p className="text-xs text-center" style={{ color: meta.accent === 'food' ? '#34d399' : ACCENT.customer.muted }}>
            {meta.subtitle}
          </p>
        </>
      ) : (
        <p className="text-xs text-center" style={{ color: ACCENT.customer.muted }}>
          Aguardando confirmação do pagamento
        </p>
      )}
    </div>
  )
}

export function buildReceiptShareText(payment: PaymentReceiptRecord, context: ReceiptContext) {
  return buildReceiptWhatsAppMessage(payment, context)
}
