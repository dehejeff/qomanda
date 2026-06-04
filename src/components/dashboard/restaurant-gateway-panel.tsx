'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { toast } from 'sonner'
import { MANUAL_PIX_KEY_TYPE_LABELS, type ManualPixKeyType } from '@/lib/restaurant-payment-config'

type GatewayState = {
  provider: string | null
  environment: string
  connected: boolean
  apiKeyMasked: string | null
  manualPixKey: string | null
  manualPixKeyType: ManualPixKeyType | null
  manualPaymentHolderName: string | null
  manualPaymentNotes: string | null
  manualConfigured: boolean
  mpConnectedVia: 'oauth' | 'manual' | null
  mpUserId: string | null
}

type GatewayProvider = 'manual' | 'asaas' | 'mercado_pago'

export function RestaurantGatewayPanel() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [loading, setLoading] = useState(true)
  const [gateway, setGateway] = useState<GatewayState | null>(null)
  const [operationalMode, setOperationalMode] = useState('both')
  const [provider, setProvider] = useState<GatewayProvider>('asaas')
  const [apiKey, setApiKey] = useState('')
  const [environment, setEnvironment] = useState<'sandbox' | 'production'>('sandbox')
  const [manualPixKey, setManualPixKey] = useState('')
  const [manualPixKeyType, setManualPixKeyType] = useState<ManualPixKeyType>('random')
  const [manualHolderName, setManualHolderName] = useState('')
  const [manualNotes, setManualNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [mpOAuthAvailable, setMpOAuthAvailable] = useState(false)
  const [showManualToken, setShowManualToken] = useState(false)

  async function load() {
    const res = await fetch('/api/dashboard/gateway')
    const data = await res.json()
    if (res.ok) {
      setGateway(data.gateway)
      setOperationalMode(data.operationalMode ?? 'both')
      setEnvironment(data.gateway?.environment ?? 'sandbox')
      setMpOAuthAvailable(Boolean(data.mpOAuthAvailable))
      const p = data.gateway?.provider
      setProvider(p === 'manual' || p === 'mercado_pago' ? p : 'asaas')
      setManualPixKey(data.gateway?.manualPixKey ?? '')
      setManualPixKeyType(data.gateway?.manualPixKeyType ?? 'random')
      setManualHolderName(data.gateway?.manualPaymentHolderName ?? '')
      setManualNotes(data.gateway?.manualPaymentNotes ?? '')
    }
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  // Feedback do retorno do OAuth Mercado Pago (?mp=connected|error)
  useEffect(() => {
    const mp = searchParams.get('mp')
    if (!mp) return
    if (mp === 'connected') toast.success('Mercado Pago conectado!')
    else if (mp === 'error') toast.error(searchParams.get('mp_msg') ?? 'Falha ao conectar o Mercado Pago.')
    const url = new URL(window.location.href)
    url.searchParams.delete('mp'); url.searchParams.delete('mp_msg')
    window.history.replaceState(null, '', url.toString())
  }, [searchParams])

  async function disconnectMercadoPago() {
    if (!confirm('Desconectar o Mercado Pago? Os pagamentos digitais ficarão indisponíveis até reconectar.')) return
    setSaving(true)
    const res = await fetch('/api/dashboard/gateway', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ disconnectMercadoPago: true }),
    })
    setSaving(false)
    if (!res.ok) { toast.error('Erro ao desconectar.'); return }
    toast.success('Mercado Pago desconectado.')
    await load()
    router.refresh()
  }

  async function save(test = false) {
    setSaving(true)
    const res = await fetch('/api/dashboard/gateway', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        provider,
        apiKey: provider !== 'manual' ? (apiKey || undefined) : undefined,
        environment,
        operationalMode,
        testConnection: test,
        manualPixKey: provider === 'manual' ? manualPixKey : undefined,
        manualPixKeyType: provider === 'manual' ? manualPixKeyType : undefined,
        manualPaymentHolderName: provider === 'manual' ? manualHolderName : undefined,
        manualPaymentNotes: provider === 'manual' ? manualNotes : undefined,
      }),
    })
    const data = await res.json()
    setSaving(false)
    if (!res.ok) {
      toast.error(data.error ?? 'Erro ao salvar.')
      return
    }
    if (test) {
      if (provider === 'mercado_pago') {
        toast.success(`Conexão OK · conta ${data.nickname ?? 'Mercado Pago'}`)
      } else {
        toast.success(`Conexão OK · saldo R$ ${Number(data.balance ?? 0).toFixed(2)}`)
      }
    } else {
      toast.success('Configurações salvas.')
    }
    setApiKey('')
    await load()
    router.refresh()
  }

  if (loading) return <p className="text-sm text-on-surface-variant font-mono">Carregando gateway…</p>

  const digitalProvider = provider === 'manual' ? null : provider

  return (
    <section className="bg-surface-container border border-outline-variant rounded-xl p-6 space-y-4">
      <div>
        <p className="text-[10px] font-mono uppercase tracking-widest text-on-surface-variant">Gateway do restaurante</p>
        <h3 className="text-lg font-bold text-on-surface mt-1">Pagamentos caem 100% na sua conta</h3>
        <p className="text-sm text-on-surface-variant mt-1">
          PIX manual, Asaas ou Mercado Pago — escolha onde receber PIX e cartão.
          A Qomanda cobra mensalidade + comissão progressiva na fatura mensal (dia 5).{' '}
          <a href="/dashboard/settings?tab=mensalidade" className="text-primary hover:underline font-mono text-xs">
            Ver mensalidade →
          </a>
        </p>
      </div>

      <div>
        <label className="text-xs font-mono text-on-surface-variant">Modo operacional</label>
        <select
          value={operationalMode}
          onChange={e => setOperationalMode(e.target.value)}
          className="mt-1 w-full px-3 py-2 rounded-lg bg-surface-dim border border-outline-variant text-sm"
        >
          <option value="both">Salão + balcão</option>
          <option value="dine_in">Apenas salão (mesas)</option>
          <option value="counter">Apenas balcão</option>
        </select>
      </div>

      <div>
        <label className="text-xs font-mono text-on-surface-variant">Forma de recebimento digital</label>
        <div className="mt-2 grid grid-cols-1 sm:grid-cols-3 gap-2">
          <button
            type="button"
            onClick={() => setProvider('manual')}
            className={`px-4 py-3 rounded-lg border text-left text-sm transition-colors ${
              provider === 'manual'
                ? 'border-primary bg-primary/10 text-on-surface'
                : 'border-outline-variant text-on-surface-variant'
            }`}
          >
            <span className="font-semibold block">PIX manual</span>
            <span className="text-xs opacity-80">Transferência para sua chave PIX</span>
          </button>
          <button
            type="button"
            onClick={() => setProvider('asaas')}
            className={`px-4 py-3 rounded-lg border text-left text-sm transition-colors ${
              provider === 'asaas'
                ? 'border-primary bg-primary/10 text-on-surface'
                : 'border-outline-variant text-on-surface-variant'
            }`}
          >
            <span className="font-semibold block">Asaas</span>
            <span className="text-xs opacity-80">PIX e cartão na conta Asaas</span>
          </button>
          <button
            type="button"
            onClick={() => setProvider('mercado_pago')}
            className={`px-4 py-3 rounded-lg border text-left text-sm transition-colors ${
              provider === 'mercado_pago'
                ? 'border-primary bg-primary/10 text-on-surface'
                : 'border-outline-variant text-on-surface-variant'
            }`}
          >
            <span className="font-semibold block">Mercado Pago</span>
            <span className="text-xs opacity-80">PIX e cartão na conta MP</span>
          </button>
        </div>
      </div>

      {provider === 'manual' ? (
        <div className="space-y-4 rounded-lg border border-outline-variant p-4 bg-surface-dim/50">
          <p className="text-xs text-on-surface-variant">
            O cliente vê sua chave PIX no checkout, faz a transferência e aguarda sua confirmação.
            Dinheiro na mesa continua disponível sem comissão.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-mono text-on-surface-variant">Tipo da chave PIX</label>
              <select
                value={manualPixKeyType}
                onChange={e => setManualPixKeyType(e.target.value as ManualPixKeyType)}
                className="mt-1 w-full px-3 py-2 rounded-lg bg-surface-dim border border-outline-variant text-sm"
              >
                {(Object.entries(MANUAL_PIX_KEY_TYPE_LABELS) as [ManualPixKeyType, string][]).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-mono text-on-surface-variant">Nome do titular (exibido ao cliente)</label>
              <input
                type="text"
                value={manualHolderName}
                onChange={e => setManualHolderName(e.target.value)}
                placeholder="Restaurante Tasca do Porto"
                className="mt-1 w-full px-3 py-2 rounded-lg bg-surface-dim border border-outline-variant text-sm"
              />
            </div>
          </div>
          <div>
            <label className="text-xs font-mono text-on-surface-variant">Chave PIX *</label>
            <input
              type="text"
              value={manualPixKey}
              onChange={e => setManualPixKey(e.target.value)}
              placeholder="CNPJ, e-mail, telefone ou chave aleatória"
              className="mt-1 w-full px-3 py-2 rounded-lg bg-surface-dim border border-outline-variant text-sm font-mono"
            />
          </div>
          <div>
            <label className="text-xs font-mono text-on-surface-variant">Instruções extras (opcional)</label>
            <textarea
              value={manualNotes}
              onChange={e => setManualNotes(e.target.value)}
              rows={2}
              placeholder="Ex.: Enviar comprovante no balcão · TED: Banco X, Ag 1234..."
              className="mt-1 w-full px-3 py-2 rounded-lg bg-surface-dim border border-outline-variant text-sm resize-none"
            />
          </div>
          <p className="text-[10px] font-mono text-on-surface-variant">
            Status: {gateway?.manualConfigured ? 'PIX manual configurado' : 'Informe a chave PIX para ativar'}
          </p>
        </div>
      ) : provider === 'mercado_pago' ? (
        <div className="space-y-4 rounded-lg border border-outline-variant p-4 bg-surface-dim/50">
          {gateway?.connected ? (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-on-surface flex items-center gap-2">
                  <span className="material-symbols-outlined text-[18px] text-emerald-400">check_circle</span>
                  Mercado Pago conectado
                </p>
                <p className="text-xs text-on-surface-variant mt-1 font-mono">
                  {gateway.mpConnectedVia === 'oauth' ? 'Via OAuth' : 'Via token manual'}
                  {gateway.mpUserId ? ` · conta #${gateway.mpUserId}` : ''}
                  {gateway.apiKeyMasked ? ` · ${gateway.apiKeyMasked}` : ''}
                </p>
              </div>
              <button
                type="button"
                disabled={saving}
                onClick={disconnectMercadoPago}
                className="px-4 py-2 rounded-lg border border-red-500/30 text-red-400 hover:bg-red-500/10 text-sm font-mono disabled:opacity-50"
              >
                Desconectar
              </button>
            </div>
          ) : mpOAuthAvailable ? (
            <>
              <p className="text-sm text-on-surface-variant">
                Conecte sua conta Mercado Pago em um clique. Os pagamentos (PIX e cartão) caem direto na sua conta.
              </p>
              <a
                href="/api/dashboard/gateway/mercadopago/connect"
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold"
                style={{ background: '#009ee3', color: '#fff' }}
              >
                <span className="material-symbols-outlined text-[18px]">link</span>
                Conectar com Mercado Pago
              </a>
            </>
          ) : (
            <p className="text-xs text-on-surface-variant">
              Conexão em um clique indisponível (defina <code className="text-primary">MERCADO_PAGO_CLIENT_ID/SECRET</code>).
              Use o token manual abaixo.
            </p>
          )}

          {/* Fallback: token manual (sempre disponível) */}
          {!gateway?.connected && (
            <div className="pt-2 border-t border-outline-variant">
              <button
                type="button"
                onClick={() => setShowManualToken(v => !v)}
                className="text-xs font-mono text-primary hover:opacity-80"
              >
                {showManualToken ? '− Ocultar token manual' : '+ Inserir token manualmente'}
              </button>
              {showManualToken && (
                <div className="mt-3 space-y-3">
                  <div>
                    <label className="text-xs font-mono text-on-surface-variant">Ambiente</label>
                    <select
                      value={environment}
                      onChange={e => setEnvironment(e.target.value as 'sandbox' | 'production')}
                      className="mt-1 w-full px-3 py-2 rounded-lg bg-surface-dim border border-outline-variant text-sm"
                    >
                      <option value="sandbox">Sandbox / teste</option>
                      <option value="production">Produção</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-mono text-on-surface-variant">Access token Mercado Pago</label>
                    <input
                      type="password"
                      value={apiKey}
                      onChange={e => setApiKey(e.target.value)}
                      placeholder="APP_USR-... ou TEST-..."
                      className="mt-1 w-full px-3 py-2 rounded-lg bg-surface-dim border border-outline-variant text-sm font-mono"
                    />
                    <p className="text-[10px] font-mono text-on-surface-variant mt-2">
                      Gere em Mercado Pago → Suas integrações → Credenciais.
                      Webhook: <code className="text-primary">/api/mercadopago/webhook</code>
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-4 rounded-lg border border-outline-variant p-4 bg-surface-dim/50">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-mono text-on-surface-variant">Ambiente Asaas</label>
              <select
                value={environment}
                onChange={e => setEnvironment(e.target.value as 'sandbox' | 'production')}
                className="mt-1 w-full px-3 py-2 rounded-lg bg-surface-dim border border-outline-variant text-sm"
              >
                <option value="sandbox">Sandbox / teste</option>
                <option value="production">Produção</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-mono text-on-surface-variant">Status</label>
              <p className="mt-2 text-sm font-semibold text-on-surface">
                {gateway?.connected ? `Conectado ${gateway.apiKeyMasked ?? ''}` : 'Não conectado'}
              </p>
            </div>
          </div>
          <div>
            <label className="text-xs font-mono text-on-surface-variant">API key Asaas (conta do restaurante)</label>
            <input
              type="password"
              value={apiKey}
              onChange={e => setApiKey(e.target.value)}
              placeholder={gateway?.connected ? '•••• (deixe vazio para manter)' : '$aact_...'}
              className="mt-1 w-full px-3 py-2 rounded-lg bg-surface-dim border border-outline-variant text-sm font-mono"
            />
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <button type="button" disabled={saving} onClick={() => save(false)} className="px-4 py-2 rounded-lg bg-primary text-on-primary text-sm font-semibold">
          Salvar
        </button>
        {digitalProvider && (gateway?.connected || provider === 'asaas' || (provider === 'mercado_pago' && showManualToken)) && (
          <button type="button" disabled={saving} onClick={() => save(true)} className="px-4 py-2 rounded-lg border border-outline-variant text-sm">
            Testar conexão
          </button>
        )}
      </div>
    </section>
  )
}
