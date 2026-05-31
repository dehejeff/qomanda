'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'
import type { InternalClientDetail, Plan, SubscriptionStatus } from '@/types/internal'
import { InternalFormTabs } from '@/components/internal/internal-form-tabs'
import {
  RestaurantBusinessFields,
  businessFormToInput,
  emptyBusinessForm,
  type BusinessFormState,
} from '@/components/internal/restaurant-business-fields'
import { formatDocument } from '@/lib/restaurant-profile'
import { NFE_STATUS_LABEL } from '@/lib/restaurant-nfe'
import { WHATSAPP_STATUS_LABEL } from '@/lib/restaurant-whatsapp'
import {
  RestaurantNfeFields,
  emptyNfeForm,
  nfeFormToInput,
  type NfeFormState,
} from '@/components/internal/restaurant-nfe-fields'
import { RestaurantServiceNfePanel } from '@/components/internal/restaurant-service-nfe-panel'

type TabId = 'estabelecimento' | 'nfe_cliente' | 'plano' | 'nfe_servico'

const TABS: { id: TabId; label: string }[] = [
  { id: 'estabelecimento', label: 'Estabelecimento' },
  { id: 'nfe_cliente', label: 'NF-e cliente' },
  { id: 'plano', label: 'Plano Qomanda' },
  { id: 'nfe_servico', label: 'NF-e serviço' },
]

