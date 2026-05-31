'use client'

import { Loader2 } from 'lucide-react'
import type { BillingInvoice } from '@/types/internal'
import { formatDocument } from '@/lib/restaurant-profile'

function brl(value: number) {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

type PreviewProps = {
  mode: 'preview'
  legalName?: string
  documentNumber?: string
  documentType?: 'cpf' | 'cnpj' | null
  contactEmail?: string
  planName?: string
  monthlyFee?: number
  platformFeePercent?: number
}

type ManageProps = {
  mode: 'manage'
  legalName?: string
  documentNumber?: string
  documentType?: 'cpf' | 'cnpj' | null
  contactEmail?: string
  planName?: string
  monthlyFee?: number
  platformFeePercent?: number
  recentInvoices?: BillingInvoice[]
  invoicing?: boolean
  onGenerateInvoice?: (markPaid: boolean) => void
}

type Props = (PreviewProps | ManageProps) & { embedded?: boolean }

export function RestaurantServiceNfePanel(props: Props) {
  const {
    embedded,
    legalName,
    documentNumber,
    documentType,
    contactEmail,
    planName,
    monthlyFee,
    platformFeePercent,
  } = props

  const hasTomador = Boolean(legalName?.trim() || documentNumber?.trim())
  const formattedDoc = documentNumber && documentType
    ? formatDocument(documentNumber, documentType)
    : null

  return (
    <section className={embedded ? 'space-y-4' : 'space-y-4 pt-4 border-t border-outline-variant'}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-mono uppercase tracking-widest text-on-surface-variant">NF-e de serviço</p>
          <h3 className="text-sm font-semibold text-on-surface mt-1">Nota fiscal Qomanda → restaurante</h3>
          <p className="text-sm text-on-surface-variant mt-1 leading-relaxed">
            NFS-e / NF-e emitida pela <strong className="text-on-surface font-medium">Qomanda</strong> para o CNPJ do restaurante,
            referente à mensalidade do plano e taxas de transação cobradas pela plataforma.
          </p>
        </div>
        <span className="text-[10px] font-mono uppercase px-2 py-1 rounded border shrink-0 text-amber-400 border-amber-500/30 bg-amber-500/10">
          Emissão automática em breve
        </span>
      </div>

      <div className="rounded-lg border border-outline-variant bg-surface-container-low px-4 py-3 text-xs text-on-surface-variant leading-relaxed">
        <span className="font-semibold text-on-surface">Não confundir:</span> isto <em>não</em> é a NF-e que o restaurante emite para o cliente na mesa.
        Essa configuração fica na aba <span className="font-mono text-on-surface">NF-e cliente</span>.
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <SummaryCard label="Tomador (restaurante)">
          {hasTomador ? (
            <>
              <p className="text-sm font-semibold text-on-surface">{legalName || '—'}</p>
              {formattedDoc && <p className="text-xs font-mono text-on-surface-variant mt-1">{formattedDoc}</p>}
              {contactEmail && <p className="text-xs text-on-surface-variant mt-1">{contactEmail}</p>}
            </>
          ) : (
            <p className="text-xs text-on-surface-variant">Preencha razão social e CNPJ/CPF na aba Estabelecimento.</p>
          )}
        </SummaryCard>

        <SummaryCard label="Itens faturados pela Qomanda">
          {planName ? (
            <>
              <p className="text-sm text-on-surface">Plano {planName}</p>
              {monthlyFee != null && (
                <p className="text-xs font-mono text-on-surface-variant mt-1">Mensalidade: {brl(monthlyFee)}/mês</p>
              )}
              {platformFeePercent != null && (
                <p className="text-xs font-mono text-on-surface-variant mt-0.5">Taxa de transação: {platformFeePercent.toFixed(2)}% sobre GMV processado</p>
              )}
            </>
          ) : (
            <p className="text-xs text-on-surface-variant">Selecione o plano na aba Plano Qomanda.</p>
          )}
        </SummaryCard>
      </div>

      <div className="rounded-lg border border-dashed border-outline-variant px-4 py-4 space-y-2">
        <p className="text-xs font-mono uppercase tracking-wider text-on-surface-variant">Como funcionará</p>
        <ul className="text-xs text-on-surface-variant space-y-1.5 list-disc pl-4">
          <li>Ao registrar o pagamento da mensalidade, a Qomanda emitirá NFS-e para o CNPJ cadastrado.</li>
          <li>O PDF/XML será enviado ao e-mail comercial do restaurante.</li>
          <li>Taxas de transação retidas no split podem compor nota complementar ou item separado (definição contábil pendente).</li>
        </ul>
      </div>

      {props.mode === 'manage' && (
        <ManageInvoices
          recentInvoices={props.recentInvoices}
          invoicing={props.invoicing}
          onGenerateInvoice={props.onGenerateInvoice}
        />
      )}
    </section>
  )
}

function SummaryCard({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-outline-variant bg-surface-dim px-4 py-3">
      <p className="text-[10px] font-mono uppercase tracking-wider text-on-surface-variant">{label}</p>
      <div className="mt-2">{children}</div>
    </div>
  )
}

function ManageInvoices({
  recentInvoices,
  invoicing,
  onGenerateInvoice,
}: {
  recentInvoices?: BillingInvoice[]
  invoicing?: boolean
  onGenerateInvoice?: (markPaid: boolean) => void
}) {
  return (
    <div className="pt-4 border-t border-outline-variant space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[10px] font-mono uppercase tracking-widest text-on-surface-variant">Faturas de mensalidade</p>
          <p className="text-xs text-on-surface-variant mt-1">
            Gere faturas do plano. Quando a emissão estiver ativa, cada pagamento registrado disparará a NF-e de serviço.
          </p>
        </div>
        {onGenerateInvoice && (
          <div className="flex gap-2">
            <button
              type="button"
              disabled={invoicing}
              onClick={() => onGenerateInvoice(false)}
              className="h-9 px-4 rounded-lg text-xs font-mono border border-outline-variant text-on-surface-variant hover:text-on-surface disabled:opacity-50"
            >
              Gerar fatura
            </button>
            <button
              type="button"
              disabled={invoicing}
              onClick={() => onGenerateInvoice(true)}
              className="h-9 px-4 rounded-lg text-xs font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 disabled:opacity-50 flex items-center gap-2"
            >
              {invoicing && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Registrar pagamento
            </button>
          </div>
        )}
      </div>

      <div className="divide-y divide-outline-variant rounded-lg border border-outline-variant">
        {(recentInvoices ?? []).map(inv => (
          <div key={inv.id} className="flex items-center justify-between px-4 py-3 text-sm">
            <div>
              <p className="font-mono text-on-surface">{inv.period_start} → {inv.period_end}</p>
              <p className="text-xs text-on-surface-variant">{inv.notes ?? 'Mensalidade Qomanda'}</p>
              <p className="text-[10px] font-mono uppercase text-amber-400/80 mt-1">NF-e serviço pendente</p>
            </div>
            <div className="text-right">
              <p className="font-mono font-semibold">{brl(Number(inv.amount))}</p>
              <p className="text-[10px] font-mono uppercase text-on-surface-variant">{inv.status}</p>
            </div>
          </div>
        ))}
        {!recentInvoices?.length && (
          <p className="py-6 text-sm text-on-surface-variant text-center">Nenhuma fatura ainda.</p>
        )}
      </div>
    </div>
  )
}
