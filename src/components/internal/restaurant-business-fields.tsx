'use client'

import { useRef, useState } from 'react'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'
import type { RestaurantBusinessInput, RestaurantDocumentType, RestaurantCompanyType } from '@/lib/restaurant-profile'
import { BRAZIL_STATES, BUSINESS_TYPES, COMPANY_TYPES, digitsOnly, formatCep } from '@/lib/restaurant-profile'
import { fetchAddressByCep } from '@/lib/viacep'

export type BusinessFormState = {
  businessType: string
  legalName: string
  documentType: RestaurantDocumentType
  documentNumber: string
  companyType: RestaurantCompanyType | ''
  ownerCpf: string
  ownerBirthDate: string   // YYYY-MM-DD — obrigatório se cpfCnpj for CPF
  contactEmail: string
  phone: string
  addressPostalCode: string
  addressStreet: string
  addressNumber: string
  addressComplement: string
  addressNeighborhood: string
  addressCity: string
  addressState: string
  estimatedMonthlyRevenue: string
}

export const emptyBusinessForm = (): BusinessFormState => ({
  businessType: 'restaurante',
  legalName: '',
  documentType: 'cnpj',
  documentNumber: '',
  companyType: 'LIMITED',
  ownerCpf: '',
  ownerBirthDate: '',
  contactEmail: '',
  phone: '',
  addressPostalCode: '',
  addressStreet: '',
  addressNumber: '',
  addressComplement: '',
  addressNeighborhood: '',
  addressCity: '',
  addressState: 'SP',
  estimatedMonthlyRevenue: '30000',
})

export function businessFormToInput(form: BusinessFormState): RestaurantBusinessInput {
  return {
    businessType: form.businessType,
    legalName: form.legalName,
    documentType: form.documentType,
    documentNumber: form.documentNumber,
    companyType: form.companyType,
    ownerCpf: form.ownerCpf,
    ownerBirthDate: form.ownerBirthDate || undefined,
    contactEmail: form.contactEmail,
    phone: form.phone,
    addressPostalCode: form.addressPostalCode,
    addressStreet: form.addressStreet,
    addressNumber: form.addressNumber,
    addressComplement: form.addressComplement,
    addressNeighborhood: form.addressNeighborhood,
    addressCity: form.addressCity,
    addressState: form.addressState,
    estimatedMonthlyRevenue: form.estimatedMonthlyRevenue,
  }
}

type Props = {
  form: BusinessFormState
  setForm: React.Dispatch<React.SetStateAction<BusinessFormState>>
  /** Nome fantasia (campo name do restaurante) */
  tradeName: string
  setTradeName: (v: string) => void
  slug: string
  setSlug: (v: string) => void
  onTradeNameChange?: (v: string) => void
  /** Sem borda superior na primeira seção (uso em abas) */
  embedded?: boolean
}

function sectionClass(first: boolean, embedded?: boolean) {
  return first && embedded
    ? 'space-y-4'
    : 'space-y-4 pt-4 border-t border-outline-variant'
}

