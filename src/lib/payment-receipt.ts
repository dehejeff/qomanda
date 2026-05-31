import { formatCurrency } from '@/lib/utils'

export type PaymentReceiptRecord = {
  id: string
  amount: number
  method: string
  split_type: 'food' | 'alcohol' | 'combined'
  service_fee_included?: boolean | null
  confirmation_code: string | null
  paid_at: string | null
  created_at: string
}

export type ReceiptContext = {
  restaurantName: string
  tableNumber: string
}

const SPLIT_LABELS: Record<PaymentReceiptRecord['split_type'], { title: string; subtitle: string; accent: 'food' | 'alcohol' | 'neutral' }> = {
  food: {
    title: 'Alimentação (Empresa)',
    subtitle: 'Reembolsável · RH',
    accent: 'food',
  },
  alcohol: {
    title: 'Bebidas Alcoólicas',
    subtitle: 'Conta pessoal · sem taxa',
    accent: 'alcohol',
  },
  combined: {
    title: 'Conta',
    subtitle: 'Pagamento confirmado',
    accent: 'neutral',
  },
}

const METHOD_LABELS: Record<string, string> = {
  pix: 'PIX',
  credit: 'Crédito',
  debit: 'Débito',
  offer: 'Benefício',
  cash: 'Dinheiro',
}

export function splitReceiptMeta(splitType: PaymentReceiptRecord['split_type']) {
  return SPLIT_LABELS[splitType] ?? SPLIT_LABELS.combined
}

export function paymentMethodLabel(method: string) {
  return METHOD_LABELS[method.toLowerCase()] ?? method.toUpperCase()
}

export function formatReceiptDate(paidAt: string | null, createdAt: string) {
  const raw = paidAt ?? createdAt
  return new Date(raw).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function buildReceiptWhatsAppMessage(
  payment: PaymentReceiptRecord,
  context: ReceiptContext,
) {
  const date = new Date(payment.paid_at ?? payment.created_at).toLocaleDateString('pt-BR')
  const meta = splitReceiptMeta(payment.split_type)
  const label = payment.split_type === 'combined'
    ? undefined
    : payment.split_type === 'food'
      ? '🍽️ Alimentação'
      : '🍷 Bebidas Alcoólicas'
  const header = label
    ? `🧾 *${context.restaurantName}*\n${label}\nMesa: ${context.tableNumber} | Data: ${date}`
    : `🧾 *${context.restaurantName}*\nMesa: ${context.tableNumber} | Data: ${date}`
  const code = payment.confirmation_code ?? '—'
  return `${header}\n\n*Total: ${formatCurrency(payment.amount)}*\n\nCódigo de confirmação: *${code}*\n\n_${meta.subtitle}_\n\n_A NF-e será emitida e enviada em seguida._`
}
