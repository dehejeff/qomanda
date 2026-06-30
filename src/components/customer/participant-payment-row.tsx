import { formatCurrency } from '@/lib/utils'
import type { CustomerBilling } from '@/lib/session-billing'

type Props = {
  name: string
  isMe: boolean
  billing: CustomerBilling
  payerNames?: Record<string, string>
}

export function ParticipantPaymentRow({ name, isMe, billing, payerNames = {} }: Props) {
  const {
    subtotal,
    paid,
    remaining,
    amountDue,
    amountDueWithFee,
    amountDueWithoutFee,
    serviceFeeIncluded,
    status,
    paidBySelf,
    coveredBy,
  } = billing

  const coveredByOthers = (coveredBy ?? []).filter(c => c.amount > 0.01)
  const fullyPaidByOthers = status === 'paid' && (paidBySelf ?? 0) <= 0.01 && coveredByOthers.length > 0
  const partiallyCovered = coveredByOthers.length > 0 && !fullyPaidByOthers

  function payerLabel(payerId: string) {
    return payerNames[payerId] ?? 'outro cliente'
  }

  const icon =
    status === 'paid' ? 'check_circle'
    : status === 'partial' ? 'hourglass_top'
    : 'pending'

  const iconColor =
    status === 'paid' ? '#34d399'
    : status === 'partial' ? '#f59e0b'
    : '#8B949E'

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
              {fullyPaidByOthers ? (
                <>
                  Pago por {coveredByOthers.map(c => payerLabel(c.payerId)).join(', ')}
                  {' '}({formatCurrency(paid)})
                </>
              ) : (
                <>
                  Pago {formatCurrency(paid)}
                  {partiallyCovered && (
                    <span style={{ color: '#8B949E' }}>
                      {' '}· incl. {formatCurrency(coveredByOthers.reduce((s, c) => s + c.amount, 0))} de {payerLabel(coveredByOthers[0].payerId)}
                    </span>
                  )}
                </>
              )}
              {serviceFeeIncluded === false && (
                <span style={{ color: '#8B949E' }}> · sem taxa de serviço</span>
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
              <p className="text-[10px] font-mono" style={{ color: '#30363D' }}>
                Total da conta: {formatCurrency(amountDue)}
              </p>
            </div>
          )}

          {status === 'pending' && subtotal > 0 && (
            <div className="mt-1 space-y-0.5">
              {serviceFeeIncluded === false ? (
                <p className="text-xs font-mono font-semibold" style={{ color: '#00E676' }}>
                  Falta {formatCurrency(amountDueWithoutFee)}
                  <span className="font-normal" style={{ color: '#8B949E' }}> · sem taxa</span>
                </p>
              ) : (
                <>
                  <p className="text-xs font-mono font-semibold" style={{ color: '#00E676' }}>
                    Falta {formatCurrency(amountDueWithFee)}
                  </p>
                  <p className="text-[10px] font-mono" style={{ color: '#30363D' }}>
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
              {fullyPaidByOthers ? 'Pago por outro' : 'Quitado'}
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
