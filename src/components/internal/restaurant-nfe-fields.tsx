'use client'

import type {
  NfeEnvironment,
  NfeProvider,
  NfeStatus,
  NfeTaxRegime,
  RestaurantNfeInput,
} from '@/lib/restaurant-nfe'
import { NFE_PROVIDERS, NFE_STATUS_LABEL, NFE_TAX_REGIMES } from '@/lib/restaurant-nfe'
import { RestaurantWhatsAppStatusPanel } from '@/components/internal/restaurant-whatsapp-status-panel'
import type { RestaurantWhatsAppStatus } from '@/lib/restaurant-whatsapp'

export type NfeFormState = {
  nfeEnabled: boolean
  nfeStatus: NfeStatus
  nfeProvider: NfeProvider | ''
  nfeEnvironment: NfeEnvironment
  nfeProviderToken: string
  nfeProviderCompanyId: string
  nfeStateRegistration: string
  nfeMunicipalRegistration: string
  nfeTaxRegime: NfeTaxRegime | ''
  nfeCnae: string
  nfeInvoiceSeries: string
  nfeNextInvoiceNumber: string
  nfeAutoEmit: boolean
  nfeSplitFoodDrinks: boolean
  nfeNotes: string
}

export const emptyNfeForm = (): NfeFormState => ({
  nfeEnabled: false,
  nfeStatus: 'disabled',
  nfeProvider: '',
  nfeEnvironment: 'homologacao',
  nfeProviderToken: '',
  nfeProviderCompanyId: '',
  nfeStateRegistration: '',
  nfeMunicipalRegistration: '',
  nfeTaxRegime: '',
  nfeCnae: '',
  nfeInvoiceSeries: '1',
  nfeNextInvoiceNumber: '',
  nfeAutoEmit: false,
  nfeSplitFoodDrinks: true,
  nfeNotes: '',
})

export function nfeFormToInput(form: NfeFormState): RestaurantNfeInput {
  return {
    nfeEnabled: form.nfeEnabled,
    nfeStatus: form.nfeStatus,
    nfeProvider: form.nfeProvider,
    nfeEnvironment: form.nfeEnvironment,
    nfeProviderToken: form.nfeProviderToken,
    nfeProviderCompanyId: form.nfeProviderCompanyId,
    nfeStateRegistration: form.nfeStateRegistration,
    nfeMunicipalRegistration: form.nfeMunicipalRegistration,
    nfeTaxRegime: form.nfeTaxRegime,
    nfeCnae: form.nfeCnae,
    nfeInvoiceSeries: form.nfeInvoiceSeries,
    nfeNextInvoiceNumber: form.nfeNextInvoiceNumber,
    nfeAutoEmit: form.nfeAutoEmit,
    nfeSplitFoodDrinks: form.nfeSplitFoodDrinks,
    nfeNotes: form.nfeNotes,
  }
}

type Props = {
  form: NfeFormState
  setForm: React.Dispatch<React.SetStateAction<NfeFormState>>
  documentType?: 'cpf' | 'cnpj' | null
  hasExistingToken?: boolean
  /** Sem borda superior (uso em abas) */
  embedded?: boolean
  whatsappStatus?: RestaurantWhatsAppStatus | null
}

