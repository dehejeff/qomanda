import { formatCurrency } from '@/lib/utils'

/**
 * Fluxo de divisão da conta (item 5):
 *
 * 1. O iniciador escolhe "Pagar pela mesa toda ou dividir", seleciona os
 *    participantes e o valor de cada um → cria um `close_requests` (mode
 *    'table') + um `close_request_participants` por pessoa. O iniciador já
 *    entra como 'confirmed'; os demais ficam 'pending'.
 * 2. Cada convidado PRECISA aceitar (status 'confirmed') ou recusar
 *    (status 'declined'). Uma recusa cancela a divisão (request 'cancelled').
 * 3. Só depois que TODOS aceitam, cada participante paga a sua cota.
 *    Quem não foi selecionado fica bloqueado (não paga nem a comanda
 *    individual) enquanto a divisão estiver ativa.
 */

const TOLERANCE = 0.02

export type CloseRequestParticipantStatus = 'pending' | 'confirmed' | 'paid' | 'declined'

export type CloseRequestParticipant = {
  id: string
  customerId: string
  name: string
  amountOwed: number
  status: CloseRequestParticipantStatus
}

export type ActiveCloseRequest = {
  id: string
  initiatorId: string
  initiatorName: string
  participants: CloseRequestParticipant[]
}

export type SplitGate =
  | { kind: 'none' }
  | { kind: 'invited'; requestId: string; participantId: string; amount: number; initiatorName: string; others: string[] }
  | { kind: 'waiting'; amount: number; pendingNames: string[] }
  | { kind: 'pay'; amount: number; alreadyPaid: number }
  | { kind: 'paid'; amount: number }
  | { kind: 'locked'; initiatorName: string }

/**
 * Calcula em que estado o cliente atual está dentro de uma divisão de conta.
 * `myPaidInSession` é o total já pago por este cliente na sessão (tabela payments).
 */
export function computeSplitGate(
  request: ActiveCloseRequest | null,
  myCustomerId: string | null,
  myPaidInSession: number,
): SplitGate {
  if (!request || !myCustomerId) return { kind: 'none' }

  // Participantes que continuam na divisão (ignora quem recusou).
  const active = request.participants.filter(p => p.status !== 'declined')

  // Divisão "real" exige pelo menos 2 pessoas. Com só o iniciador, é
  // pagamento normal da mesa — sem trava de aceite.
  if (active.length <= 1) return { kind: 'none' }

  const mine = request.participants.find(p => p.customerId === myCustomerId)

  // Não fui selecionado (ou recusei) → bloqueado enquanto a divisão roda.
  if (!mine || mine.status === 'declined') {
    return { kind: 'locked', initiatorName: request.initiatorName }
  }

  // Fui convidado mas ainda não aceitei.
  if (mine.status === 'pending') {
    return {
      kind: 'invited',
      requestId: request.id,
      participantId: mine.id,
      amount: mine.amountOwed,
      initiatorName: request.initiatorName,
      others: active.filter(p => p.customerId !== myCustomerId).map(p => p.name),
    }
  }

  // Já aceitei (confirmed/paid). Falta alguém aceitar?
  const allAccepted = active.every(p => p.status !== 'pending')
  if (!allAccepted) {
    return {
      kind: 'waiting',
      amount: mine.amountOwed,
      pendingNames: active.filter(p => p.status === 'pending').map(p => p.name),
    }
  }

  // Todos aceitaram → cada um paga a sua cota.
  if (myPaidInSession >= mine.amountOwed - TOLERANCE) {
    return { kind: 'paid', amount: mine.amountOwed }
  }
  return { kind: 'pay', amount: mine.amountOwed, alreadyPaid: myPaidInSession }
}

/** Mensagem de WhatsApp convidando um participante a aceitar sua parte. */
export function buildSplitInviteMessage(args: {
  restaurantName: string
  tableNumber: string
  initiatorName: string
  amount: number
  link: string
}): string {
  const { restaurantName, tableNumber, initiatorName, amount, link } = args
  return (
    `🧾 *${restaurantName}*\n` +
    `Mesa ${tableNumber}\n\n` +
    `*${initiatorName}* quer dividir a conta com você.\n` +
    `Sua parte: *${formatCurrency(amount)}*\n\n` +
    `Toque para aceitar e pagar a sua parte:\n${link}\n\n` +
    `A divisão só é fechada quando todos aceitarem.`
  )
}
