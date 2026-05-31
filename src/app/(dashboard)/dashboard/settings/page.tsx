'use client'

import { useCallback, useEffect, useState } from 'react'
import { formatCurrency } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import { DEV_BYPASS } from '@/lib/dev-mock'
import { toast } from 'sonner'
import type { LoyaltyBenefitType, LoyaltyRuleType } from '@/types'

type Tab = 'pagamentos' | 'fidelidade' | 'integracoes' | 'seguranca' | 'equipe'

const TABS: { id: Tab; label: string }[] = [
  { id: 'pagamentos',   label: 'Pagamentos'  },
  { id: 'fidelidade',   label: 'Fidelidade'  },
  { id: 'integracoes',  label: 'Integrações' },
  { id: 'seguranca',    label: 'Segurança'   },
  { id: 'equipe',       label: 'Equipe'      },
]

const MOCK_TRANSACTIONS = [
  { id: 'TRX-99281-Q', date: '24 Out, 2023', time: '14:20', amount: 450.20,  status: 'paid',    method: 'credit', label: 'Visa •••• 4242' },
  { id: 'TRX-99275-Q', date: '24 Out, 2023', time: '13:15', amount: 1280.00, status: 'pending', method: 'pix',    label: 'PIX Instantâneo' },
  { id: 'TRX-99102-Q', date: '23 Out, 2023', time: '21:44', amount: 89.90,   status: 'paid',    method: 'credit', label: 'Master •••• 9012' },
  { id: 'TRX-99088-Q', date: '23 Out, 2023', time: '19:20', amount: 215.50,  status: 'paid',    method: 'credit', label: 'Visa •••• 4242' },
]

const BENEFIT_OPTIONS: { value: LoyaltyBenefitType; label: string; icon: string }[] = [
  { value: 'free_drink',   label: 'Bebida grátis',  icon: 'local_bar' },
  { value: 'free_item',    label: 'Item grátis',    icon: 'fastfood' },
  { value: 'discount_pct', label: 'Desconto %',     icon: 'percent' },
  { value: 'custom',       label: 'Personalizado',  icon: 'redeem' },
]

type LoyaltyRule = {
  id: string
  rule_type: LoyaltyRuleType
  visit_count: number | null
  min_spend: number | null
  benefit_type: LoyaltyBenefitType
  benefit_value: string
  active: boolean
}

const INITIAL_RULES: LoyaltyRule[] = [
  { id: '1', rule_type: 'visits', visit_count: 5,  min_spend: null, benefit_type: 'free_drink',   benefit_value: 'Chope ou refrigerante grátis', active: true },
  { id: '2', rule_type: 'visits', visit_count: 10, min_spend: null, benefit_type: 'discount_pct', benefit_value: '10% de desconto na conta',    active: true },
]

