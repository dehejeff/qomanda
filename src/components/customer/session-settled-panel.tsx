'use client'

import { formatCurrency } from '@/lib/utils'

export type SessionPaymentReceipt = {
  confirmation_code: string | null
  amount: number
  split_type?: string | null
}

const SPLIT_LABEL: Record<string, string> = {
  food: 'Alimentação',
  alcohol: 'Bebidas',
  combined: 'Pagamento',
}

type Props = {
  tableNumber: string
  payments: SessionPaymentReceipt[]
  onLeaveRestaurant: () => void
}

export function SessionSettledPanel({ tableNumber, payments, onLeaveRestaurant }: Props) {
  const codes = payments.filter(p => p.confirmation_code)

  return (
    <div className="rounded-xl overflow-hidden"
      style={{ background: 'linear-gradient(145deg, rgba(52,211,153,0.12) 0%, rgba(30,41,59,0.9) 100%)', border: '1px solid rgba(52,211,153,0.35)' }}>
      <div className="px-5 py-4 flex items-start gap-3">
        <span className="material-symbols-outlined text-[28px] shrink-0" style={{ color: '#34d399', fontVariationSettings: "'FILL' 1" }}>verified</span>
        <div>
          <p className="text-base font-bold" style={{ color: '#34d399' }}>Mesa {tableNumber} — 100% paga</p>
          <p className="text-sm mt-1 leading-relaxed" style={{ color: '#e0c0b1' }}>
            Apresente o código abaixo ao garçom ou na saída para confirmar seu pagamento.
          </p>
        </div>
      </div>

      {codes.length > 0 ? (
        <div className="px-5 pb-4 space-y-3">
          {codes.map((p, i) => (
            <div key={`${p.confirmation_code}-${i}`} className="rounded-xl p-4 flex flex-col items-center gap-2"
              style={{ background: '#0b1326', border: '1px solid #334155' }}>
              {p.split_type && p.split_type !== 'combined' && (
                <p className="text-[10px] font-mono uppercase tracking-widest" style={{ color: '#a78b7d' }}>
                  {SPLIT_LABEL[p.split_type] ?? p.split_type}
                </p>
              )}
              <div className="bg-white rounded-xl px-6 py-3 w-full text-center">
                <p className="text-3xl font-black tracking-widest" style={{ color: '#0b1326', fontFamily: 'Geist, sans-serif' }}>
                  {p.confirmation_code}
                </p>
              </div>
              <p className="text-xs font-mono" style={{ color: '#ffb690' }}>{formatCurrency(p.amount)}</p>
            </div>
          ))}
        </div>
      ) : (
        <div className="px-5 pb-4">
          <p className="text-xs font-mono text-center py-3 rounded-xl" style={{ background: '#0b1326', color: '#a78b7d', border: '1px solid #334155' }}>
            Sua parte foi quitada por outro participante da mesa. Você pode sair quando quiser.
          </p>
        </div>
      )}

      <div className="px-5 pb-5">
        <button
          type="button"
          onClick={onLeaveRestaurant}
          className="w-full h-12 rounded-xl text-sm font-bold font-mono flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
          style={{ background: '#f97316', color: '#582200', boxShadow: '0 8px 24px rgba(249,115,22,0.25)' }}
        >
          <span className="material-symbols-outlined text-[20px]">logout</span>
          Sair do restaurante
        </button>
        <p className="text-[10px] font-mono text-center mt-2 leading-relaxed" style={{ color: '#584237' }}>
          Você continua logado no KiComanda e pode acessar recibos e histórico no Hub.
        </p>
      </div>
    </div>
  )
}
