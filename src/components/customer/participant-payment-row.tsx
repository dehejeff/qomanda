import { formatCurrency } from '@/lib/utils'
import type { CustomerBilling } from '@/lib/session-billing'

type Props = {
  name: string
  isMe: boolean
  billing: CustomerBilling
}

export function ParticipantPaymentRow({ name, isMe, billing }: Props) {
  const {
    subtotal,
    paid,
    remaining,
    amountDue,
    amountDueWithFee,
    amountDueWithoutFee,
    serviceFeeIncluded,
    status,
  } = billing

  const icon =
    status === 'paid' ? 'check_circle'
    : status === 'partial' ? 'hourglass_top'
    : 'pending'

  const iconColor =
    status === 'paid' ? '#34d399'
    : status === 'partial' ? '#f59e0b'
    : '#a78b7d'

  return (
    <div className="rounded-lg px-3 py-2.5 space-y-1"
      style={{ background: 'rgba(15,23,42,0.5)', border: '1px solid rgba(88,66,55,0.15)' }}>
      <div className="flex items-start gap-2.5">
        <span className="material-symbols-outlined text-[18px] shrink-0 mt-0.5"
          style={{ color: iconColor, fontVariationSettings: status === 'paid' ? "'FILL' 1" : "'FILL' 0" }}>
          {icon}
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium leading-tight truncate">
            {name}
            {isMe && <span className="text-[10px] font-mono ml-1" style={{ color: '#34d399' }}>(você)</span>}
          </p>

          {status === 'paid' && (
            <p className="text-xs font-mono mt-1" style={{ color: '#34d399' }}>
              Pago {formatCurrency(paid)}
              {serviceFeeIncluded === false && (
                <span style={{ color: '#a78b7d' }}> · sem taxa de serviço</span>
              )}
            </p>
          )}

          {status === 'partial' && (
            <div className="mt-1 space-y-0.5">
              <p className="text-xs font-mono" style={{ color: '#34d399' }}>
                Pago {formatCurrency(paid)}
              </p>
              <p className="text-xs font-mono font-semibold" style={{ color: '#f87171' }}>
                Falta {formatCurrency(remaining)}
              </p>
              <p className="text-[10px] font-mono" style={{ color: '#584237' }}>
                Total da conta: {formatCurrency(amountDue)}
              </p>
            </div>
          )}

          {status === 'pending' && subtotal > 0 && (
            <div className="mt-1 space-y-0.5">
              {serviceFeeIncluded === false ? (
                <p className="text-xs font-mono font-semibold" style={{ color: '#ffb690' }}>
                  Falta {formatCurrency(amountDueWithoutFee)}
                  <span className="font-normal" style={{ color: '#a78b7d' }}> · sem taxa</span>
                </p>
              ) : (
                <>
                  <p className="text-xs font-mono font-semibold" style={{ color: '#ffb690' }}>
                    Falta {formatCurrency(amountDueWithFee)}
                  </p>
                  <p className="text-[10px] font-mono" style={{ color: '#584237' }}>
                    ou {formatCurrency(amountDueWithoutFee)} sem taxa de serviço
                  </p>
                </>
              )}
            </div>
          )}
        </div>

        <div className="text-right shrink-0">
          {status === 'paid' && (
            <span className="text-[9px] font-mono font-bold uppercase px-1.5 py-0.5 rounded"
              style={{ background: 'rgba(52,211,153,0.12)', color: '#34d399', border: '1px solid rgba(52,211,153,0.25)' }}>
              Quitado
            </span>
          )}
          {status === 'partial' && (
            <span className="text-[9px] font-mono font-bold uppercase px-1.5 py-0.5 rounded"
              style={{ background: 'rgba(245,158,11,0.12)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.25)' }}>
              Parcial
            </span>
          )}
          {status === 'pending' && subtotal > 0 && (
            <span className="text-[9px] font-mono font-bold uppercase px-1.5 py-0.5 rounded"
              style={{ background: 'rgba(248,113,113,0.1)', color: '#f87171', border: '1px solid rgba(248,113,113,0.2)' }}>
              Pendente
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