export function RestaurantNfeFields({ form, setForm, documentType, hasExistingToken, embedded, whatsappStatus }: Props) {
  function patch(p: Partial<NfeFormState>) {
    setForm(prev => {
      const next = { ...prev, ...p }
      if (p.nfeEnabled === true && prev.nfeStatus === 'disabled') {
        next.nfeStatus = 'pending'
      }
      if (p.nfeEnabled === false) {
        next.nfeStatus = 'disabled'
      }
      return next
    })
  }

  const isCnpj = documentType !== 'cpf'

  return (
    <section className={embedded ? 'space-y-4' : 'space-y-4 pt-4 border-t border-outline-variant'}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-mono uppercase tracking-widest text-on-surface-variant">NF-e ao cliente</p>
          <h3 className="text-sm font-semibold text-on-surface mt-1">Nota fiscal do restaurante → consumidor</h3>
          <p className="text-sm text-on-surface-variant mt-1 leading-relaxed">
            Configura como <strong className="text-on-surface font-medium">este restaurante</strong> emite nota para quem pagou a conta na mesa
            (Focus NFe, NFe.io, etc.). Pode ser enviada ao cliente no WhatsApp após o pagamento.
          </p>
        </div>
        <span className={`text-[10px] font-mono uppercase px-2 py-1 rounded border shrink-0 ${
          form.nfeStatus === 'active'
            ? 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10'
            : form.nfeStatus === 'pending'
              ? 'text-amber-400 border-amber-500/30 bg-amber-500/10'
              : 'text-on-surface-variant border-outline-variant'
        }`}>
          {NFE_STATUS_LABEL[form.nfeStatus]}
        </span>
      </div>

      <div className="rounded-lg border border-outline-variant bg-surface-container-low px-4 py-3 text-xs text-on-surface-variant leading-relaxed">
        <span className="font-semibold text-on-surface">Não confundir:</span> isto <em>não</em> é a nota que a Qomanda emite para cobrar mensalidade ou taxa de transação do restaurante.
        A cobrança Qomanda → restaurante fica na aba <span className="font-mono text-on-surface">Plano Qomanda</span> e na aba <span className="font-mono text-on-surface">NF-e serviço</span>.
      </div>

      <label className="flex items-start gap-3 cursor-pointer">
        <input
          type="checkbox"
          checked={form.nfeEnabled}
          onChange={e => patch({ nfeEnabled: e.target.checked })}
          className="mt-1 accent-primary"
        />
        <span>
          <span className="text-sm text-on-surface block">Restaurante emite NF-e para o cliente final</span>
          <span className="text-xs text-on-surface-variant">
            Certificado A1 vai direto no provedor (Focus, NFe.io). Emissão automática após pagamento confirmado.
          </span>
        </span>
      </label>

      {form.nfeEnabled && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <SelectField label="Status NF-e" value={form.nfeStatus} onChange={v => patch({ nfeStatus: v as NfeStatus })}
              options={[
                { value: 'pending', label: 'Pendente — aguardando certificado/provedor' },
                { value: 'active', label: 'Ativo — pronto para emitir' },
                { value: 'error', label: 'Erro — revisar configuração' },
              ]} />
            <SelectField label="Provedor / emissor" value={form.nfeProvider} onChange={v => patch({ nfeProvider: v as NfeProvider })}
              options={[{ value: '', label: 'Selecione…' }, ...NFE_PROVIDERS.map(p => ({ value: p.id, label: p.label }))]} />
            <div className="flex gap-2 md:col-span-2">
              {(['homologacao', 'producao'] as const).map(env => (
                <button
                  key={env}
                  type="button"
                  onClick={() => patch({ nfeEnvironment: env })}
                  className={`px-4 py-2 rounded-lg text-xs font-mono border transition-colors ${
                    form.nfeEnvironment === env
                      ? 'bg-primary-container text-on-primary-container border-primary/30'
                      : 'border-outline-variant text-on-surface-variant'
                  }`}
                >
                  {env === 'homologacao' ? 'Homologação (testes)' : 'Produção'}
                </button>
              ))}
            </div>
            <Field label="Token / API key do emissor" value={form.nfeProviderToken} onChange={v => patch({ nfeProviderToken: v })}
              type="password" placeholder={hasExistingToken ? '•••••••• (já configurado — deixe vazio para manter)' : 'Token do painel do emissor'} mono />
            <Field label="ID da empresa no emissor" value={form.nfeProviderCompanyId} onChange={v => patch({ nfeProviderCompanyId: v })}
              placeholder="Opcional — conforme o provedor" mono />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-outline-variant/60">
            <p className="md:col-span-2 text-[10px] font-mono uppercase tracking-widest text-on-surface-variant">Dados fiscais do restaurante (tomador = cliente na mesa)</p>
            {isCnpj ? (
              <>
                <Field label="Inscrição Estadual (IE)" value={form.nfeStateRegistration} onChange={v => patch({ nfeStateRegistration: v })}
                  placeholder="ISENTO ou número da IE" required />
                <Field label="Inscrição Municipal (IM)" value={form.nfeMunicipalRegistration} onChange={v => patch({ nfeMunicipalRegistration: v })}
                  placeholder="Opcional" />
                <SelectField label="Regime tributário" value={form.nfeTaxRegime} onChange={v => patch({ nfeTaxRegime: v as NfeTaxRegime })}
                  options={[{ value: '', label: 'Selecione…' }, ...NFE_TAX_REGIMES.map(r => ({ value: r.id, label: r.label }))]} />
                <Field label="CNAE principal" value={form.nfeCnae} onChange={v => patch({ nfeCnae: v })}
                  placeholder="5611201" inputMode="numeric" mono required />
              </>
            ) : (
              <>
                <SelectField label="Regime" value={form.nfeTaxRegime || 'mei'} onChange={v => patch({ nfeTaxRegime: v as NfeTaxRegime })}
                  options={NFE_TAX_REGIMES.filter(r => r.id === 'mei' || r.id === 'simples_nacional').map(r => ({ value: r.id, label: r.label }))} />
                <Field label="CNAE (MEI)" value={form.nfeCnae} onChange={v => patch({ nfeCnae: v })} placeholder="5611203" inputMode="numeric" mono />
                <p className="md:col-span-2 text-xs text-on-surface-variant">
                  MEI/autônomo emite NFS-e municipal — confirme o emissor compatível com a prefeitura do cliente.
                </p>
              </>
            )}
            <Field label="Série da nota" value={form.nfeInvoiceSeries} onChange={v => patch({ nfeInvoiceSeries: v })} placeholder="1" mono />
            <Field label="Próximo número" value={form.nfeNextInvoiceNumber} onChange={v => patch({ nfeNextInvoiceNumber: v })}
              placeholder="1" inputMode="numeric" mono />
          </div>

          <div className="space-y-3 pt-2 border-t border-outline-variant/60">
            <Toggle label="Emitir automaticamente após pagamento confirmado" checked={form.nfeAutoEmit}
              onChange={v => patch({ nfeAutoEmit: v })} />
            <Toggle label="Separar alimentação e bebidas alcoólicas (duas notas)" checked={form.nfeSplitFoodDrinks}
              onChange={v => patch({ nfeSplitFoodDrinks: v })}
              hint="Alimentação reembolsável · bebidas alcoólicas em nota separada." />
          </div>

          {whatsappStatus && (
            <RestaurantWhatsAppStatusPanel whatsapp={whatsappStatus} embedded />
          )}

          <Field label="Observações internas (setup NF-e cliente)" value={form.nfeNotes} onChange={v => patch({ nfeNotes: v })}
            placeholder="Ex.: certificado A1 enviado ao Focus em 30/05/2026" multiline />
        </div>
      )}
    </section>
  )
}

