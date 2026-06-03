'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'
import type { Plan } from '@/types/internal'
import { InternalFormTabs } from '@/components/internal/internal-form-tabs'
import {
  RestaurantBusinessFields,
  businessFormToInput,
  emptyBusinessForm,
  type BusinessFormState,
} from '@/components/internal/restaurant-business-fields'
import { validateRestaurantBusiness } from '@/lib/restaurant-profile'
import { validateRestaurantNfe } from '@/lib/restaurant-nfe'
import {
  RestaurantNfeFields,
  emptyNfeForm,
  nfeFormToInput,
  type NfeFormState,
} from '@/components/internal/restaurant-nfe-fields'
import { RestaurantServiceNfePanel } from '@/components/internal/restaurant-service-nfe-panel'
import { RestaurantModelPicker } from '@/components/internal/restaurant-model-picker'
import { getRestaurantModel, type RestaurantModelId } from '@/lib/restaurant-models'

type TabId = 'acesso' | 'modelo' | 'estabelecimento' | 'nfe_cliente' | 'plano' | 'nfe_servico'

const TABS: { id: TabId; label: string }[] = [
  { id: 'acesso', label: 'Acesso' },
  { id: 'modelo', label: 'Modelo' },
  { id: 'estabelecimento', label: 'Estabelecimento' },
  { id: 'nfe_cliente', label: 'NF-e cliente' },
  { id: 'plano', label: 'Plano Qomanda' },
  { id: 'nfe_servico', label: 'NF-e serviço' },
]

function slugify(v: string) {
  return v.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
}

