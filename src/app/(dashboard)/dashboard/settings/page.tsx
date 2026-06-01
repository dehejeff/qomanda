'use client'

import { useCallback, useEffect, useState } from 'react'
import { formatCurrency } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import { DEV_BYPASS } from '@/lib/dev-mock'
import { toast } from 'sonner'
import { paymentMethodLabel } from '@/lib/payment-receipt'
import { BRAZIL_BANKS } from '@/lib/brazil-banks'
import type { PayoutBankAccountDto } from '@/app/api/dashboard/payout/bank-account/route'
import type { OnboardStatusDto } from '@/app/api/dashboard/asaas/onboard/route'
import type { WhatsAppIntegrationDto } from '@/app/api/dashboard/integrations/whatsapp/route'
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
  { id: 'TRX-99281-Q', date: '24 Out, 2023', time: '14:20', amount: 450.20,  status: 'paid',    method: 'credit', label: 'Crédito' },
  { id: 'TRX-99275-Q', date: '24 Out, 2023', time: '13:15', amount: 1280.00, status: 'pending', method: 'pix',    label: 'PIX' },
  { id: 'TRX-99102-Q', date: '23 Out, 2023', time: '21:44', amount: 89.90,   status: 'paid',    method: 'cash',   label: 'Dinheiro' },
  { id: 'TRX-99088-Q', date: '23 Out, 2023', time: '19:20', amount: 215.50,  status: 'paid',    method: 'debit',  label: 'Débito' },
]

type PaymentTxRow = {
  id: string
  amount: number
  method: string
  status: string
  created_at: string
  paid_at: string | null
  confirmation_code: string | null
  customer?: { first_name?: string; last_name?: string } | null
}