function Toggle({ label, checked, onChange, hint }: {
  label: string; checked: boolean; onChange: (v: boolean) => void; hint?: string
}) {
  return (
    <label className="flex items-start gap-3 cursor-pointer">
      <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} className="mt-1 accent-primary" />
      <span>
        <span className="text-sm text-on-surface block">{label}</span>
        {hint && <span className="text-xs text-on-surface-variant">{hint}</span>}
      </span>
    </label>
  )
}

function Field({
  label, value, onChange, placeholder, mono, type = 'text', required, inputMode, multiline,
}: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; mono?: boolean
  type?: string; required?: boolean; inputMode?: 'numeric'; multiline?: boolean
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-[10px] font-mono uppercase tracking-wider text-on-surface-variant">{label}</label>
      {multiline ? (
        <textarea value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} rows={2}
          className="w-full px-3 py-2 rounded-lg text-sm bg-surface-dim border border-outline-variant text-on-surface outline-none focus:border-primary resize-none" />
      ) : (
        <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
          inputMode={inputMode} required={required} autoComplete="off"
          className={`h-10 px-3 rounded-lg text-sm bg-surface-dim border border-outline-variant text-on-surface outline-none focus:border-primary ${mono ? 'font-mono' : ''}`} />
      )}
    </div>
  )
}

function SelectField({ label, value, onChange, options }: {
  label: string; value: string; onChange: (v: string) => void
  options: { value: string; label: string }[]
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-[10px] font-mono uppercase tracking-wider text-on-surface-variant">{label}</label>
      <select value={value} onChange={e => onChange(e.target.value)}
        className="h-10 px-3 rounded-lg text-sm bg-surface-dim border border-outline-variant text-on-surface outline-none focus:border-primary">
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  )
}