function brl(value: number) {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

const SUB_STATUSES: { id: SubscriptionStatus; label: string }[] = [
  { id: 'trialing', label: 'Trial' },
  { id: 'active', label: 'Ativo' },
  { id: 'past_due', label: 'Inadimplente' },
  { id: 'paused', label: 'Pausado' },
  { id: 'cancelled', label: 'Cancelado' },
]

export default function ClientDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const [clientId, setClientId] = useState<string | null>(null)
  const [client, setClient] = useState<InternalClientDetail | null>(null)
  const [plans, setPlans] = useState<Plan[]>([])
  const [tab, setTab] = useState<TabId>('estabelecimento')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [invoicing, setInvoicing] = useState(false)

  const [businessForm, setBusinessForm] = useState<BusinessFormState>(emptyBusinessForm)
  const [nfeForm, setNfeForm] = useState<NfeFormState>(emptyNfeForm)
  const [tradeName, setTradeName] = useState('')
  const [slug, setSlug] = useState('')

  const [billingForm, setBillingForm] = useState({
    status: 'active' as 'active' | 'inactive',
    planId: 'starter', subscriptionStatus: 'trialing' as SubscriptionStatus,
    monthlyFeeOverride: '', platformFeePercentOverride: '', platformFeeFixedOverride: '',
    asaasOnboardingStatus: 'pending', subscriptionNotes: '',
  })

  useEffect(() => {
    params.then(p => setClientId(p.id))
  }, [params])

  useEffect(() => {
    if (!clientId) return
    Promise.all([
      fetch(`/api/internal/clients/${clientId}`).then(r => r.json()),
      fetch('/api/internal/plans').then(r => r.json()),
    ]).then(([clientRes, plansRes]) => {
      const c = clientRes.client as InternalClientDetail
      setClient(c)
      setPlans(plansRes.plans ?? [])
      setTradeName(c.name)
      setSlug(c.slug)
      const p = c.profile
      setBusinessForm({
        businessType: p.business_type ?? 'restaurante',
        legalName: p.legal_name ?? '',
        documentType: p.document_type ?? 'cnpj',
        documentNumber: p.document_number ?? '',
        companyType: p.company_type ?? 'LIMITED',
        ownerCpf: p.owner_cpf ?? '',
        contactEmail: p.contact_email ?? '',
        phone: c.phone ?? '',
        addressPostalCode: p.address_postal_code ?? '',
        addressStreet: p.address_street ?? '',
        addressNumber: p.address_number ?? '',
        addressComplement: p.address_complement ?? '',
        addressNeighborhood: p.address_neighborhood ?? '',
        addressCity: p.address_city ?? '',
        addressState: p.address_state ?? 'SP',
        estimatedMonthlyRevenue: p.estimated_monthly_revenue?.toString() ?? '',
      })
      const nfe = c.nfe
      setNfeForm({
        nfeEnabled: nfe.nfe_enabled,
        nfeStatus: nfe.nfe_status,
        nfeProvider: nfe.nfe_provider ?? '',
        nfeEnvironment: nfe.nfe_environment,
        nfeProviderToken: '',
        nfeProviderCompanyId: nfe.nfe_provider_company_id ?? '',
        nfeStateRegistration: nfe.nfe_state_registration ?? '',
        nfeMunicipalRegistration: nfe.nfe_municipal_registration ?? '',
        nfeTaxRegime: nfe.nfe_tax_regime ?? '',
        nfeCnae: nfe.nfe_cnae ?? '',
        nfeInvoiceSeries: nfe.nfe_invoice_series ?? '1',
        nfeNextInvoiceNumber: nfe.nfe_next_invoice_number?.toString() ?? '',
        nfeAutoEmit: nfe.nfe_auto_emit,
        nfeSplitFoodDrinks: nfe.nfe_split_food_drinks,
        nfeNotes: nfe.nfe_notes ?? '',
      })
      setBillingForm({
        status: c.status,
        planId: c.plan_id ?? 'starter',
        subscriptionStatus: c.subscription_status ?? 'trialing',
        monthlyFeeOverride: c.subscription?.monthly_fee_override?.toString() ?? '',
        platformFeePercentOverride: c.subscription?.platform_fee_percent_override?.toString() ?? '',
        platformFeeFixedOverride: c.subscription?.platform_fee_fixed_override?.toString() ?? '',
        asaasOnboardingStatus: c.asaas_onboarding_status ?? 'pending',
        subscriptionNotes: c.subscription?.notes ?? '',
      })
    }).finally(() => setLoading(false))
  }, [clientId])

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!clientId) return
    setSaving(true)
    try {
      const res = await fetch(`/api/internal/clients/${clientId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          restaurantName: tradeName,
          slug,
          status: billingForm.status,
          planId: billingForm.planId,
          subscriptionStatus: billingForm.subscriptionStatus,
          monthlyFeeOverride: billingForm.monthlyFeeOverride ? Number(billingForm.monthlyFeeOverride) : null,
          platformFeePercentOverride: billingForm.platformFeePercentOverride ? Number(billingForm.platformFeePercentOverride) : null,
          platformFeeFixedOverride: billingForm.platformFeeFixedOverride ? Number(billingForm.platformFeeFixedOverride) : null,
          asaasOnboardingStatus: billingForm.asaasOnboardingStatus,
          subscriptionNotes: billingForm.subscriptionNotes,
          ...businessFormToInput(businessForm),
          ...nfeFormToInput(nfeForm),
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Erro ao salvar.')
      setClient(data.client)
      toast.success('Alterações salvas.')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao salvar.')
    } finally {
      setSaving(false)
    }
  }

  async function handleGenerateInvoice(markPaid = false) {
    if (!clientId) return
    setInvoicing(true)
    try {
      const res = await fetch(`/api/internal/clients/${clientId}/invoices`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ markPaid }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Erro ao gerar fatura.')
      toast.success(markPaid ? 'Fatura registrada como paga.' : 'Fatura gerada.')
      const refresh = await fetch(`/api/internal/clients/${clientId}`).then(r => r.json())
      setClient(refresh.client)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro na fatura.')
    } finally {
      setInvoicing(false)
    }
  }

  if (loading) {
    return <p className="text-on-surface-variant">Carregando...</p>
  }

  if (!client) {
    return <p className="text-on-surface-variant">Cliente não encontrado.</p>
  }

  const selectedPlan = plans.find(p => p.id === billingForm.planId)

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <Link href="/internal/clients" className="text-xs font-mono text-on-surface-variant hover:text-on-surface">← Clientes</Link>
        <div className="flex flex-wrap items-start justify-between gap-4 mt-2">
          <div>
            <h1 className="text-2xl font-black text-on-surface">{client.name}</h1>
            <p className="text-sm font-mono text-on-surface-variant mt-1">
              /{client.slug} · {client.owner_email} · {client.tables_count} mesas
              {client.profile.document_number && (
                <> · {formatDocument(client.profile.document_number, client.profile.document_type)}</>
              )}
            </p>
          </div>
          <a
            href={`/${client.slug}`}
            target="_blank"
            rel="noreferrer"
            className="text-xs font-mono text-primary hover:opacity-80 flex items-center gap-1"
          >
            Ver cardápio <span className="material-symbols-outlined text-[14px]">open_in_new</span>
          </a>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
        {[
          { label: 'Mensalidade', value: brl(client.monthly_fee) },
          { label: 'Taxa tx', value: `${client.platform_fee_percent.toFixed(2)}%` },
          { label: 'Qomanda Pay', value: client.digital_status === 'active' ? 'Ativo' : client.digital_status === 'pending' ? 'Análise' : 'Inativo' },
          { label: 'Conta bancária', value: client.payout_configured ? 'Cadastrada' : 'Pendente' },
          { label: 'NF-e cliente', value: NFE_STATUS_LABEL[client.nfe.nfe_status] },
          { label: 'WhatsApp NF-e', value: WHATSAPP_STATUS_LABEL[client.whatsapp.status] },
        ].map(s => (
          <div key={s.label} className="bg-surface-container border border-outline-variant rounded-xl p-3">
            <p className="text-[10px] font-mono uppercase text-on-surface-variant">{s.label}</p>
            <p className="text-sm font-semibold text-on-surface mt-1">{s.value}</p>
          </div>
        ))}
      </div>

      <form onSubmit={handleSave} className="bg-surface-container border border-outline-variant rounded-xl p-6 space-y-6">
        <InternalFormTabs tabs={TABS} active={tab} onChange={id => setTab(id as TabId)} />

        {tab === 'estabelecimento' && (
          <RestaurantBusinessFields
            embedded
            form={businessForm}
            setForm={setBusinessForm}
            tradeName={tradeName}
            setTradeName={setTradeName}
            slug={slug}
            setSlug={setSlug}
          />
        )}

        {tab === 'nfe_cliente' && (
          <RestaurantNfeFields
            embedded
            form={nfeForm}
            setForm={setNfeForm}
            documentType={businessForm.documentType}
            hasExistingToken={client.nfe.has_provider_token}
            whatsappStatus={client.whatsapp}
          />
        )}

        {tab === 'plano' && (
          <section className="space-y-4">
            <div>
              <p className="text-[10px] font-mono uppercase tracking-widest text-on-surface-variant">Plano Qomanda</p>
              <h3 className="text-sm font-semibold text-on-surface mt-1">Cobrança Qomanda → restaurante</h3>
              <p className="text-xs text-on-surface-variant mt-1">
                Assinatura, taxas e status operacional. A NF-e de serviço fica na aba NF-e serviço.
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Select label="Status loja" value={billingForm.status} onChange={v => setBillingForm(p => ({ ...p, status: v as 'active' | 'inactive' }))}
                options={[{ value: 'active', label: 'Ativo' }, { value: 'inactive', label: 'Inativo' }]} />
              <Select label="Plano" value={billingForm.planId} onChange={v => setBillingForm(p => ({ ...p, planId: v }))}
                options={plans.map(p => ({ value: p.id, label: `${p.name} — R$ ${p.monthly_fee}` }))} />
              <Select label="Assinatura" value={billingForm.subscriptionStatus} onChange={v => setBillingForm(p => ({ ...p, subscriptionStatus: v as SubscriptionStatus }))}
                options={SUB_STATUSES.map(s => ({ value: s.id, label: s.label }))} />
              <Select label="Qomanda Pay (interno)" value={billingForm.asaasOnboardingStatus} onChange={v => setBillingForm(p => ({ ...p, asaasOnboardingStatus: v }))}
                options={[
                  { value: 'pending', label: 'Pendente' },
                  { value: 'submitted', label: 'Enviado' },
                  { value: 'approved', label: 'Aprovado' },
                  { value: 'rejected', label: 'Rejeitado' },
                ]} />
              <Input label="Mensalidade custom (R$)" value={billingForm.monthlyFeeOverride} onChange={v => setBillingForm(p => ({ ...p, monthlyFeeOverride: v }))} placeholder="Vazio = plano" mono />
              <Input label="Taxa tx custom (%)" value={billingForm.platformFeePercentOverride} onChange={v => setBillingForm(p => ({ ...p, platformFeePercentOverride: v }))} placeholder="Vazio = plano" mono />
              <Input label="Taxa tx fixa (R$)" value={billingForm.platformFeeFixedOverride} onChange={v => setBillingForm(p => ({ ...p, platformFeeFixedOverride: v }))} placeholder="0" mono />
            </div>
            {selectedPlan && (
              <p className="text-xs text-on-surface-variant">
                Plano {selectedPlan.name}: mensalidade {brl(client.monthly_fee)} · taxa {client.platform_fee_percent.toFixed(2)}%
              </p>
            )}
            <div>
              <label className="text-[10px] font-mono uppercase tracking-wider text-on-surface-variant">Notas internas</label>
              <textarea
                value={billingForm.subscriptionNotes}
                onChange={e => setBillingForm(p => ({ ...p, subscriptionNotes: e.target.value }))}
                rows={2}
                className="mt-1.5 w-full px-3 py-2 rounded-lg text-sm bg-surface-dim border border-outline-variant text-on-surface outline-none focus:border-primary resize-none"
              />
            </div>
          </section>
        )}

        {tab === 'nfe_servico' && (
          <RestaurantServiceNfePanel
            embedded
            mode="manage"
            legalName={businessForm.legalName}
            documentNumber={businessForm.documentNumber}
            documentType={businessForm.documentType}
            contactEmail={businessForm.contactEmail}
            planName={selectedPlan?.name ?? client.plan_id ?? undefined}
            monthlyFee={client.monthly_fee}
            platformFeePercent={client.platform_fee_percent}
            recentInvoices={client.recent_invoices}
            invoicing={invoicing}
            onGenerateInvoice={handleGenerateInvoice}
          />
        )}

        <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-outline-variant">
          {tab !== 'nfe_servico' ? (
            <p className="text-xs text-on-surface-variant">
              Próximo:{' '}
              <button
                type="button"
                onClick={() => setTab(TABS[TABS.findIndex(t => t.id === tab) + 1]?.id ?? tab)}
                className="text-primary hover:opacity-80 font-mono"
              >
                {TABS[TABS.findIndex(t => t.id === tab) + 1]?.label}
              </button>
            </p>
          ) : (
            <p className="text-xs text-on-surface-variant">Revise as outras abas antes de salvar.</p>
          )}
          <button type="submit" disabled={saving} className="h-10 px-6 rounded-lg text-sm font-mono font-bold bg-primary-container text-on-primary-container hover:opacity-90 disabled:opacity-50 flex items-center gap-2 shrink-0">
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            Salvar alterações
          </button>
        </div>
      </form>
    </div>
  )
}

function Input({ label, value, onChange, placeholder, mono, className = '' }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; mono?: boolean; className?: string
}) {
  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      <label className="text-[10px] font-mono uppercase tracking-wider text-on-surface-variant">{label}</label>
      <input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
        className={`h-10 px-3 rounded-lg text-sm bg-surface-dim border border-outline-variant text-on-surface outline-none focus:border-primary ${mono ? 'font-mono' : ''}`} />
    </div>
  )
}

function Select({ label, value, onChange, options, className = '' }: {
  label: string; value: string; onChange: (v: string) => void
  options: { value: string; label: string }[]; className?: string
}) {
  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      <label className="text-[10px] font-mono uppercase tracking-wider text-on-surface-variant">{label}</label>
      <select value={value} onChange={e => onChange(e.target.value)}
        className="h-10 px-3 rounded-lg text-sm bg-surface-dim border border-outline-variant text-on-surface outline-none focus:border-primary">
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  )
}