const PAYMENT_STATUS_LABEL: Record<string, { label: string; className: string }> = {
  paid:       { label: 'Pago',      className: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' },
  pending:    { label: 'Pendente',  className: 'bg-amber-500/10 text-amber-400 border-amber-500/20' },
  processing: { label: 'Processando', className: 'bg-blue-500/10 text-blue-400 border-blue-500/20' },
  failed:     { label: 'Falhou',    className: 'bg-red-500/10 text-red-400 border-red-500/20' },
  refunded:   { label: 'Estornado', className: 'bg-surface-container-high text-on-surface-variant border-outline-variant' },
}

function paymentMethodIcon(method: string) {
  switch (method) {
    case 'pix': return 'qr_code_2'
    case 'cash': return 'payments'
    case 'offer': return 'redeem'
    case 'debit': return 'credit_card'
    default: return 'contactless'
  }
}

function formatTxDate(iso: string) {
  const d = new Date(iso)
  return {
    date: d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' }),
    time: d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
  }
}

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

  const [paymentTxs, setPaymentTxs] = useState<PaymentTxRow[]>([])
  const [paymentsLoading, setPaymentsLoading] = useState(true)
  const [txSearch, setTxSearch] = useState('')
  const [paymentStats, setPaymentStats] = useState({
    todayTotal: 0,
    todayCount: 0,
    pendingCash: 0,
    pendingDigital: 0,
  })

  const loadPayments = useCallback(async (rid: string) => {
    if (DEV_BYPASS) {
      setPaymentTxs([])
      setPaymentStats({ todayTotal: 14280.5, todayCount: 4, pendingCash: 1, pendingDigital: 1 })
      setPaymentsLoading(false)
      return
    }

    const supabase = createClient()
    const { data } = await supabase
      .from('payments')
      .select('id, amount, method, status, created_at, paid_at, confirmation_code, customer:customers(first_name, last_name)')
      .eq('restaurant_id', rid)
      .order('created_at', { ascending: false })
      .limit(100)

    const rows = (data ?? []) as PaymentTxRow[]
    setPaymentTxs(rows)

    const todayStart = new Date()
    todayStart.setHours(0, 0, 0, 0)
    const todayMs = todayStart.getTime()

    let todayTotal = 0
    let todayCount = 0
    let pendingCash = 0
    let pendingDigital = 0

    for (const p of rows) {
      if (p.status === 'pending' || p.status === 'processing') {
        if (p.method === 'cash') pendingCash++
        else pendingDigital++
      }
      if (p.status === 'paid' && p.paid_at && new Date(p.paid_at).getTime() >= todayMs) {
        todayTotal += Number(p.amount)
        todayCount++
      }
    }

    setPaymentStats({
      todayTotal: Math.round(todayTotal * 100) / 100,
      todayCount,
      pendingCash,
      pendingDigital,
    })
    setPaymentsLoading(false)
  }, [])

  const loadRules = useCallback(async () => {
    if (DEV_BYPASS) {
      setRules(INITIAL_RULES)
      void loadPayments('mock')
      return
    }
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data: restaurant } = await supabase
      .from('restaurants').select('id').eq('owner_id', user.id).single()
    if (!restaurant) return
    setRestaurantId(restaurant.id)
    void loadPayments(restaurant.id)
    const { data } = await supabase
      .from('loyalty_rules')
      .select('id, rule_type, visit_count, min_spend, benefit_type, benefit_value, active')
      .eq('restaurant_id', restaurant.id)
      .order('created_at')
    setRules((data ?? []) as LoyaltyRule[])
  }, [loadPayments])

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
  const [wpPhoneId, setWpPhoneId] = useState('')
  const [wpToken, setWpToken] = useState('')
  const [wpNfeEnabled, setWpNfeEnabled] = useState(false)
  const [wpIntegration, setWpIntegration] = useState<WhatsAppIntegrationDto | null>(null)
  const [wpLoading, setWpLoading] = useState(true)
  const [wpSaving, setWpSaving] = useState(false)
  const [wpTesting, setWpTesting] = useState(false)
  const [wpTestPhone, setWpTestPhone] = useState('')

  // Conta bancária de repasse (Qomanda Pay)
  const [payoutAccount, setPayoutAccount] = useState<PayoutBankAccountDto | null>(null)
  const [payoutLoading, setPayoutLoading] = useState(true)
  const [payoutSaving, setPayoutSaving] = useState(false)
  const [asaasStatus, setAsaasStatus] = useState<OnboardStatusDto | null>(null)
  const [asaasChecking, setAsaasChecking] = useState(false)
  const [editingBank, setEditingBank] = useState(false)
  const [bankForm, setBankForm] = useState({
    holderName: '',
    document: '',
    bankCode: '341',
    bankName: 'Itaú',
    agency: '',
    account: '',
    accountDigit: '',
    accountType: 'checking' as 'checking' | 'savings',
  })

  const loadPayoutAccount = useCallback(async () => {
    if (DEV_BYPASS) {
      setPayoutAccount({
        configured: false,
        holderName: null,
        document: null,
        bankCode: null,
        bankName: null,
        bankAgency: null,
        bankAccountMasked: null,
        accountType: null,
        configuredAt: null,
        digitalStatus: 'inactive',
        digitalStatusLabel: 'Aguardando cadastro bancário',
      })
      setPayoutLoading(false)
      return
    }
    try {
      const res = await fetch('/api/dashboard/payout/bank-account')
      const data = await res.json()
      if (res.ok && data.account) {
        setPayoutAccount(data.account as PayoutBankAccountDto)
        if (data.account.configured) {
          setBankForm(prev => ({
            ...prev,
            holderName: data.account.holderName ?? '',
            document: data.account.document ?? '',
            bankCode: data.account.bankCode ?? prev.bankCode,
            bankName: data.account.bankName ?? prev.bankName,
            agency: data.account.bankAgency ?? '',
            accountType: data.account.accountType ?? 'checking',
          }))
        }
      }
    } finally {
      setPayoutLoading(false)
    }
  }, [])

  useEffect(() => { loadPayoutAccount().catch(() => {}) }, [loadPayoutAccount])

  async function checkAsaasStatus() {
    setAsaasChecking(true)
    try {
      const res = await fetch('/api/dashboard/asaas/onboard')
      const data = await res.json() as OnboardStatusDto
      if (res.ok) {
        setAsaasStatus(data)
        if (data.status === 'approved' && payoutAccount) {
          setPayoutAccount({ ...payoutAccount, digitalStatus: 'active', digitalStatusLabel: 'Qomanda Pay ativo' })
        }
        if (data.status === 'approved') toast.success('Conta aprovada! PIX e cartão liberados.')
        else if (data.refreshed) toast.message('Ainda em análise. Tente novamente em breve.')
      }
    } catch {
      toast.error('Erro ao verificar status.')
    } finally {
      setAsaasChecking(false)
    }
  }

  const loadWhatsApp = useCallback(async () => {
    if (DEV_BYPASS) {
      setWpIntegration({
        phoneNumberId: null,
        hasToken: false,
        tokenMasked: null,
        nfeAutoSendEnabled: false,
        status: 'disconnected',
        statusLabel: 'Pendente',
      })
      setWpLoading(false)
      return
    }
    try {
      const res = await fetch('/api/dashboard/integrations/whatsapp')
      const data = await res.json()
      if (res.ok && data.integration) {
        const integration = data.integration as WhatsAppIntegrationDto
        setWpIntegration(integration)
        setWpPhoneId(integration.phoneNumberId ?? '')
        setWpNfeEnabled(integration.nfeAutoSendEnabled)
      }
    } finally {
      setWpLoading(false)
    }
  }, [])

  useEffect(() => { loadWhatsApp().catch(() => {}) }, [loadWhatsApp])

  async function submitBankAccount() {
    setPayoutSaving(true)
    try {
      const selectedBank = BRAZIL_BANKS.find(b => b.code === bankForm.bankCode)
      const res = await fetch('/api/dashboard/payout/bank-account', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...bankForm,
          bankName: selectedBank?.name ?? bankForm.bankName,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Erro ao salvar conta.')
      setPayoutAccount(data.account as PayoutBankAccountDto)
      setEditingBank(false)
      toast.success(data.message ?? 'Conta bancária salva!')
      if (restaurantId) void loadPayments(restaurantId)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao salvar conta.')
    } finally {
      setPayoutSaving(false)
    }
  }

  async function saveWhatsApp() {
    setWpSaving(true)
    try {
      const res = await fetch('/api/dashboard/integrations/whatsapp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phoneNumberId: wpPhoneId,
          accessToken: wpToken,
          nfeAutoSendEnabled: wpNfeEnabled,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Erro ao salvar WhatsApp.')
      setWpIntegration(data.integration as WhatsAppIntegrationDto)
      setWpToken('')
      toast.success(data.message ?? 'WhatsApp salvo!')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao salvar WhatsApp.')
    } finally {
      setWpSaving(false)
    }
  }

  async function testWhatsApp() {
    setWpTesting(true)
    try {
      const res = await fetch('/api/dashboard/integrations/whatsapp/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to: wpTestPhone }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Erro ao enviar teste.')
      toast.success(data.mock ? 'Teste simulado (dev). Verifique o console.' : 'Mensagem de teste enviada!')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao enviar teste.')
    } finally {
      setWpTesting(false)
    }
  }

  const filteredPaymentTxs = paymentTxs.filter(tx => {
    if (!txSearch.trim()) return true
    const q = txSearch.trim().toLowerCase()
    const name = tx.customer
      ? `${tx.customer.first_name ?? ''} ${tx.customer.last_name ?? ''}`.trim().toLowerCase()
      : ''
    return tx.id.toLowerCase().includes(q)
      || (tx.confirmation_code ?? '').toLowerCase().includes(q)
      || name.includes(q)
  })

  type DisplayTx = {
    id: string
    date: string
    time: string
    amount: number
    status: string
    method: string
    label: string
    customerName: string
  }

  const displayTransactions: DisplayTx[] = DEV_BYPASS && paymentTxs.length === 0
    ? MOCK_TRANSACTIONS.map(tx => ({ ...tx, customerName: '—' }))
    : filteredPaymentTxs.map(tx => ({
        id: tx.id,
        ...formatTxDate(tx.paid_at ?? tx.created_at),
        amount: Number(tx.amount),
        status: tx.status,
        method: tx.method,
        label: paymentMethodLabel(tx.method),
        customerName: tx.customer
          ? `${tx.customer.first_name ?? ''} ${tx.customer.last_name ?? ''}`.trim() || '—'
          : '—',
      }))

  function exportPaymentsCsv() {
    const rows = DEV_BYPASS && paymentTxs.length === 0
      ? MOCK_TRANSACTIONS
      : filteredPaymentTxs.map(tx => ({
          id: tx.id,
          date: tx.paid_at ?? tx.created_at,
          amount: Number(tx.amount),
          status: tx.status,
          method: paymentMethodLabel(tx.method),
        }))
    if (rows.length === 0) {
      toast.message('Nenhuma transação para exportar.')
      return
    }
    const header = 'id,data,valor,status,metodo\n'
    const body = rows.map(r =>
      `${r.id},${r.date},${r.amount},${r.status},${r.method}`,
    ).join('\n')
    const blob = new Blob([header + body], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `qomanda-pagamentos-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const digitalActive = payoutAccount?.digitalStatus === 'active'
  const digitalPending = payoutAccount?.digitalStatus === 'pending'
  const bankConfigured = payoutAccount?.configured ?? false

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
          {/* Qomanda Pay + conta bancária */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-card-gap">
            <div className="lg:col-span-2 bg-surface-container border border-outline-variant rounded-xl p-6 space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-start gap-4">
                <div className="w-14 h-14 shrink-0 rounded-xl flex items-center justify-center"
                  style={{ background: 'rgba(249,115,22,0.12)', border: '1px solid rgba(249,115,22,0.25)' }}>
                  <span className="material-symbols-outlined text-[28px] text-primary">account_balance</span>
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <h2 className="text-base font-semibold text-on-surface">Qomanda Pay</h2>
                    <span className={`px-2 py-0.5 text-[10px] font-bold font-mono uppercase tracking-wider rounded border ${
                      digitalActive
                        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                        : digitalPending || bankConfigured
                          ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                          : 'bg-surface-container-high text-on-surface-variant border-outline-variant'
                    }`}>
                      {payoutLoading ? '…' : (payoutAccount?.digitalStatusLabel ?? 'Aguardando cadastro')}
                    </span>
                  </div>
                  <p className="text-sm text-on-surface-variant leading-relaxed">
                    Informe a conta bancária do restaurante para receber repasses de PIX, crédito e débito.
                    Pagamentos em dinheiro na mesa não passam por aqui — são confirmados manualmente.
                  </p>
                </div>
              </div>

              {payoutLoading ? (
                <p className="text-sm font-mono text-on-surface-variant">Carregando...</p>
              ) : bankConfigured && !editingBank && payoutAccount ? (
                <div className="rounded-xl border border-outline-variant bg-surface-container-low p-5 space-y-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-[10px] font-mono uppercase tracking-widest text-on-surface-variant mb-2">Conta de destino</p>
                      <p className="text-sm font-semibold text-on-surface">{payoutAccount.bankName}</p>
                      <p className="text-sm font-mono text-on-surface-variant mt-1">
                        Ag. {payoutAccount.bankAgency} · {payoutAccount.bankAccountMasked}
                        {' · '}{payoutAccount.accountType === 'savings' ? 'Poupança' : 'Corrente'}
                      </p>
                      <p className="text-xs text-on-surface-variant mt-2">
                        Titular: {payoutAccount.holderName}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setEditingBank(true)}
                      className="flex items-center gap-1 text-sm font-mono text-on-surface-variant hover:text-on-surface transition-colors shrink-0"
                    >
                      <span className="material-symbols-outlined text-[16px]">edit</span>
                      Alterar
                    </button>
                  </div>
                  {digitalPending && (
                    <p className="text-xs text-amber-400/90 leading-relaxed border-t border-outline-variant pt-3">
                      Sua conta bancária foi recebida e está em validação. Assim que aprovada, PIX e cartão ficam liberados para os clientes.
                    </p>
                  )}
                </div>
              ) : (
                <div className="space-y-4">
                  <p className="text-[10px] font-mono uppercase tracking-widest text-on-surface-variant">
                    {bankConfigured ? 'Alterar conta bancária' : 'Dados bancários e contratuais'}
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="flex flex-col gap-1.5 md:col-span-2">
                      <label className="text-[10px] font-mono uppercase tracking-wider text-on-surface-variant">Titular da conta</label>
                      <input
                        value={bankForm.holderName}
                        onChange={e => setBankForm(p => ({ ...p, holderName: e.target.value }))}
                        placeholder="Razão social ou nome do titular"
                        className="h-10 px-3 rounded-lg text-sm outline-none bg-surface-dim border border-outline-variant text-on-surface focus:border-primary"
                      />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[10px] font-mono uppercase tracking-wider text-on-surface-variant">CPF ou CNPJ do titular</label>
                      <input
                        value={bankForm.document}
                        onChange={e => {
                          const digits = e.target.value.replace(/\D/g, '').slice(0, 14)
                          const fmt = digits.length <= 11
                            ? digits.replace(/(\d{3})(\d{3})(\d{3})(\d{1,2})/, '$1.$2.$3-$4')
                                    .replace(/(\d{3})(\d{3})(\d{1,3})/, '$1.$2.$3')
                                    .replace(/(\d{3})(\d{1,3})/, '$1.$2')
                            : digits.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{1,2})/, '$1.$2.$3/$4-$5')
                                    .replace(/(\d{2})(\d{3})(\d{3})(\d{1,4})/, '$1.$2.$3/$4')
                                    .replace(/(\d{2})(\d{3})(\d{1,3})/, '$1.$2.$3')
                                    .replace(/(\d{2})(\d{1,3})/, '$1.$2')
                          setBankForm(p => ({ ...p, document: fmt }))
                        }}
                        placeholder="000.000.000-00 ou 00.000.000/0001-00"
                        inputMode="numeric"
                        maxLength={18}
                        className="h-10 px-3 rounded-lg text-sm font-mono outline-none bg-surface-dim border border-outline-variant text-on-surface focus:border-primary"
                      />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[10px] font-mono uppercase tracking-wider text-on-surface-variant">Banco</label>
                      <select
                        value={bankForm.bankCode}
                        onChange={e => {
                          const bank = BRAZIL_BANKS.find(b => b.code === e.target.value)
                          setBankForm(p => ({ ...p, bankCode: e.target.value, bankName: bank?.name ?? p.bankName }))
                        }}
                        className="h-10 px-3 rounded-lg text-sm outline-none bg-surface-dim border border-outline-variant text-on-surface focus:border-primary"
                      >
                        {BRAZIL_BANKS.map(b => (
                          <option key={b.code} value={b.code}>{b.code} — {b.name}</option>
                        ))}
                      </select>
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[10px] font-mono uppercase tracking-wider text-on-surface-variant">
                        Agência <span className="normal-case text-on-surface-variant/50">(sem dígito)</span>
                      </label>
                      <input
                        value={bankForm.agency}
                        onChange={e => setBankForm(p => ({ ...p, agency: e.target.value.replace(/\D/g, '').slice(0, 5) }))}
                        placeholder="0000"
                        inputMode="numeric"
                        maxLength={5}
                        className="h-10 px-3 rounded-lg text-sm font-mono outline-none bg-surface-dim border border-outline-variant text-on-surface focus:border-primary"
                      />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[10px] font-mono uppercase tracking-wider text-on-surface-variant">
                        Conta
                        {bankConfigured && payoutAccount?.bankAccountMasked && (
                          <span className="normal-case text-on-surface-variant/50 ml-1">
                            (atual: {payoutAccount.bankAccountMasked})
                          </span>
                        )}
                      </label>
                      <input
                        value={bankForm.account}
                        onChange={e => setBankForm(p => ({ ...p, account: e.target.value.replace(/\D/g, '').slice(0, 12) }))}
                        placeholder={bankConfigured ? 'Redigite para alterar' : '00000000'}
                        inputMode="numeric"
                        maxLength={12}
                        className="h-10 px-3 rounded-lg text-sm font-mono outline-none bg-surface-dim border border-outline-variant text-on-surface focus:border-primary"
                      />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[10px] font-mono uppercase tracking-wider text-on-surface-variant">Dígito</label>
                      <input
                        value={bankForm.accountDigit}
                        onChange={e => setBankForm(p => ({ ...p, accountDigit: e.target.value.replace(/\D/g, '').slice(0, 2) }))}
                        placeholder="0"
                        inputMode="numeric"
                        maxLength={2}
                        className="h-10 px-3 rounded-lg text-sm font-mono outline-none bg-surface-dim border border-outline-variant text-on-surface focus:border-primary"
                      />
                    </div>
                    <div className="flex flex-col gap-1.5 md:col-span-2">
                      <label className="text-[10px] font-mono uppercase tracking-wider text-on-surface-variant">Tipo de conta</label>
                      <div className="flex gap-2">
                        {([
                          { id: 'checking' as const, label: 'Corrente' },
                          { id: 'savings' as const, label: 'Poupança' },
                        ]).map(opt => (
                          <button
                            key={opt.id}
                            type="button"
                            onClick={() => setBankForm(p => ({ ...p, accountType: opt.id }))}
                            className={`px-4 py-2 rounded-lg text-xs font-mono border transition-colors ${
                              bankForm.accountType === opt.id
                                ? 'bg-primary-container text-on-primary-container border-primary/30'
                                : 'border-outline-variant text-on-surface-variant'
                            }`}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={submitBankAccount}
                      disabled={payoutSaving}
                      className="h-10 px-6 rounded-lg text-sm font-mono font-bold bg-primary-container text-on-primary-container hover:opacity-90 disabled:opacity-40"
                    >
                      {payoutSaving ? 'Salvando...' : 'Salvar conta bancária'}
                    </button>
                    {bankConfigured && (
                      <button
                        type="button"
                        onClick={() => setEditingBank(false)}
                        className="h-10 px-5 rounded-lg text-sm font-mono border border-outline-variant text-on-surface-variant"
                      >
                        Cancelar
                      </button>
                    )}
                  </div>
                  <p className="text-[10px] text-on-surface-variant leading-relaxed">
                    O repasse só pode ser feito em conta vinculada ao CNPJ (ou CPF do titular, se MEI) cadastrado no restaurante.
                  </p>
                </div>
              )}

              {/* Asaas onboarding status */}
              {!payoutLoading && (
                <div className="pt-4 border-t border-outline-variant">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="space-y-1">
                      <p className="text-[10px] font-mono uppercase tracking-widest text-on-surface-variant">
                        Status Qomanda Pay
                      </p>
                      {digitalActive ? (
                        <div className="flex items-center gap-2">
                          <span className="material-symbols-outlined text-[16px] text-emerald-400">verified</span>
                          <span className="text-sm font-mono text-emerald-400">Subconta aprovada — split ativo</span>
                        </div>
                      ) : digitalPending ? (
                        <div className="flex items-center gap-2">
                          <span className="material-symbols-outlined text-[16px] text-amber-400">pending</span>
                          <span className="text-sm font-mono text-amber-400">
                            {asaasStatus?.refreshed
                              ? `Em análise no Asaas (${asaasStatus.asaasApproval ?? 'AWAITING'})`
                              : 'Documentação enviada — aguardando análise'}
                          </span>
                        </div>
                      ) : bankConfigured ? (
                        <div className="flex items-center gap-2">
                          <span className="material-symbols-outlined text-[16px] text-on-surface-variant opacity-50">info</span>
                          <span className="text-sm font-mono text-on-surface-variant">
                            Conta bancária salva. Ativação Asaas pendente de dados cadastrais completos.
                          </span>
                        </div>
                      ) : (
                        <span className="text-sm font-mono text-on-surface-variant opacity-60">Cadastre a conta bancária para iniciar.</span>
                      )}
                    </div>

                    {digitalPending && (
                      <button
                        type="button"
                        onClick={checkAsaasStatus}
                        disabled={asaasChecking}
                        className="flex items-center gap-2 h-9 px-4 rounded-lg text-sm font-mono border border-outline-variant text-on-surface-variant hover:bg-surface-container-highest transition-colors disabled:opacity-40 shrink-0"
                      >
                        <span className={`material-symbols-outlined text-[16px] ${asaasChecking ? 'animate-spin' : ''}`}>
                          refresh
                        </span>
                        {asaasChecking ? 'Verificando...' : 'Verificar aprovação'}
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="bg-surface-container border border-outline-variant rounded-xl p-4 self-start space-y-3">
              <div>
                <p className="text-[10px] font-mono text-on-surface-variant uppercase tracking-widest mb-1.5">Métodos habilitados</p>
                <h3 className="text-base font-semibold text-on-surface flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full shrink-0 ${digitalActive || digitalPending ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`} />
                  {digitalActive || digitalPending ? 'Digital + Dinheiro' : 'Só dinheiro'}
                </h3>
              </div>
              <div className="pt-3 border-t border-outline-variant space-y-2">
                {[
                  { icon: 'qr_code_2', label: 'PIX', ok: digitalActive || digitalPending },
                  { icon: 'contactless', label: 'Crédito / Débito', ok: digitalActive || digitalPending },
                  { icon: 'payments', label: 'Dinheiro (manual)', ok: true },
                ].map(m => (
                  <div key={m.label} className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2 text-on-surface-variant font-mono">
                      <span className="material-symbols-outlined text-[16px]">{m.icon}</span>
                      {m.label}
                    </span>
                    <span className={`text-[10px] font-mono uppercase ${m.ok ? 'text-emerald-400' : 'text-on-surface-variant opacity-50'}`}>
                      {m.ok ? 'Ativo' : 'Cadastre a conta'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Resumo do dia + pendências */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-card-gap">
            <div className="bg-surface-container border border-outline-variant rounded-xl p-6 flex flex-col">
              <div className="flex justify-between items-start mb-6">
                <div className="p-3 rounded-lg bg-primary/10">
                  <span className="material-symbols-outlined text-[22px] text-primary" style={{ fontVariationSettings: "'FILL' 1" }}>
                    account_balance_wallet
                  </span>
                </div>
                <div className="text-right">
                  <p className="text-[10px] font-mono text-on-surface-variant uppercase tracking-widest">Hoje</p>
                  <p className="text-sm font-mono text-primary">{new Date().toLocaleDateString('pt-BR')}</p>
                </div>
              </div>
              <div className="flex-1">
                <span className="text-xs font-mono text-on-surface-variant">Recebido hoje (confirmados)</span>
                <h3 className="text-3xl font-bold text-on-surface mt-1" style={{ fontFamily: 'Geist, sans-serif' }}>
                  {paymentsLoading ? '…' : formatCurrency(paymentStats.todayTotal)}
                </h3>
              </div>
              <div className="mt-4 flex items-center gap-2 text-xs font-mono px-3 py-2 rounded-lg w-fit bg-surface-container-high text-on-surface-variant border border-outline-variant">
                <span className="material-symbols-outlined text-[14px]">receipt_long</span>
                {paymentsLoading ? '…' : `${paymentStats.todayCount} pagamento${paymentStats.todayCount !== 1 ? 's' : ''} hoje`}
              </div>
            </div>

            <div className="bg-surface-container border border-outline-variant rounded-xl p-6 flex flex-col justify-between">
              <div className="flex justify-between items-start">
                <div className="p-3 rounded-lg bg-surface-container-highest">
                  <span className="material-symbols-outlined text-[22px] text-on-surface">hourglass_top</span>
                </div>
              </div>
              <div className="mt-6">
                <p className="text-[10px] font-mono text-on-surface-variant uppercase tracking-widest mb-2">Aguardando confirmação</p>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-on-surface-variant">Dinheiro na mesa</span>
                    <span className="text-lg font-bold font-mono text-amber-400">{paymentStats.pendingCash}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-on-surface-variant">PIX / cartão</span>
                    <span className="text-lg font-bold font-mono text-on-surface">{paymentStats.pendingDigital}</span>
                  </div>
                </div>
              </div>
              <p className="mt-4 text-[10px] font-mono text-on-surface-variant leading-relaxed">
                Confirme pagamentos em dinheiro no mapa de mesas ou em Pedidos · Mesa.
              </p>
            </div>
          </div>

          {/* Transactions */}
          <div className="bg-surface-container border border-outline-variant rounded-xl overflow-hidden">
            <div className="px-6 py-5 border-b border-outline-variant flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h2 className="text-base font-semibold text-on-surface">Histórico de Transações</h2>
                <p className="text-sm text-on-surface-variant">Pagamentos registrados no Qomanda (últimos 100).</p>
              </div>
              <div className="flex items-center gap-3">
                <div className="relative">
                  <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-[18px]">search</span>
                  <input
                    value={txSearch}
                    onChange={e => setTxSearch(e.target.value)}
                    className="h-9 pl-9 pr-4 rounded-lg text-sm outline-none w-44 bg-surface-container-low border border-outline-variant text-on-surface focus:border-primary transition-colors"
                    placeholder="Buscar..."
                  />
                </div>
                <button
                  type="button"
                  onClick={exportPaymentsCsv}
                  className="flex items-center gap-2 h-9 px-4 rounded-lg text-sm font-mono bg-surface-container-high border border-outline-variant text-on-surface hover:bg-surface-container-highest transition-colors"
                >
                  <span className="material-symbols-outlined text-[16px]">download</span>
                  CSV
                </button>
              </div>
            </div>
            <div className="overflow-x-auto">
              {paymentsLoading ? (
                <div className="py-16 text-center text-sm font-mono text-on-surface-variant">Carregando transações...</div>
              ) : displayTransactions.length === 0 ? (
                <div className="py-16 text-center">
                  <span className="material-symbols-outlined text-[40px] text-on-surface-variant opacity-30 mb-2 block">payments</span>
                  <p className="text-sm font-mono text-on-surface-variant">Nenhum pagamento registrado ainda.</p>
                </div>
              ) : (
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-surface-container-low">
                    {['Data', 'Referência', 'Cliente', 'Valor', 'Status', 'Método'].map((h) => (
                      <th key={h} className="px-6 py-3 text-[10px] font-mono uppercase tracking-widest text-on-surface-variant">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant/30">
                  {displayTransactions.map(tx => {
                    const statusMeta = PAYMENT_STATUS_LABEL[tx.status] ?? PAYMENT_STATUS_LABEL.pending
                    return (
                    <tr key={tx.id} className="group hover:bg-surface-container-high transition-colors">
                      <td className="px-6 py-4">
                        <div className="text-sm text-on-surface">{tx.date}</div>
                        <div className="text-xs text-on-surface-variant">{tx.time}</div>
                      </td>
                      <td className="px-6 py-4 text-sm font-mono text-primary">#{tx.id.slice(-8).toUpperCase()}</td>
                      <td className="px-6 py-4 text-sm text-on-surface-variant">
                        {tx.customerName}
                      </td>
                      <td className="px-6 py-4 text-right text-lg font-semibold text-on-surface">
                        {formatCurrency(tx.amount)}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-mono border ${statusMeta.className}`}>
                          {statusMeta.label}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2 text-sm font-mono text-on-surface-variant">
                          <span className="material-symbols-outlined text-[16px]">
                            {paymentMethodIcon(tx.method)}
                          </span>
                          {tx.label}
                        </div>
                      </td>
                    </tr>
                    )
                  })}
                </tbody>
              </table>
              )}
            </div>
            {!paymentsLoading && displayTransactions.length > 0 && (
            <div className="px-6 py-4 bg-surface-container-low">
              <p className="text-xs font-mono text-on-surface-variant">
                Mostrando {displayTransactions.length} transação{displayTransactions.length !== 1 ? 'ões' : ''}
                {txSearch.trim() ? ' (filtradas)' : ''}
              </p>
            </div>
            )}
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
                  Envie automaticamente a NF-e emitida pelo restaurante para o WhatsApp do cliente após cada pagamento.
                </p>
              </div>
              <span className={`text-[10px] font-mono px-2 py-1 rounded border ${
                wpIntegration?.status === 'auto_send'
                  ? 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10'
                  : wpIntegration?.status === 'connected'
                    ? 'text-blue-400 border-blue-500/30 bg-blue-500/10'
                    : 'text-amber-400 border-amber-500/30 bg-amber-500/10'
              }`}>
                {wpLoading ? '…' : (wpIntegration?.statusLabel ?? 'PENDENTE').toUpperCase()}
              </span>
            </div>

            <div className="px-6 py-5 space-y-4">
              {wpLoading ? (
                <p className="text-sm text-on-surface-variant">Carregando integração…</p>
              ) : (
              <>
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
                    placeholder={wpIntegration?.hasToken ? `Salvo (${wpIntegration.tokenMasked ?? '••••'}) — deixe vazio para manter` : 'EAAxxxxxxxxxxxxx...'}
                    className="h-10 px-3 rounded-lg text-sm font-mono outline-none bg-surface-dim border border-outline-variant text-on-surface focus:border-primary transition-colors"
                  />
                  <p className="text-[10px] text-on-surface-variant opacity-60">
                    Token permanente do sistema (não o temporário de 24h)
                  </p>
                </div>
              </div>

              <div className="flex flex-col gap-1.5 max-w-sm">
                <label className="text-[10px] font-mono uppercase tracking-wider text-on-surface-variant">
                  Número para teste (opcional)
                </label>
                <input
                  value={wpTestPhone} onChange={e => setWpTestPhone(e.target.value)}
                  placeholder="Usa telefone comercial se vazio"
                  inputMode="tel"
                  className="h-10 px-3 rounded-lg text-sm font-mono outline-none bg-surface-dim border border-outline-variant text-on-surface focus:border-primary transition-colors"
                />
              </div>

              {/* Toggle NF-e automática */}
              <div className="flex items-center justify-between p-4 rounded-xl bg-surface-container-low border border-outline-variant">
                <div>
                  <p className="text-sm font-semibold text-on-surface">Enviar NF-e automaticamente após pagamento</p>
                  <p className="text-xs text-on-surface-variant mt-0.5">
                    O cliente recebe a nota fiscal no WhatsApp assim que o pagamento for confirmado
                  </p>
                </div>
                <button type="button" onClick={() => setWpNfeEnabled(v => !v)}
                  className="relative w-11 h-6 rounded-full transition-colors shrink-0 ml-4"
                  style={{ background: wpNfeEnabled ? '#f97316' : '#2d3449' }}>
                  <span className="absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all"
                    style={{ left: wpNfeEnabled ? '1.375rem' : '0.125rem' }} />
                </button>
              </div>

              <div className="flex gap-3 flex-wrap">
                <button type="button" onClick={saveWhatsApp} disabled={wpSaving || !wpPhoneId || (!wpToken && !wpIntegration?.hasToken)}
                  className="h-10 px-6 rounded-lg text-sm font-mono font-bold bg-primary-container text-on-primary-container hover:opacity-90 transition-opacity active:scale-95 disabled:opacity-40">
                  {wpSaving ? 'Salvando...' : 'Salvar configuração'}
                </button>
                <button type="button" onClick={testWhatsApp} disabled={wpTesting || !wpPhoneId || (!wpToken && !wpIntegration?.hasToken)}
                  className="h-10 px-5 rounded-lg text-sm font-mono border border-outline-variant text-on-surface-variant hover:bg-surface-container-highest transition-colors disabled:opacity-40">
                  {wpTesting ? 'Enviando...' : '📱 Enviar mensagem de teste'}
                </button>
              </div>
              </>
              )}
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
