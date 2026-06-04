'use client'

import { useCallback, useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import type { BillingInvoice } from '@/types/internal'
import { formatDocument } from '@/lib/restaurant-profile'

type ServiceNote = {
  id: string
  billing_invoice_id: string
  status: 'pending' | 'processing' | 'issued' | 'error' | 'simulated' | 'cancelled'
  number: string | null
  danfe_url: string | null
  error_message: string | null
}

const SERVICE_STATUS: Record<ServiceNote['status'], { label: string; cls: string }> = {
  pending: { label: 'Pendente', cls: 'text-on-surface-variant border-outline-variant bg-surface-dim' },
  processing: { label: 'Processando', cls: 'text-sky-400 border-sky-500/30 bg-sky-500/10' },
  issued: { label: 'Emitida', cls: 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10' },
  simulated: { label: 'Simulada', cls: 'text-amber-400 border-amber-500/30 bg-amber-500/10' },
  error: { label: 'Erro', cls: 'text-red-400 border-red-500/30 bg-red-500/10' },
  cancelled: { label: 'Cancelada', cls: 'text-on-surface-variant border-outline-variant bg-surface-dim' },
}

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
  clientId: string
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
        <span className="text-[10px] font-mono uppercase px-2 py-1 rounded border shrink-0 text-emerald-400 border-emerald-500/30 bg-emerald-500/10">
          Emite ao pagar
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
        <p className="text-xs font-mono uppercase tracking-wider text-on-surface-variant">Como funciona</p>
        <ul className="text-xs text-on-surface-variant space-y-1.5 list-disc pl-4">
          <li>Quando a fatura da mensalidade é paga, a Qomanda emite a NFS-e para o CNPJ cadastrado.</li>
          <li>O link do PDF é enviado ao e-mail comercial do restaurante.</li>
          <li>Sem credenciais fiscais da Qomanda, a nota é registrada como <em>Simulada</em> (fluxo testável); com credenciais, vira emissão real.</li>
        </ul>
      </div>

      {props.mode === 'manage' && (
        <ManageInvoices
          clientId={props.clientId}
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
  clientId,
  recentInvoices,
  invoicing,
  onGenerateInvoice,
}: {
  clientId: string
  recentInvoices?: BillingInvoice[]
  invoicing?: boolean
  onGenerateInvoice?: (markPaid: boolean) => void
}) {
  const [notes, setNotes] = useState<Record<string, ServiceNote>>({})
  const [simulated, setSimulated] = useState(false)
  const [emittingId, setEmittingId] = useState<string | null>(null)

  const loadNotes = useCallback(async () => {
    try {
      const res = await fetch(`/api/internal/clients/${clientId}/service-nfe`)
      const data = await res.json()
      if (!res.ok) return
      const map: Record<string, ServiceNote> = {}
      for (const n of (data.serviceNotes ?? []) as ServiceNote[]) map[n.billing_invoice_id] = n
      setNotes(map)
      setSimulated(Boolean(data.simulated))
    } catch { /* silencioso */ }
  }, [clientId])

  useEffect(() => { loadNotes() }, [loadNotes])

  // Recarrega notas quando a lista de faturas muda (ex.: após registrar pagamento).
  useEffect(() => { loadNotes() }, [recentInvoices, loadNotes])

  async function emitNote(billingInvoiceId: string) {
    setEmittingId(billingInvoiceId)
    try {
      const res = await fetch(`/api/internal/clients/${clientId}/service-nfe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ billingInvoiceId }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? reasonLabel(data.reason) ?? 'Falha ao emitir.')
      toast.success(data.status === 'simulated' ? 'NF-e de serviço registrada (simulada).' : 'NF-e de serviço emitida.')
      await loadNotes()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao emitir nota.')
    } finally {
      setEmittingId(null)
    }
  }

  return (
    <div className="pt-4 border-t border-outline-variant space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[10px] font-mono uppercase tracking-widest text-on-surface-variant">Faturas de mensalidade</p>
          <p className="text-xs text-on-surface-variant mt-1">
            Gere faturas do plano. Ao registrar o pagamento, a NF-e de serviço é emitida automaticamente
            {simulated && <span className="text-amber-400"> (modo simulado — sem credenciais fiscais da Qomanda)</span>}.
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
        {(recentInvoices ?? []).map(inv => {
          const note = notes[inv.id]
          const st = note ? SERVICE_STATUS[note.status] : null
          const busy = emittingId === inv.id
          return (
            <div key={inv.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm">
              <div className="min-w-0">
                <p className="font-mono text-on-surface">{inv.period_start} → {inv.period_end}</p>
                <p className="text-xs text-on-surface-variant">{inv.notes ?? 'Mensalidade Qomanda'}</p>
                <div className="flex items-center gap-2 mt-1.5">
                  {st ? (
                    <span className={`text-[10px] font-mono uppercase px-1.5 py-0.5 rounded border ${st.cls}`}>NF-e {st.label}</span>
                  ) : (
                    <span className="text-[10px] font-mono uppercase text-on-surface-variant">NF-e não emitida</span>
                  )}
                  {note?.danfe_url && (
                    <a href={note.danfe_url} target="_blank" rel="noreferrer" className="text-[10px] font-mono text-primary hover:opacity-80">PDF →</a>
                  )}
                  {note?.status === 'error' && note.error_message && (
                    <span className="text-[10px] text-red-400 truncate max-w-[200px]" title={note.error_message}>{note.error_message}</span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <div className="text-right">
                  <p className="font-mono font-semibold">{brl(Number(inv.amount))}</p>
                  <p className="text-[10px] font-mono uppercase text-on-surface-variant">{inv.status}</p>
                </div>
                {(!note || note.status === 'error' || note.status === 'cancelled') && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => emitNote(inv.id)}
                    className="h-8 px-3 rounded-lg text-[11px] font-mono border border-outline-variant text-on-surface-variant hover:text-on-surface disabled:opacity-50 flex items-center gap-1.5"
                  >
                    {busy && <Loader2 className="w-3 h-3 animate-spin" />}
                    Emitir NF-e
                  </button>
                )}
              </div>
            </div>
          )
        })}
        {!recentInvoices?.length && (
          <p className="py-6 text-sm text-on-surface-variant text-center">Nenhuma fatura ainda.</p>
        )}
      </div>
    </div>
  )
}

function reasonLabel(reason?: string): string | null {
  if (!reason) return null
  const map: Record<string, string> = {
    tomador_document_missing: 'Cadastre o CNPJ/CPF do restaurante na aba Estabelecimento.',
    zero_amount: 'Fatura sem valor.',
    invoice_not_found: 'Fatura não encontrada.',
    restaurant_not_found: 'Restaurante não encontrado.',
    db_insert_failed: 'Falha ao gravar a nota.',
  }
  return map[reason] ?? null
}