export default function SettingsPage() {
  const [tab, setTab] = useState<Tab>('pagamentos')
  const [rules, setRules] = useState<LoyaltyRule[]>([])
  const [restaurantId, setRestaurantId] = useState('')
  const [addingRule, setAddingRule] = useState(false)
  const [newRuleType, setNewRuleType] = useState<LoyaltyRuleType>('visits')
  const [newVisits, setNewVisits] = useState('5')
  const [newMinSpend, setNewMinSpend] = useState('100')
  const [newBenefitType, setNewBenefitType] = useState<LoyaltyBenefitType>('free_drink')
  const [newBenefitValue, setNewBenefitValue] = useState('')

  const loadRules = useCallback(async () => {
    if (DEV_BYPASS) {
      setRules(INITIAL_RULES)
      return
    }
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data: restaurant } = await supabase
      .from('restaurants').select('id').eq('owner_id', user.id).single()
    if (!restaurant) return
    setRestaurantId(restaurant.id)
    const { data } = await supabase
      .from('loyalty_rules')
      .select('id, rule_type, visit_count, min_spend, benefit_type, benefit_value, active')
      .eq('restaurant_id', restaurant.id)
      .order('created_at')
    setRules((data ?? []) as LoyaltyRule[])
  }, [])

  useEffect(() => {
    loadRules().catch(() => {})
  }, [loadRules])

  async function toggleRule(id: string) {
    const rule = rules.find(r => r.id === id)
    if (!rule) return
    setRules(prev => prev.map(r => r.id === id ? { ...r, active: !r.active } : r))
    if (DEV_BYPASS) return
    const supabase = createClient()
    const { error } = await supabase.from('loyalty_rules').update({ active: !rule.active }).eq('id', id)
    if (error) { toast.error('Erro ao atualizar regra.'); loadRules() }
  }

  async function deleteRule(id: string) {
    setRules(prev => prev.filter(r => r.id !== id))
    if (DEV_BYPASS) return
    const supabase = createClient()
    const { error } = await supabase.from('loyalty_rules').delete().eq('id', id)
    if (error) { toast.error('Erro ao remover regra.'); loadRules() }
  }

  function resetRuleForm() {
    setNewBenefitValue(''); setNewVisits('5'); setNewMinSpend('100')
    setNewRuleType('visits'); setNewBenefitType('free_drink'); setAddingRule(false)
  }

  async function addRule() {
    const thresholdOk = newRuleType === 'visits' ? !!newVisits : !!newMinSpend
    if (!newBenefitValue.trim() || !thresholdOk) return

    const payload = {
      rule_type: newRuleType,
      visit_count: newRuleType === 'visits' ? parseInt(newVisits) : null,
      min_spend: newRuleType === 'spend' ? parseFloat(newMinSpend.replace(',', '.')) : null,
      benefit_type: newBenefitType,
      benefit_value: newBenefitValue.trim(),
      active: true,
    }

    if (DEV_BYPASS) {
      setRules(prev => [...prev, { id: Date.now().toString(), ...payload } as LoyaltyRule])
      resetRuleForm()
      return
    }

    const supabase = createClient()
    const { data, error } = await supabase.from('loyalty_rules')
      .insert({ restaurant_id: restaurantId, ...payload })
      .select('id, rule_type, visit_count, min_spend, benefit_type, benefit_value, active')
      .single()

    if (error || !data) { toast.error('Erro ao criar regra.'); return }

    setRules(prev => [...prev, data as LoyaltyRule])
    resetRuleForm()
    toast.success('Regra de fidelidade criada!')
  }

  const benefitIcon = (type: LoyaltyBenefitType) =>
    BENEFIT_OPTIONS.find(o => o.value === type)?.icon ?? 'redeem'

  // WhatsApp / Integrações state
  const [wpPhoneId, setWpPhoneId]       = useState('')
  const [wpToken, setWpToken]           = useState('')
  const [wpNfeEnabled, setWpNfeEnabled] = useState(false)
  const [wpSaving, setWpSaving]         = useState(false)
  const [wpTesting, setWpTesting]       = useState(false)

  // Asaas (marketplace / recebimento) state
  const [asaasWalletId, setAsaasWalletId] = useState<string | null>(null)
  const [asaasStatus, setAsaasStatus]     = useState<string>('pending')
  const [asaasSaving, setAsaasSaving]     = useState(false)
  const [asaasForm, setAsaasForm] = useState({
    email: '', cpfCnpj: '', mobilePhone: '', incomeValue: '',
    address: '', addressNumber: '', province: '', postalCode: '',
  })

  const loadAsaas = useCallback(async () => {
    if (DEV_BYPASS) return
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data } = await supabase
      .from('restaurants')
      .select('asaas_wallet_id, asaas_onboarding_status')
      .eq('owner_id', user.id)
      .single()
    if (data) {
      setAsaasWalletId(data.asaas_wallet_id ?? null)
      setAsaasStatus(data.asaas_onboarding_status ?? 'pending')
    }
  }, [])

  useEffect(() => { loadAsaas().catch(() => {}) }, [loadAsaas])

  async function submitAsaasOnboarding() {
    const f = asaasForm
    if (!f.email || !f.cpfCnpj || !f.mobilePhone || !f.incomeValue || !f.address || !f.addressNumber || !f.province || !f.postalCode) {
      toast.error('Preencha todos os campos para criar a conta de recebimento.')
      return
    }
    setAsaasSaving(true)
    try {
      const res = await fetch('/api/dashboard/asaas/onboard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...f, incomeValue: Number(f.incomeValue.replace(',', '.')) }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Erro ao criar conta.')
      setAsaasWalletId(data.walletId)
      setAsaasStatus(data.status ?? 'submitted')
      toast.success('Conta de recebimento criada! Em análise pelo Asaas.')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao criar conta.')
    } finally {
      setAsaasSaving(false)
    }
  }

  async function saveWhatsApp() {
    setWpSaving(true)
    await new Promise(r => setTimeout(r, 800)) // mock save
    setWpSaving(false)
    alert('Configurações de WhatsApp salvas! (conecte ao Supabase para persistir)')
  }

  async function testWhatsApp() {
    setWpTesting(true)
    await new Promise(r => setTimeout(r, 1500))
    setWpTesting(false)
    alert('Mensagem de teste enviada! Verifique o número cadastrado.')
  }

  return (
    <div className="space-y-stack-lg">
      {/* Header */}
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-3xl font-semibold text-on-surface" style={{ fontFamily: 'Geist, sans-serif', letterSpacing: '-0.02em' }}>
            Configurações
          </h2>
          <p className="text-sm text-on-surface-variant mt-1">
            Gerencie pagamentos, fidelidade, segurança e sua equipe.
          </p>
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 p-1 rounded-xl w-fit bg-surface-container-low border border-outline-variant">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-5 py-2 rounded-lg text-sm font-mono transition-all ${
              tab === t.id
                ? 'bg-primary-container text-on-primary-container font-bold'
                : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container-highest'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ── PAGAMENTOS ─────────────────────────────────── */}
      {tab === 'pagamentos' && (
        <div className="space-y-card-gap">
          {/* Stripe + Status */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-card-gap">
            <div className="lg:col-span-2 bg-surface-container border border-outline-variant rounded-xl p-6 flex flex-col md:flex-row items-center gap-6 relative overflow-hidden">
              <div className="absolute -right-10 -top-10 w-48 h-48 rounded-full pointer-events-none bg-primary/5 blur-[60px]" />
              <div className="w-16 h-16 flex-shrink-0 bg-white rounded-xl flex items-center justify-center p-3">
                <span className="font-bold text-lg text-purple-600">stripe</span>
              </div>
              <div className="flex-1 text-center md:text-left">
                <div className="flex items-center justify-center md:justify-start gap-2 mb-1">
                  <h2 className="text-base font-semibold text-on-surface">Stripe Checkout</h2>
                  <span className="px-2 py-0.5 text-[10px] font-bold font-mono uppercase tracking-wider rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    Conectado
                  </span>
                </div>
                <p className="text-sm text-on-surface-variant max-w-md">
                  Sua conta Stripe está ativa e processando pagamentos. Gerencie taxas, reembolsos e extratos no painel oficial.
                </p>
              </div>
              <button className="flex items-center gap-2 px-5 py-2.5 bg-surface-container-high border border-outline-variant rounded-lg text-sm font-mono text-on-surface hover:bg-surface-container-highest transition-colors shrink-0">
                Gerenciar Stripe
                <span className="material-symbols-outlined text-[16px]">open_in_new</span>
              </button>
            </div>

            <div className="bg-surface-container border border-outline-variant rounded-xl p-5 flex flex-col justify-between">
              <div>
                <p className="text-[10px] font-mono text-on-surface-variant uppercase tracking-widest mb-2">Status do Terminal</p>
                <h3 className="text-lg font-semibold text-on-surface flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  Operacional
                </h3>
              </div>
              <div className="mt-4 pt-4 border-t border-outline-variant">
                <div className="flex justify-between items-center mb-3">
                  <span className="text-sm text-on-surface-variant">Última sincronização</span>
                  <span className="text-sm font-mono text-on-surface">Há 2 min</span>
                </div>
                <button className="w-full py-2 text-sm font-mono flex items-center justify-center gap-1 text-primary hover:underline transition-colors">
                  Ver logs técnicos
                  <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
                </button>
              </div>
            </div>
          </div>

          {/* Payout + Bank */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-card-gap">
            <div className="bg-surface-container border border-outline-variant rounded-xl p-6 flex flex-col">
              <div className="flex justify-between items-start mb-6">
                <div className="p-3 rounded-lg bg-primary/10">
                  <span className="material-symbols-outlined text-[22px] text-primary" style={{ fontVariationSettings: "'FILL' 1" }}>
                    account_balance_wallet
                  </span>
                </div>
                <div className="text-right">
                  <p className="text-[10px] font-mono text-on-surface-variant uppercase tracking-widest">Próximo Repasse</p>
                  <p className="text-sm font-mono text-primary">24 Out, 2023</p>
                </div>
              </div>
              <div className="flex-1">
                <span className="text-xs font-mono text-on-surface-variant">Valor Estimado</span>
                <h3 className="text-3xl font-bold text-on-surface mt-1" style={{ fontFamily: 'Geist, sans-serif' }}>
                  R$ 14.280,50
                </h3>
              </div>
              <div className="mt-4 flex items-center gap-2 text-xs font-mono px-3 py-2 rounded-lg w-fit bg-emerald-500/5 text-emerald-400 border border-emerald-500/10">
                <span className="material-symbols-outlined text-[14px]">trending_up</span>
                +12.4% em relação à semana anterior
              </div>
            </div>

            <div className="bg-surface-container border border-outline-variant rounded-xl p-6 flex flex-col justify-between">
              <div className="flex justify-between items-start">
                <div className="p-3 rounded-lg bg-surface-container-highest">
                  <span className="material-symbols-outlined text-[22px] text-on-surface">account_balance</span>
                </div>
                <button className="flex items-center gap-1 text-sm font-mono text-on-surface-variant hover:text-on-surface transition-colors">
                  <span className="material-symbols-outlined text-[16px]">edit</span>
                  Editar
                </button>
              </div>
              <div className="mt-6">
                <p className="text-[10px] font-mono text-on-surface-variant uppercase tracking-widest mb-2">Conta Bancária de Destino</p>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded bg-surface-container-highest border border-outline-variant flex items-center justify-center font-bold text-xs text-on-surface">
                    ITAÚ
                  </div>
                  <div>
                    <h4 className="font-semibold text-on-surface">•••• 8821</h4>
                    <p className="text-xs text-on-surface-variant">Banco Itaú Unibanco S.A. · Corrente</p>
                  </div>
                </div>
              </div>
              <div className="mt-4 flex items-center gap-2">
                <div className="flex-1 h-1 rounded-full overflow-hidden bg-surface-container-highest">
                  <div className="h-full w-[85%] rounded-full bg-primary-container" />
                </div>
                <span className="text-[10px] font-mono text-on-surface-variant whitespace-nowrap">Verificação: 85%</span>
              </div>
            </div>
          </div>

          {/* Transactions */}
          <div className="bg-surface-container border border-outline-variant rounded-xl overflow-hidden">
            <div className="px-6 py-5 border-b border-outline-variant flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h2 className="text-base font-semibold text-on-surface">Histórico de Transações</h2>
                <p className="text-sm text-on-surface-variant">Visualize e exporte o registro de todos os recebimentos.</p>
              </div>
              <div className="flex items-center gap-3">
                <div className="relative">
                  <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-[18px]">search</span>
                  <input
                    className="h-9 pl-9 pr-4 rounded-lg text-sm outline-none w-44 bg-surface-container-low border border-outline-variant text-on-surface focus:border-primary transition-colors"
                    placeholder="Buscar ref..."
                  />
                </div>
                <button className="flex items-center gap-2 h-9 px-4 rounded-lg text-sm font-mono bg-surface-container-high border border-outline-variant text-on-surface hover:bg-surface-container-highest transition-colors">
                  <span className="material-symbols-outlined text-[16px]">download</span>
                  CSV
                </button>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-surface-container-low">
                    {['Data', 'Referência ID', 'Valor', 'Status', 'Método', ''].map((h, i) => (
                      <th key={i} className="px-6 py-3 text-[10px] font-mono uppercase tracking-widest text-on-surface-variant">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant/30">
                  {MOCK_TRANSACTIONS.map(tx => (
                    <tr key={tx.id} className="group hover:bg-surface-container-high transition-colors">
                      <td className="px-6 py-4">
                        <div className="text-sm text-on-surface">{tx.date}</div>
                        <div className="text-xs text-on-surface-variant">{tx.time}</div>
                      </td>
                      <td className="px-6 py-4 text-sm font-mono text-primary">#{tx.id}</td>
                      <td className="px-6 py-4 text-right text-lg font-semibold text-on-surface">
                        {formatCurrency(tx.amount)}
                      </td>
                      <td className="px-6 py-4 text-center">
                        {tx.status === 'paid' ? (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                            Pago
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-mono bg-amber-500/10 text-amber-400 border border-amber-500/20">
                            Pendente
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2 text-sm font-mono text-on-surface-variant">
                          <span className="material-symbols-outlined text-[16px]">
                            {tx.method === 'pix' ? 'qr_code_2' : 'credit_card'}
                          </span>
                          {tx.label}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button className="opacity-0 group-hover:opacity-100 transition-opacity text-on-surface-variant hover:text-on-surface">
                          <span className="material-symbols-outlined">more_vert</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="px-6 py-4 bg-surface-container-low flex items-center justify-between">
              <p className="text-xs font-mono text-on-surface-variant">Mostrando 4 de 2.450 transações</p>
              <div className="flex gap-2">
                <button disabled className="h-8 w-8 rounded-lg flex items-center justify-center border border-outline-variant opacity-30 text-on-surface-variant">
                  <span className="material-symbols-outlined text-[18px]">chevron_left</span>
                </button>
                <button className="h-8 w-8 rounded-lg flex items-center justify-center border border-outline-variant text-on-surface-variant hover:bg-surface-container-highest transition-colors">
                  <span className="material-symbols-outlined text-[18px]">chevron_right</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── FIDELIDADE ─────────────────────────────────── */}
      {tab === 'fidelidade' && (
        <div className="space-y-card-gap">
          {/* Intro */}
          <div className="bg-surface-container border border-outline-variant rounded-xl p-6 flex gap-5 items-start">
            <div className="p-3 rounded-lg bg-primary/10 shrink-0">
              <span className="material-symbols-outlined text-[28px] text-primary" style={{ fontVariationSettings: "'FILL' 1" }}>
                workspace_premium
              </span>
            </div>
            <div>
              <h2 className="text-base font-semibold text-on-surface mb-1">Programa de Fidelidade</h2>
              <p className="text-sm text-on-surface-variant leading-relaxed">
                Configure recompensas automáticas baseadas no número de visitas do cliente ao seu restaurante.
                O sistema conta cada check-in como uma visita e aplica o benefício correspondente.
              </p>
              <div className="flex items-center gap-3 mt-4">
                <span className="flex items-center gap-2 text-xs font-mono px-3 py-1.5 rounded-lg bg-emerald-500/8 text-emerald-400 border border-emerald-500/15">
                  <span className="material-symbols-outlined text-[14px]">check_circle</span>
                  {rules.filter(r => r.active).length} regras ativas
                </span>
                <span className="flex items-center gap-2 text-xs font-mono px-3 py-1.5 rounded-lg bg-secondary/10 text-secondary border border-secondary/20">
                  <span className="material-symbols-outlined text-[14px]">people</span>
                  Identificação via WhatsApp
                </span>
              </div>
            </div>
          </div>

          {/* Rules list */}
          <div className="bg-surface-container border border-outline-variant rounded-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-outline-variant flex items-center justify-between">
              <h3 className="text-sm font-semibold text-on-surface">Regras configuradas</h3>
              <button
                onClick={() => setAddingRule(true)}
                className="flex items-center gap-2 h-9 px-4 rounded-lg text-sm font-mono font-bold bg-primary-container text-on-primary-container hover:opacity-90 transition-opacity active:scale-95"
              >
                <span className="material-symbols-outlined text-[16px]">add</span>
                Nova regra
              </button>
            </div>

            {rules.length === 0 && !addingRule && (
              <div className="py-16 text-center">
                <span className="material-symbols-outlined text-[48px] mb-3 block text-on-surface-variant opacity-30">redeem</span>
                <p className="text-sm font-mono text-on-surface-variant">Nenhuma regra configurada ainda.</p>
              </div>
            )}

            <div className="divide-y divide-outline-variant/30">
              {rules.map(rule => (
                <div key={rule.id} className="px-6 py-4 flex items-center gap-4">
                  {/* Visits badge */}
                  <div className={`w-14 h-14 rounded-xl flex flex-col items-center justify-center shrink-0 border transition-colors ${
                    rule.active
                      ? 'bg-primary/10 border-primary/20'
                      : 'bg-surface-container-high border-outline-variant'
                  }`}>
                    <span className={`text-base font-bold leading-none ${rule.active ? 'text-primary-container' : 'text-on-surface-variant opacity-40'}`}>
                      {rule.rule_type === 'spend' ? formatCurrency(rule.min_spend ?? 0) : rule.visit_count}
                    </span>
                    <span className={`text-[9px] font-mono uppercase mt-0.5 ${rule.active ? 'text-primary' : 'text-on-surface-variant opacity-30'}`}>
                      {rule.rule_type === 'spend' ? 'gastos' : 'visitas'}
                    </span>
                  </div>

                  {/* Benefit info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className={`material-symbols-outlined text-[16px] ${rule.active ? 'text-primary' : 'text-on-surface-variant opacity-40'}`}>
                        {benefitIcon(rule.benefit_type)}
                      </span>
                      <span className={`text-xs font-mono uppercase tracking-wider ${rule.active ? 'text-on-surface-variant' : 'text-on-surface-variant opacity-40'}`}>
                        {BENEFIT_OPTIONS.find(o => o.value === rule.benefit_type)?.label}
                      </span>
                    </div>
                    <p className={`text-sm font-medium truncate ${rule.active ? 'text-on-surface' : 'text-on-surface-variant opacity-40'}`}>
                      {rule.benefit_value}
                    </p>
                  </div>

                  {/* Controls */}
                  <div className="flex items-center gap-3 shrink-0">
                    <button
                      onClick={() => toggleRule(rule.id)}
                      className="relative w-11 h-6 rounded-full transition-colors"
                      style={{ background: rule.active ? '#f97316' : '#2d3449' }}
                      title={rule.active ? 'Desativar' : 'Ativar'}
                    >
                      <span
                        className="absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all"
                        style={{ left: rule.active ? '1.375rem' : '0.125rem' }}
                      />
                    </button>
                    <button
                      onClick={() => deleteRule(rule.id)}
                      className="p-2 rounded-lg text-on-surface-variant hover:text-error hover:bg-error/10 transition-colors"
                      title="Excluir"
                    >
                      <span className="material-symbols-outlined text-[18px]">delete</span>
                    </button>
                  </div>
                </div>
              ))}

              {/* Add rule form */}
              {addingRule && (
                <div className="px-6 py-5 bg-surface-container-low">
                  <p className="text-[10px] font-mono uppercase tracking-widest text-on-surface-variant mb-4">Nova regra de fidelidade</p>

                  {/* Critério da regra: visitas ou valor gasto */}
                  <div className="flex flex-col gap-1.5 mb-4">
                    <label className="text-[10px] font-mono uppercase tracking-widest text-on-surface-variant">Critério</label>
                    <div className="flex gap-2">
                      {([
                        { id: 'visits' as const, label: 'Por nº de visitas', icon: 'event_repeat' },
                        { id: 'spend' as const, label: 'Por valor gasto (R$)', icon: 'payments' },
                      ]).map(opt => (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => setNewRuleType(opt.id)}
                          className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-mono border transition-colors ${
                            newRuleType === opt.id
                              ? 'bg-primary-container text-on-primary-container border-primary/30'
                              : 'border-outline-variant text-on-surface-variant hover:border-primary/40'
                          }`}
                        >
                          <span className="material-symbols-outlined text-[16px]">{opt.icon}</span>
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[10px] font-mono uppercase tracking-widest text-on-surface-variant">
                        {newRuleType === 'spend' ? 'Valor gasto (R$)' : 'Nº de visitas'}
                      </label>
                      {newRuleType === 'spend' ? (
                        <input
                          type="number"
                          min={1}
                          step="0.01"
                          value={newMinSpend}
                          onChange={e => setNewMinSpend(e.target.value)}
                          placeholder="Ex: 200"
                          className="h-10 px-3 rounded-lg text-sm outline-none bg-surface-dim border border-outline-variant text-on-surface focus:border-primary transition-colors"
                        />
                      ) : (
                        <input
                          type="number"
                          min={1}
                          value={newVisits}
                          onChange={e => setNewVisits(e.target.value)}
                          className="h-10 px-3 rounded-lg text-sm outline-none bg-surface-dim border border-outline-variant text-on-surface focus:border-primary transition-colors"
                        />
                      )}
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[10px] font-mono uppercase tracking-widest text-on-surface-variant">Tipo de benefício</label>
                      <select
                        value={newBenefitType}
                        onChange={e => setNewBenefitType(e.target.value as LoyaltyBenefitType)}
                        className="h-10 px-3 rounded-lg text-sm outline-none bg-surface-dim border border-outline-variant text-on-surface focus:border-primary transition-colors"
                      >
                        {BENEFIT_OPTIONS.map(o => (
                          <option key={o.value} value={o.value}>{o.label}</option>
                        ))}
                      </select>
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[10px] font-mono uppercase tracking-widest text-on-surface-variant">Descrição</label>
                      <input
                        type="text"
                        value={newBenefitValue}
                        onChange={e => setNewBenefitValue(e.target.value)}
                        placeholder="Ex: Chope grátis"
                        className="h-10 px-3 rounded-lg text-sm outline-none bg-surface-dim border border-outline-variant text-on-surface focus:border-primary transition-colors placeholder:text-on-surface-variant/40"
                      />
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <button
                      onClick={addRule}
                      disabled={!newBenefitValue.trim() || (newRuleType === 'visits' ? !newVisits : !newMinSpend)}
                      className="h-9 px-5 rounded-lg text-sm font-mono font-bold bg-primary-container text-on-primary-container hover:opacity-90 transition-opacity active:scale-95 disabled:opacity-40"
                    >
                      Salvar regra
                    </button>
                    <button
                      onClick={() => setAddingRule(false)}
                      className="h-9 px-5 rounded-lg text-sm font-mono border border-outline-variant text-on-surface-variant hover:bg-surface-container-highest transition-colors"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* How it works */}
          <div className="bg-surface-container-low border border-outline-variant rounded-xl p-5">
            <p className="text-[10px] font-mono uppercase tracking-widest text-on-surface-variant mb-4">Como funciona</p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {[
                { icon: 'qr_code_scanner', title: 'Cliente faz check-in',  desc: 'Ao escanear o QR Code e confirmar os dados, uma visita é registrada automaticamente.' },
                { icon: 'workspace_premium', title: 'Sistema contabiliza', desc: 'Cada visita é somada ao histórico do cliente naquele restaurante específico.' },
                { icon: 'redeem', title: 'Benefício liberado',             desc: 'Ao atingir o número de visitas configurado, o benefício aparece para o garçom na comanda.' },
              ].map(item => (
                <div key={item.icon} className="flex gap-3">
                  <span className="material-symbols-outlined text-[20px] shrink-0 mt-0.5 text-primary">{item.icon}</span>
                  <div>
                    <p className="text-sm font-semibold text-on-surface mb-0.5">{item.title}</p>
                    <p className="text-xs text-on-surface-variant leading-relaxed">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── INTEGRAÇÕES ────────────────────────────────── */}
      {tab === 'integracoes' && (
        <div className="space-y-card-gap">

          {/* Asaas — Conta de recebimento (marketplace/split) */}
          <div className="bg-surface-container border border-outline-variant rounded-xl overflow-hidden">
            <div className="px-6 py-4 flex items-center gap-4 border-b border-outline-variant"
              style={{ background: 'linear-gradient(135deg, rgba(0,176,255,0.08), transparent)' }}>
              <div className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl"
                style={{ background: 'rgba(0,176,255,0.12)', border: '1px solid rgba(0,176,255,0.2)' }}>
                🏦
              </div>
              <div className="flex-1">
                <h3 className="text-base font-semibold text-on-surface">Conta de Recebimento (Asaas)</h3>
                <p className="text-sm text-on-surface-variant mt-0.5">
                  Receba os pagamentos dos clientes direto na sua conta. A Qomanda repassa o valor automaticamente, já descontando a taxa do seu plano.
                </p>
              </div>
              {asaasWalletId ? (
                <span className="text-[10px] font-mono px-2 py-1 rounded" style={{ background: 'rgba(16,185,129,0.12)', color: '#10b981', border: '1px solid rgba(16,185,129,0.2)' }}>
                  {asaasStatus === 'approved' ? 'ATIVA' : 'EM ANÁLISE'}
                </span>
              ) : (
                <span className="text-[10px] font-mono px-2 py-1 rounded" style={{ background: 'rgba(245,158,11,0.12)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.2)' }}>
                  CONFIGURAR
                </span>
              )}
            </div>

            <div className="px-6 py-5">
              {asaasWalletId ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <span className="material-symbols-outlined text-[20px] text-emerald-400">check_circle</span>
                    <div>
                      <p className="text-sm font-semibold text-on-surface">Conta conectada</p>
                      <p className="text-xs font-mono text-on-surface-variant">Wallet: {asaasWalletId}</p>
                    </div>
                  </div>
                  {asaasStatus !== 'approved' && (
                    <div className="px-4 py-3 rounded-lg border border-outline-variant bg-surface-container-low">
                      <p className="text-xs text-on-surface-variant leading-relaxed">
                        Sua conta está <span className="font-semibold text-on-surface">em análise pelo Asaas</span>. Você já pode receber, mas a liberação dos saques depende da aprovação dos documentos (KYC) no painel do Asaas.
                      </p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {[
                      { key: 'email',        label: 'E-mail',            ph: 'contato@restaurante.com', mode: 'email' },
                      { key: 'cpfCnpj',      label: 'CPF ou CNPJ',       ph: 'Apenas números', mode: 'numeric' },
                      { key: 'mobilePhone',  label: 'Celular',           ph: '(11) 99999-9999', mode: 'tel' },
                      { key: 'incomeValue',  label: 'Faturamento mensal estimado (R$)', ph: 'Ex: 50000', mode: 'decimal' },
                      { key: 'postalCode',   label: 'CEP',               ph: 'Apenas números', mode: 'numeric' },
                      { key: 'address',      label: 'Endereço',          ph: 'Rua / Avenida', mode: 'text' },
                      { key: 'addressNumber',label: 'Número',            ph: '123', mode: 'text' },
                      { key: 'province',     label: 'Bairro',            ph: 'Centro', mode: 'text' },
                    ].map(f => (
                      <div key={f.key} className="flex flex-col gap-1.5">
                        <label className="text-[10px] font-mono uppercase tracking-wider text-on-surface-variant">{f.label}</label>
                        <input
                          value={(asaasForm as Record<string, string>)[f.key]}
                          onChange={e => setAsaasForm(prev => ({ ...prev, [f.key]: e.target.value }))}
                          placeholder={f.ph}
                          inputMode={f.mode as React.HTMLAttributes<HTMLInputElement>['inputMode']}
                          className="h-10 px-3 rounded-lg text-sm outline-none bg-surface-dim border border-outline-variant text-on-surface focus:border-primary transition-colors placeholder:text-on-surface-variant/40"
                        />
                      </div>
                    ))}
                  </div>
                  <button onClick={submitAsaasOnboarding} disabled={asaasSaving}
                    className="h-10 px-6 rounded-lg text-sm font-mono font-bold bg-primary-container text-on-primary-container hover:opacity-90 transition-opacity active:scale-95 disabled:opacity-40">
                    {asaasSaving ? 'Criando conta...' : 'Criar conta de recebimento'}
                  </button>
                  <p className="text-[10px] text-on-surface-variant opacity-60 leading-relaxed">
                    Ao criar, abrimos uma subconta Asaas vinculada ao seu restaurante. Os documentos para liberação de saque são enviados depois, no painel do Asaas.
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* WhatsApp Business */}
          <div className="bg-surface-container border border-outline-variant rounded-xl overflow-hidden">
            <div className="px-6 py-4 flex items-center gap-4 border-b border-outline-variant"
              style={{ background: 'linear-gradient(135deg, rgba(37,211,102,0.08), transparent)' }}>
              <div className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl"
                style={{ background: 'rgba(37,211,102,0.12)', border: '1px solid rgba(37,211,102,0.2)' }}>
                💬
              </div>
              <div className="flex-1">
                <h3 className="text-base font-semibold text-on-surface">WhatsApp Business API</h3>
                <p className="text-sm text-on-surface-variant mt-0.5">
                  Envie automaticamente a nota de pagamento e NF-e para o WhatsApp do cliente após cada transação.
                </p>
              </div>
              <span className="text-[10px] font-mono px-2 py-1 rounded" style={{ background: 'rgba(245,158,11,0.12)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.2)' }}>
                CONFIGURAR
              </span>
            </div>

            <div className="px-6 py-5 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-mono uppercase tracking-wider text-on-surface-variant">
                    Phone Number ID
                  </label>
                  <input
                    value={wpPhoneId} onChange={e => setWpPhoneId(e.target.value)}
                    placeholder="Ex: 123456789012345"
                    className="h-10 px-3 rounded-lg text-sm font-mono outline-none bg-surface-dim border border-outline-variant text-on-surface focus:border-primary transition-colors"
                  />
                  <p className="text-[10px] text-on-surface-variant opacity-60">
                    Encontrado em Meta → WhatsApp → API Setup
                  </p>
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-mono uppercase tracking-wider text-on-surface-variant">
                    Access Token
                  </label>
                  <input
                    type="password" value={wpToken} onChange={e => setWpToken(e.target.value)}
                    placeholder="EAAxxxxxxxxxxxxx..."
                    className="h-10 px-3 rounded-lg text-sm font-mono outline-none bg-surface-dim border border-outline-variant text-on-surface focus:border-primary transition-colors"
                  />
                  <p className="text-[10px] text-on-surface-variant opacity-60">
                    Token permanente do sistema (não o temporário de 24h)
                  </p>
                </div>
              </div>

              {/* Toggle NF-e automática */}
              <div className="flex items-center justify-between p-4 rounded-xl bg-surface-container-low border border-outline-variant">
                <div>
                  <p className="text-sm font-semibold text-on-surface">Enviar nota automaticamente após pagamento</p>
                  <p className="text-xs text-on-surface-variant mt-0.5">
                    O cliente recebe a nota no WhatsApp assim que o pagamento for confirmado
                  </p>
                </div>
                <button onClick={() => setWpNfeEnabled(v => !v)}
                  className="relative w-11 h-6 rounded-full transition-colors shrink-0 ml-4"
                  style={{ background: wpNfeEnabled ? '#f97316' : '#2d3449' }}>
                  <span className="absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all"
                    style={{ left: wpNfeEnabled ? '1.375rem' : '0.125rem' }} />
                </button>
              </div>

              <div className="flex gap-3">
                <button onClick={saveWhatsApp} disabled={wpSaving || !wpPhoneId || !wpToken}
                  className="h-10 px-6 rounded-lg text-sm font-mono font-bold bg-primary-container text-on-primary-container hover:opacity-90 transition-opacity active:scale-95 disabled:opacity-40">
                  {wpSaving ? 'Salvando...' : 'Salvar configuração'}
                </button>
                <button onClick={testWhatsApp} disabled={wpTesting || !wpPhoneId || !wpToken}
                  className="h-10 px-5 rounded-lg text-sm font-mono border border-outline-variant text-on-surface-variant hover:bg-surface-container-highest transition-colors disabled:opacity-40">
                  {wpTesting ? 'Enviando...' : '📱 Enviar mensagem de teste'}
                </button>
              </div>
            </div>
          </div>

          {/* NF-e */}
          <div className="bg-surface-container border border-outline-variant rounded-xl overflow-hidden">
            <div className="px-6 py-4 flex items-center gap-4 border-b border-outline-variant">
              <div className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl"
                style={{ background: 'rgba(123,208,255,0.1)', border: '1px solid rgba(123,208,255,0.2)' }}>
                🧾
              </div>
              <div className="flex-1">
                <h3 className="text-base font-semibold text-on-surface">Nota Fiscal Eletrônica (NF-e)</h3>
                <p className="text-sm text-on-surface-variant mt-0.5">
                  Emissão automática de NF-e integrada com Focus NFe, NFe.io ou similar. Documento oficial aceito para reembolso corporativo.
                </p>
              </div>
              <span className="text-[10px] font-mono px-2 py-1 rounded" style={{ background: 'rgba(88,66,55,0.2)', color: '#a78b7d', border: '1px solid rgba(88,66,55,0.3)' }}>
                EM BREVE
              </span>
            </div>
            <div className="px-6 py-5 space-y-3">
              {[
                { icon: 'business',        text: 'CNPJ do restaurante + certificado digital A1' },
                { icon: 'receipt_long',    text: 'Emissão automática via SEFAZ após pagamento' },
                { icon: 'call_split',      text: 'NF-e separada: alimentação (reembolsável) e bebidas (pessoal)' },
                { icon: 'send',            text: 'Envio automático por WhatsApp ao CPF do cliente' },
              ].map(item => (
                <div key={item.text} className="flex items-center gap-3">
                  <span className="material-symbols-outlined text-[18px] shrink-0 text-on-surface-variant opacity-50">{item.icon}</span>
                  <p className="text-sm text-on-surface-variant">{item.text}</p>
                </div>
              ))}
              <div className="mt-2 px-4 py-3 rounded-lg border border-outline-variant bg-surface-container-low">
                <p className="text-xs text-on-surface-variant leading-relaxed">
                  <span className="font-semibold text-on-surface">Para configurar:</span> o restaurante precisa de CNPJ ativo, certificado digital A1 e conta em um provedor homologado (Focus NFe, NFe.io, Nota Simples, etc.). Entre em contato: <span className="text-primary font-mono">contato@qomanda.com.br</span>
                </p>
              </div>
            </div>
          </div>

        </div>
      )}

      {/* ── SEGURANÇA ──────────────────────────────────── */}
      {tab === 'seguranca' && (
        <div className="bg-surface-container border border-outline-variant rounded-xl p-12 flex flex-col items-center justify-center text-center">
          <span className="material-symbols-outlined text-[48px] mb-3 text-on-surface-variant opacity-30">shield_lock</span>
          <p className="text-base font-semibold text-on-surface">Segurança</p>
          <p className="text-sm text-on-surface-variant mt-1">Em breve: 2FA, histórico de sessões e controle de acesso.</p>
        </div>
      )}

      {/* ── EQUIPE ─────────────────────────────────────── */}
      {tab === 'equipe' && (
        <div className="bg-surface-container border border-outline-variant rounded-xl p-12 flex flex-col items-center justify-center text-center">
          <span className="material-symbols-outlined text-[48px] mb-3 text-on-surface-variant opacity-30">group</span>
          <p className="text-base font-semibold text-on-surface">Equipe</p>
          <p className="text-sm text-on-surface-variant mt-1">Em breve: convide garçons, cozinheiros e gerentes com permissões específicas.</p>
        </div>
      )}
    </div>
  )
}
