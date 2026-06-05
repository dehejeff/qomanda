'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import type { NfeIntegrationDto } from '@/app/api/dashboard/integrations/nfe/route'
import {
  RestaurantNfeFields,
  emptyNfeForm,
  nfeFormToInput,
  type NfeFormState,
} from '@/components/internal/restaurant-nfe-fields'
import { NFE_STATUS_LABEL } from '@/lib/restaurant-nfe'

function profileToForm(nfe: NfeIntegrationDto): NfeFormState {
  const taxRegime = nfe.nfe_tax_regime ?? (nfe.documentType === 'cpf' ? 'mei' : '')
  return {
    nfeEnabled: nfe.nfe_enabled,
    nfeStatus: nfe.nfe_status,
    nfeProvider: nfe.nfe_provider ?? '',
    nfeNoteType: nfe.nfe_note_type ?? '',
    nfeEnvironment: nfe.nfe_environment,
    nfeProviderToken: '',
    nfeProviderCompanyId: nfe.nfe_provider_company_id ?? '',
    nfeStateRegistration: nfe.nfe_state_registration ?? '',
    nfeMunicipalRegistration: nfe.nfe_municipal_registration ?? '',
    nfeTaxRegime: taxRegime,
    nfeCnae: nfe.nfe_cnae ?? '',
    nfeInvoiceSeries: nfe.nfe_invoice_series ?? '1',
    nfeNextInvoiceNumber: nfe.nfe_next_invoice_number != null ? String(nfe.nfe_next_invoice_number) : '',
    nfeAutoEmit: nfe.nfe_auto_emit,
    nfeSplitFoodDrinks: nfe.nfe_split_food_drinks,
    nfeNotes: nfe.nfe_notes ?? '',
  }
}

function formatDocument(type: 'cpf' | 'cnpj' | null, raw: string | null): string | null {
  if (!raw) return null
  const digits = raw.replace(/\D/g, '')
  if (type === 'cnpj' && digits.length === 14) {
    return digits.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5')
  }
  if (type === 'cpf' && digits.length === 11) {
    return digits.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, '$1.$2.$3-$4')
  }
  return raw
}

export function RestaurantNfePanel() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [nfe, setNfe] = useState<NfeIntegrationDto | null>(null)
  const [form, setForm] = useState<NfeFormState>(emptyNfeForm())

  async function load() {
    try {
      const res = await fetch('/api/dashboard/integrations/nfe')
      const data = await res.json()
      if (res.ok && data.nfe) {
        const integration = data.nfe as NfeIntegrationDto
        setNfe(integration)
        setForm(profileToForm(integration))
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load().catch(() => setLoading(false)) }, [])

  async function save() {
    setSaving(true)
    try {
      const res = await fetch('/api/dashboard/integrations/nfe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(nfeFormToInput(form)),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Erro ao salvar NF-e.')
      if (data.nfe) {
        const integration = data.nfe as NfeIntegrationDto
        setNfe(integration)
        setForm(profileToForm(integration))
      }
      toast.success(data.message ?? 'Configuração salva!')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao salvar NF-e.')
    } finally {
      setSaving(false)
    }
  }

  const statusBadge = nfe?.nfe_status === 'active'
    ? 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10'
    : nfe?.nfe_status === 'pending'
      ? 'text-amber-400 border-amber-500/30 bg-amber-500/10'
      : nfe?.nfe_status === 'error'
        ? 'text-red-400 border-red-500/30 bg-red-500/10'
        : 'text-on-surface-variant border-outline-variant'

  const docLabel = formatDocument(nfe?.documentType ?? null, nfe?.documentNumber ?? null)

  return (
    <div className="bg-surface-container border border-outline-variant rounded-xl overflow-hidden">
      <div className="px-6 py-4 flex items-center gap-4 border-b border-outline-variant"
        style={{ background: 'linear-gradient(135deg, rgba(123,208,255,0.08), transparent)' }}>
        <div className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl"
          style={{ background: 'rgba(123,208,255,0.1)', border: '1px solid rgba(123,208,255,0.2)' }}>
          🧾
        </div>
        <div className="flex-1">
          <h3 className="text-base font-semibold text-on-surface">Nota Fiscal Eletrônica (NF-e)</h3>
          <p className="text-sm text-on-surface-variant mt-0.5">
            Emissão automática integrada com Focus NFe, NFe.io ou similar. Documento aceito para reembolso corporativo.
          </p>
          {docLabel && (
            <p className="text-xs text-on-surface-variant mt-1 font-mono">
              {nfe?.documentType === 'cnpj' ? 'CNPJ' : 'CPF'} cadastrado: {docLabel}
            </p>
          )}
        </div>
        <span className={`text-[10px] font-mono px-2 py-1 rounded border shrink-0 ${statusBadge}`}>
          {loading ? '…' : (nfe?.statusLabel ?? NFE_STATUS_LABEL.disabled).toUpperCase()}
        </span>
      </div>

      <div className="px-6 py-5 space-y-4">
        {loading ? (
          <p className="text-sm text-on-surface-variant">Carregando configuração…</p>
        ) : (
          <>
            <div className="rounded-lg border border-outline-variant bg-surface-container-low px-4 py-3 text-xs text-on-surface-variant leading-relaxed">
              <span className="font-semibold text-on-surface">Antes de começar:</span> cadastre o certificado digital A1
              diretamente no painel do seu emissor (Focus NFe, NFe.io, Nota Simples, etc.). A Qomanda usa apenas o token
              de API para emitir a nota após o pagamento. Para enviar ao cliente, configure o WhatsApp na seção acima.
            </div>

            <RestaurantNfeFields
              form={form}
              setForm={setForm}
              documentType={nfe?.documentType}
              hasExistingToken={nfe?.has_provider_token}
              embedded
              audience="restaurant"
            />

            {!form.nfeEnabled && (
              <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 flex items-start gap-3">
                <span className="material-symbols-outlined text-[20px] text-emerald-400 shrink-0">check_circle</span>
                <div className="text-xs text-emerald-100/90 leading-relaxed">
                  <span className="font-semibold text-emerald-300 block">Este estabelecimento não emite nota fiscal ao consumidor pela Qomanda.</span>
                  Escolha válida — comum para quem já emite por PDV/SAT próprio. Os clientes não verão nem receberão NF-e. Para passar a emitir, marque a opção acima.
                </div>
              </div>
            )}

            <div className="flex flex-wrap items-center gap-3 pt-2">
              <button
                type="button"
                onClick={save}
                disabled={saving}
                className="h-10 px-6 rounded-lg text-sm font-mono font-bold bg-primary-container text-on-primary-container hover:opacity-90 transition-opacity active:scale-95 disabled:opacity-40"
              >
                {saving ? 'Salvando…' : 'Salvar configuração NF-e'}
              </button>
              <Link
                href="/dashboard/settings?tab=notas#nfe-notas"
                className="text-xs font-mono text-primary hover:underline"
              >
                Ver notas emitidas →
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