export default function NewClientPage() {
  const router = useRouter()
  const [tab, setTab] = useState<TabId>('acesso')
  const [plans, setPlans] = useState<Plan[]>([])
  const [loading, setLoading] = useState(false)

  const [ownerName, setOwnerName] = useState('')
  const [ownerEmail, setOwnerEmail] = useState('')
  const [ownerPassword, setOwnerPassword] = useState('')
  const [restaurantName, setRestaurantName] = useState('')
  const [slug, setSlug] = useState('')
  const [businessForm, setBusinessForm] = useState<BusinessFormState>(emptyBusinessForm)
  const [nfeForm, setNfeForm] = useState<NfeFormState>(emptyNfeForm)
  const [planId, setPlanId] = useState('starter')
  const [notes, setNotes] = useState('')
  const [restaurantModel, setRestaurantModel] = useState<RestaurantModelId>('salao')

  useEffect(() => {
    fetch('/api/internal/plans').then(r => r.json()).then(d => setPlans(d.plans ?? []))
  }, [])

  function handleTradeNameChange(v: string) {
    setRestaurantName(v)
    setSlug(slugify(v))
    if (!businessForm.legalName) {
      setBusinessForm(prev => ({ ...prev, legalName: v }))
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (!ownerName.trim() || !ownerEmail.trim() || !ownerPassword || ownerPassword.length < 6) {
      toast.error('Preencha nome, e-mail e senha do responsável (mín. 6 caracteres).')
      setTab('acesso')
      return
    }

    if (!getRestaurantModel(restaurantModel) || getRestaurantModel(restaurantModel)?.status !== 'available') {
      toast.error('Selecione um modelo operacional disponível.')
      setTab('modelo')
      return
    }

    const businessInput = businessFormToInput(businessForm)
    const businessError = validateRestaurantBusiness(businessInput)
    if (businessError) {
      toast.error(businessError)
      setTab('estabelecimento')
      return
    }

    const nfeInput = nfeFormToInput(nfeForm)
    const nfeError = validateRestaurantNfe(nfeInput, businessInput.documentType)
    if (nfeError) {
      toast.error(nfeError)
      setTab('nfe_cliente')
      return
    }

    setLoading(true)
    try {
      const res = await fetch('/api/internal/clients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ownerName,
          ownerEmail,
          ownerPassword,
          restaurantName,
          slug,
          planId,
          notes,
          restaurantModel,
          ...businessInput,
          ...nfeInput,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Erro ao cadastrar.')
      toast.success('Cliente cadastrado com sucesso!')
      router.push(`/internal/clients/${data.restaurantId}`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao cadastrar.')
    } finally {
      setLoading(false)
    }
  }

  const selectedPlan = plans.find(p => p.id === planId)
  const selectedModel = getRestaurantModel(restaurantModel)

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <Link href="/internal/clients" className="text-xs font-mono text-on-surface-variant hover:text-on-surface">← Clientes</Link>
        <h1 className="text-2xl font-black text-on-surface mt-2">Novo cliente</h1>
        <p className="text-sm text-on-surface-variant mt-1">
          Cadastro em etapas: acesso → modelo operacional → estabelecimento → NF-e → plano.
          {selectedModel && (
            <span className="block mt-1 text-primary font-mono text-xs">
              Modelo selecionado: {selectedModel.name}
            </span>
          )}
        </p>
      </div>

      <form
        onSubmit={handleSubmit}
        noValidate
        autoComplete="off"
        className="relative bg-surface-container border border-outline-variant rounded-xl p-6 space-y-6"
      >
        <div className="absolute opacity-0 pointer-events-none h-0 overflow-hidden" aria-hidden tabIndex={-1}>
          <input type="text" name="qomanda_autofill_trap_email" autoComplete="username" tabIndex={-1} defaultValue="" />
          <input type="password" name="qomanda_autofill_trap_password" autoComplete="current-password" tabIndex={-1} defaultValue="" />
        </div>

        <InternalFormTabs tabs={TABS} active={tab} onChange={id => setTab(id as TabId)} />

        {tab === 'acesso' && (
          <section className="space-y-4">
            <div>
              <p className="text-[10px] font-mono uppercase tracking-widest text-on-surface-variant">Acesso ao painel</p>
              <p className="text-xs text-on-surface-variant mt-1">
                Credenciais do responsável que fará login no painel do restaurante.
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <OwnerField label="Nome do responsável" value={ownerName} onChange={setOwnerName} placeholder="João Silva" autoComplete="off" name="new-client-owner-name" />
              <OwnerField label="E-mail do responsável (login)" value={ownerEmail} onChange={setOwnerEmail} type="email" placeholder="joao@restaurante.com" autoComplete="off" name="new-client-owner-email" />
              <OwnerField label="Senha inicial" value={ownerPassword} onChange={setOwnerPassword} type="password" placeholder="Mín. 6 caracteres" autoComplete="new-password" name="new-client-owner-password" className="md:col-span-2" />
            </div>
          </section>
        )}

        {tab === 'modelo' && (
          <section className="space-y-4">
            <div>
              <p className="text-[10px] font-mono uppercase tracking-widest text-on-surface-variant">Modelo operacional</p>
              <p className="text-sm text-on-surface-variant mt-1">
                Como o negócio opera? O preset define salão/balcão, gateway manual e mesas iniciais — igual ao cadastro público.
              </p>
            </div>
            <RestaurantModelPicker value={restaurantModel} onChange={setRestaurantModel} />
            {selectedModel && (
              <div className="rounded-lg border border-outline-variant bg-surface-dim px-4 py-3 space-y-2">
                <p className="text-[10px] font-mono uppercase tracking-wider text-on-surface-variant">
                  Após o cadastro, o restaurante precisa
                </p>
                <ul className="text-xs text-on-surface-variant space-y-1">
                  {selectedModel.setupSteps.map(step => (
                    <li key={step} className="flex items-start gap-2">
                      <span className="text-primary mt-0.5">•</span>
                      {step}
                    </li>
                  ))}
                </ul>
                {selectedModel.preset.seedTableCount > 0 && (
                  <p className="text-[10px] font-mono text-primary pt-1">
                    {selectedModel.preset.seedTableCount} mesas serão criadas automaticamente.
                  </p>
                )}
              </div>
            )}
          </section>
        )}

        {tab === 'estabelecimento' && (
          <RestaurantBusinessFields
            embedded
            form={businessForm}
            setForm={setBusinessForm}
            tradeName={restaurantName}
            setTradeName={setRestaurantName}
            slug={slug}
            setSlug={v => setSlug(slugify(v))}
            onTradeNameChange={handleTradeNameChange}
          />
        )}

        {tab === 'nfe_cliente' && (
          <>
            <RestaurantNfeFields
              embedded
              form={nfeForm}
              setForm={setNfeForm}
              documentType={businessForm.documentType}
            />
            <p className="text-xs text-on-surface-variant rounded-lg border border-dashed border-outline-variant px-4 py-3">
              O WhatsApp para envio da NF-e ao cliente será configurado pelo restaurante em{' '}
              <span className="font-mono text-on-surface">Configurações → Integrações</span> após o cadastro.
            </p>
          </>
        )}

        {tab === 'plano' && (
          <section className="space-y-4">
            <div>
              <p className="text-[10px] font-mono uppercase tracking-widest text-on-surface-variant">Plano Qomanda</p>
              <h3 className="text-sm font-semibold text-on-surface mt-1">Cobrança Qomanda → restaurante</h3>
              <p className="text-xs text-on-surface-variant mt-1 leading-relaxed">
                Mensalidade e taxa de transação que o restaurante paga à Qomanda. A NF-e de serviço correspondente fica na aba NF-e serviço.
              </p>
            </div>
            <select
              value={planId}
              onChange={e => setPlanId(e.target.value)}
              className="w-full h-10 px-3 rounded-lg text-sm bg-surface-dim border border-outline-variant text-on-surface outline-none focus:border-primary"
            >
              {plans.map(p => (
                <option key={p.id} value={p.id}>
                  {p.name} — R$ {p.monthly_fee}/mês · {p.platform_fee_percent}% tx · {p.max_tables ?? '∞'} mesas
                </option>
              ))}
            </select>
            {selectedPlan && (
              <p className="text-xs text-on-surface-variant leading-relaxed">
                Trial de {selectedPlan.trial_days} dias. Mensalidade R$ {selectedPlan.monthly_fee.toFixed(2)} · taxa {selectedPlan.platform_fee_percent}%.
              </p>
            )}
            <div>
              <label className="text-[10px] font-mono uppercase tracking-wider text-on-surface-variant">Observações internas</label>
              <textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                rows={3}
                className="mt-1.5 w-full px-3 py-2 rounded-lg text-sm bg-surface-dim border border-outline-variant text-on-surface outline-none focus:border-primary resize-none"
              />
            </div>
          </section>
        )}

        {tab === 'nfe_servico' && (
          <RestaurantServiceNfePanel
            embedded
            mode="preview"
            legalName={businessForm.legalName}
            documentNumber={businessForm.documentNumber}
            documentType={businessForm.documentType}
            contactEmail={businessForm.contactEmail}
            planName={selectedPlan?.name}
            monthlyFee={selectedPlan?.monthly_fee}
            platformFeePercent={selectedPlan?.platform_fee_percent}
          />
        )}

        <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-outline-variant">
          <p className="text-xs text-on-surface-variant">
            {tab !== 'nfe_servico' ? (
              <>Próximo: <button type="button" onClick={() => setTab(TABS[TABS.findIndex(t => t.id === tab) + 1]?.id ?? tab)} className="text-primary hover:opacity-80 font-mono">{TABS[TABS.findIndex(t => t.id === tab) + 1]?.label}</button></>
            ) : (
              'Revise os dados nas outras abas antes de cadastrar.'
            )}
          </p>
          <button
            type="submit"
            disabled={loading}
            className="h-10 px-6 rounded-lg text-sm font-mono font-bold bg-primary-container text-on-primary-container hover:opacity-90 disabled:opacity-50 flex items-center gap-2 shrink-0"
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            Cadastrar cliente
          </button>
        </div>
      </form>
    </div>
  )
}

function OwnerField({
  label, value, onChange, type = 'text', placeholder, className = '', autoComplete, name,
}: {
  label: string; value: string; onChange: (v: string) => void; type?: string; placeholder?: string
  className?: string; autoComplete?: string; name?: string
}) {
  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      <label className="text-[10px] font-mono uppercase tracking-wider text-on-surface-variant">{label}</label>
      <input
        type={type}
        name={name}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete={autoComplete}
        required
        className="h-10 px-3 rounded-lg text-sm bg-surface-dim border border-outline-variant text-on-surface outline-none focus:border-primary"
      />
    </div>
  )
}