export function RestaurantBusinessFields({
  form, setForm, tradeName, setTradeName, slug, setSlug, onTradeNameChange, embedded,
}: Props) {
  const [cepLoading, setCepLoading] = useState(false)
  const lastCepLookup = useRef('')

  function patch(p: Partial<BusinessFormState>) {
    setForm(prev => ({ ...prev, ...p }))
  }

  async function lookupCep(raw: string) {
    const digits = digitsOnly(raw)
    if (digits.length !== 8 || digits === lastCepLookup.current) return

    setCepLoading(true)
    try {
      const addr = await fetchAddressByCep(digits)
      lastCepLookup.current = digits
      setForm(prev => ({
        ...prev,
        addressPostalCode: formatCep(digits),
        addressStreet: addr.street || prev.addressStreet,
        addressNeighborhood: addr.neighborhood || prev.addressNeighborhood,
        addressCity: addr.city || prev.addressCity,
        addressState: addr.state || prev.addressState,
        addressComplement: prev.addressComplement || addr.complement || '',
      }))
    } catch (err) {
      lastCepLookup.current = ''
      toast.error(err instanceof Error ? err.message : 'CEP não encontrado.')
    } finally {
      setCepLoading(false)
    }
  }

  function handleCepChange(v: string) {
    const digits = digitsOnly(v).slice(0, 8)
    const formatted = digits.length > 5 ? `${digits.slice(0, 5)}-${digits.slice(5)}` : digits
    patch({ addressPostalCode: formatted })
    if (digits.length === 8) lookupCep(digits)
    else lastCepLookup.current = ''
  }

  function handleTradeName(v: string) {
    setTradeName(v)
    onTradeNameChange?.(v)
  }

  const isCnpj = form.documentType === 'cnpj'

  function fmtPhone(v: string): string {
    const d = v.replace(/\D/g, '').slice(0, 11)
    if (d.length <= 2) return d.length ? `(${d}` : ''
    if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`
    if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`
    return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`
  }

  function fmtCnpj(v: string): string {
    const d = v.replace(/\D/g, '').slice(0, 14)
    return d.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{1,2})/, '$1.$2.$3/$4-$5')
             .replace(/(\d{2})(\d{3})(\d{3})(\d{1,4})/, '$1.$2.$3/$4')
             .replace(/(\d{2})(\d{3})(\d{1,3})/, '$1.$2.$3')
             .replace(/(\d{2})(\d{1,3})/, '$1.$2')
  }

  function fmtCpf(v: string): string {
    const d = v.replace(/\D/g, '').slice(0, 11)
    return d.replace(/(\d{3})(\d{3})(\d{3})(\d{1,2})/, '$1.$2.$3-$4')
             .replace(/(\d{3})(\d{3})(\d{1,3})/, '$1.$2.$3')
             .replace(/(\d{3})(\d{1,3})/, '$1.$2')
  }

  return (
    <>
      <section className={sectionClass(true, embedded)}>
        <p className="text-[10px] font-mono uppercase tracking-widest text-on-surface-variant">Estabelecimento</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Nome fantasia" value={tradeName} onChange={handleTradeName} placeholder="Tasca do Porto" className="md:col-span-2" required />
          <Field label="Razão social / titular" value={form.legalName} onChange={v => patch({ legalName: v })} placeholder="Tasca do Porto Ltda" className="md:col-span-2" required />
          <SelectField label="Tipo de negócio" value={form.businessType} onChange={v => patch({ businessType: v })}
            options={BUSINESS_TYPES.map(t => ({ value: t.id, label: t.label }))} />
          <Field label="Slug (URL)" value={slug} onChange={setSlug} placeholder="tasca-do-porto" mono required />
          <Field label="Telefone comercial" value={form.phone} onChange={v => patch({ phone: fmtPhone(v) })} placeholder="(11) 99999-9999" inputMode="tel" maxLength={16} required />
          <Field label="E-mail comercial" value={form.contactEmail} onChange={v => patch({ contactEmail: v })} type="email" placeholder="contato@restaurante.com" autoComplete="off" name="new-client-contact-email" />
        </div>
      </section>

      <section className={sectionClass(false, embedded)}>
        <p className="text-[10px] font-mono uppercase tracking-widest text-on-surface-variant">Documentação</p>
        <div className="flex gap-2">
          {(['cnpj', 'cpf'] as const).map(type => (
            <button
              key={type}
              type="button"
              onClick={() => patch({
                documentType: type,
                companyType: type === 'cpf' ? 'MEI' : form.companyType || 'LIMITED',
              })}
              className={`px-4 py-2 rounded-lg text-xs font-mono border transition-colors ${
                form.documentType === type
                  ? 'bg-primary-container text-on-primary-container border-primary/30'
                  : 'border-outline-variant text-on-surface-variant'
              }`}
            >
              {type === 'cnpj' ? 'CNPJ (empresa)' : 'CPF (MEI / autônomo)'}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field
            label={isCnpj ? 'CNPJ' : 'CPF do titular'}
            value={form.documentNumber}
            onChange={v => patch({ documentNumber: isCnpj ? fmtCnpj(v) : fmtCpf(v) })}
            placeholder={isCnpj ? '00.000.000/0000-00' : '000.000.000-00'}
            inputMode="numeric"
            maxLength={isCnpj ? 18 : 14}
            mono
            required
          />
          {isCnpj && (
            <>
              <SelectField label="Tipo jurídico" value={form.companyType} onChange={v => patch({ companyType: v as RestaurantCompanyType })}
                options={COMPANY_TYPES.map(c => ({ value: c.id, label: c.label }))} />
              <Field label="CPF do responsável legal" value={form.ownerCpf} onChange={v => patch({ ownerCpf: fmtCpf(v) })} placeholder="000.000.000-00" inputMode="numeric" maxLength={14} mono required className="md:col-span-2" />
            </>
          )}
          {!isCnpj && (
            <SelectField label="Enquadramento" value={form.companyType || 'MEI'} onChange={v => patch({ companyType: v as RestaurantCompanyType })}
              options={COMPANY_TYPES.filter(c => c.id === 'MEI' || c.id === 'INDIVIDUAL').map(c => ({ value: c.id, label: c.label }))} />
          )}
          <Field
            label="Data de nascimento do titular"
            value={form.ownerBirthDate}
            onChange={v => patch({ ownerBirthDate: v })}
            type="date"
            mono
            required
            className="md:col-span-2"
            hint="Obrigatório para ativação do KiComanda Pay quando o CPF/CNPJ é de pessoa física."
          />
        </div>
      </section>

      <section className={sectionClass(false, embedded)}>
        <p className="text-[10px] font-mono uppercase tracking-widest text-on-surface-variant">Endereço</p>
        <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
          <CepField
            label="CEP"
            value={form.addressPostalCode}
            onChange={handleCepChange}
            onBlur={() => lookupCep(form.addressPostalCode)}
            loading={cepLoading}
            className="md:col-span-2"
          />
          <Field label="Logradouro" value={form.addressStreet} onChange={v => patch({ addressStreet: v })} placeholder="Av. Paulista" className="md:col-span-4" required />
          <Field label="Número" value={form.addressNumber} onChange={v => patch({ addressNumber: v })} placeholder="1000" className="md:col-span-2" required />
          <Field label="Complemento" value={form.addressComplement} onChange={v => patch({ addressComplement: v })} placeholder="Sala 12" className="md:col-span-4" />
          <Field label="Bairro" value={form.addressNeighborhood} onChange={v => patch({ addressNeighborhood: v })} placeholder="Bela Vista" className="md:col-span-2" required />
          <Field label="Cidade" value={form.addressCity} onChange={v => patch({ addressCity: v })} placeholder="São Paulo" className="md:col-span-2" required />
          <SelectField label="UF" value={form.addressState} onChange={v => patch({ addressState: v })}
            options={BRAZIL_STATES.map(uf => ({ value: uf, label: uf }))} className="md:col-span-2" />
        </div>
      </section>

      <section className={sectionClass(false, embedded)}>
        <p className="text-[10px] font-mono uppercase tracking-widest text-on-surface-variant">Operação</p>
        <Field
          label="Faturamento mensal estimado (R$)"
          value={form.estimatedMonthlyRevenue.replace(/\B(?=(\d{3})+(?!\d))/g, '.')}
          onChange={v => patch({ estimatedMonthlyRevenue: v.replace(/\D/g, '').slice(0, 10) })}
          placeholder="30.000"
          inputMode="numeric"
          mono
          required
          maxLength={14}
          hint="Usado no cadastro do gateway de pagamentos e análise de risco."
        />
      </section>
    </>
  )
}

function CepField({
  label, value, onChange, onBlur, loading, className = '',
}: {
  label: string; value: string; onChange: (v: string) => void; onBlur?: () => void
  loading?: boolean; className?: string
}) {
  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      <label className="text-[10px] font-mono uppercase tracking-wider text-on-surface-variant">{label}</label>
      <div className="relative">
        <input
          type="text"
          value={value}
          onChange={e => onChange(e.target.value)}
          onBlur={onBlur}
          placeholder="01310-100"
          inputMode="numeric"
          required
          className="w-full h-10 px-3 pr-9 rounded-lg text-sm font-mono bg-surface-dim border border-outline-variant text-on-surface outline-none focus:border-primary"
        />
        {loading && (
          <Loader2 className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-on-surface-variant" />
        )}
      </div>
      <p className="text-[10px] text-on-surface-variant">Preenche logradouro, bairro, cidade e UF automaticamente.</p>
    </div>
  )
}

function Field({
  label, value, onChange, placeholder, mono, className = '', type = 'text', required, hint,
  inputMode, autoComplete, name, maxLength,
}: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; mono?: boolean
  className?: string; type?: string; required?: boolean; hint?: string; inputMode?: 'numeric' | 'tel' | 'decimal' | 'email'
  autoComplete?: string; name?: string; maxLength?: number
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
        inputMode={inputMode}
        autoComplete={autoComplete}
        required={required}
        maxLength={maxLength}
        className={`h-10 px-3 rounded-lg text-sm bg-surface-dim border border-outline-variant text-on-surface outline-none focus:border-primary ${mono ? 'font-mono' : ''}`}
      />
      {hint && <p className="text-[10px] text-on-surface-variant">{hint}</p>}
    </div>
  )
}

function SelectField({
  label, value, onChange, options, className = '',
}: {
  label: string; value: string; onChange: (v: string) => void
  options: { value: string; label: string }[]; className?: string
}) {
  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      <label className="text-[10px] font-mono uppercase tracking-wider text-on-surface-variant">{label}</label>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className="h-10 px-3 rounded-lg text-sm bg-surface-dim border border-outline-variant text-on-surface outline-none focus:border-primary"
      >
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  )
}
