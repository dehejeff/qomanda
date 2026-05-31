'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'
import type { GatewayConfigDto } from '@/app/api/internal/gateway/route'

function brl(value: number) {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export default function InternalGatewayPage() {
  const [config, setConfig] = useState<GatewayConfigDto | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<{ balance: number; environment: string } | null>(null)

  const [environment, setEnvironment] = useState<'sandbox' | 'production'>('sandbox')
  const [apiKey, setApiKey] = useState('')
  const [webhookToken, setWebhookToken] = useState('')
  const [paymentBypass, setPaymentBypass] = useState(false)

  async function load() {
    const res = await fetch('/api/internal/gateway')
    const data = await res.json()
    if (!res.ok) throw new Error(data.error)
    const c = data.config as GatewayConfigDto
    setConfig(c)
    setEnvironment(c.environment)
    setPaymentBypass(c.paymentBypass)
    setApiKey('')
    setWebhookToken('')
  }

  useEffect(() => {
    load().catch(() => toast.error('Erro ao carregar gateway.')).finally(() => setLoading(false))
  }, [])

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    try {
      const res = await fetch('/api/internal/gateway', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          environment,
          paymentBypass,
          ...(apiKey.trim() ? { apiKey: apiKey.trim() } : {}),
          ...(webhookToken.trim() ? { webhookToken: webhookToken.trim() } : {}),
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setConfig(data.config)
      setApiKey('')
      setWebhookToken('')
      toast.success('Configuração salva.')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao salvar.')
    } finally {
      setSaving(false)
    }
  }

  async function handleTest() {
    setTesting(true)
    setTestResult(null)
    try {
      const res = await fetch('/api/internal/gateway', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'test' }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setTestResult({ balance: data.balance, environment: data.environment })
      toast.success('Conexão OK!')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Falha no teste.')
    } finally {
      setTesting(false)
    }
  }

  if (loading) return <p className="text-on-surface-variant">Carregando...</p>

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <p className="text-[10px] font-mono uppercase tracking-widest text-on-surface-variant mb-1">Infraestrutura</p>
        <h1 className="text-2xl font-black text-on-surface">Gateway Qomanda Pay</h1>
        <p className="text-sm text-on-surface-variant mt-1 leading-relaxed">
          Conta master Asaas da Qomanda — usada para PIX, cartão e split para os restaurantes.
          Restaurantes <strong>não</strong> veem estas configurações.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <StatusCard
          label="Status"
          value={config?.configured ? 'Configurado' : 'Pendente'}
          ok={config?.configured}
        />
        <StatusCard label="Ambiente" value={config?.environment === 'production' ? 'Produção' : 'Sandbox'} />
        <StatusCard
          label="Origem"
          value={config?.configSource === 'database' ? 'Portal interno' : config?.configSource === 'environment' ? 'Variáveis .env' : 'Não definido'}
        />
      </div>

      {config?.paymentBypass && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200/90">
          Modo teste ativo — pagamentos são confirmados localmente sem chamar o Asaas.
        </div>
      )}

      <form onSubmit={handleSave} className="bg-surface-container border border-outline-variant rounded-xl p-6 space-y-5">
        <section className="space-y-4">
          <p className="text-[10px] font-mono uppercase tracking-widest text-on-surface-variant">Credenciais</p>

          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-mono uppercase tracking-wider text-on-surface-variant">Ambiente</label>
            <div className="flex gap-2">
              {(['sandbox', 'production'] as const).map(env => (
                <button
                  key={env}
                  type="button"
                  onClick={() => setEnvironment(env)}
                  className={`px-4 py-2 rounded-lg text-xs font-mono border transition-colors ${
                    environment === env
                      ? 'bg-primary-container text-on-primary-container border-primary/30'
                      : 'border-outline-variant text-on-surface-variant'
                  }`}
                >
                  {env === 'sandbox' ? 'Sandbox (testes)' : 'Produção'}
                </button>
              ))}
            </div>
          </div>

          <Field
            label="API Key (conta master)"
            hint={config?.apiKeyMasked ? `Atual: ${config.apiKeyMasked}` : 'Obtenha em Asaas → Integrações → API'}
            value={apiKey}
            onChange={setApiKey}
            placeholder="$aact_..."
            mono
          />

          <Field
            label="Token do webhook"
            hint={config?.webhookTokenMasked ? `Atual: ${config.webhookTokenMasked}` : 'Header asaas-access-token nas notificações'}
            value={webhookToken}
            onChange={setWebhookToken}
            placeholder="Token secreto"
            mono
          />

          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={paymentBypass}
              onChange={e => setPaymentBypass(e.target.checked)}
              className="mt-1 accent-primary"
            />
            <span>
              <span className="text-sm text-on-surface block">Modo teste (bypass)</span>
              <span className="text-xs text-on-surface-variant">Confirma pagamentos sem gateway — só para desenvolvimento.</span>
            </span>
          </label>
        </section>

        <div className="flex flex-wrap gap-3 pt-2">
          <button
            type="submit"
            disabled={saving}
            className="h-10 px-6 rounded-lg text-sm font-mono font-bold bg-primary-container text-on-primary-container hover:opacity-90 disabled:opacity-50 flex items-center gap-2"
          >
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            Salvar
          </button>
          <button
            type="button"
            disabled={testing || !config?.configured}
            onClick={handleTest}
            className="h-10 px-5 rounded-lg text-sm font-mono border border-outline-variant text-on-surface-variant hover:text-on-surface disabled:opacity-50 flex items-center gap-2"
          >
            {testing && <Loader2 className="w-4 h-4 animate-spin" />}
            Testar conexão
          </button>
        </div>

        {testResult && (
          <p className="text-sm text-emerald-400 font-mono">
            Saldo disponível: {brl(testResult.balance)} ({testResult.environment})
          </p>
        )}
      </form>

      <div className="bg-surface-container border border-outline-variant rounded-xl p-6 space-y-4">
        <p className="text-[10px] font-mono uppercase tracking-widest text-on-surface-variant">Webhook</p>
        <p className="text-sm text-on-surface-variant leading-relaxed">
          Cole esta URL no painel Asaas → Configurações → Notificações (Webhook).
          Eventos recomendados: <code className="text-xs">PAYMENT_CONFIRMED</code>,{' '}
          <code className="text-xs">PAYMENT_RECEIVED</code>,{' '}
          <code className="text-xs">PAYMENT_OVERDUE</code>,{' '}
          <code className="text-xs">PAYMENT_REFUNDED</code>.
        </p>
        <div className="flex items-center gap-2">
          <code className="flex-1 text-xs font-mono bg-surface-dim border border-outline-variant rounded-lg px-3 py-2 text-on-surface break-all">
            {config?.webhookUrl}
          </code>
          <button
            type="button"
            onClick={() => {
              navigator.clipboard.writeText(config?.webhookUrl ?? '')
              toast.success('URL copiada.')
            }}
            className="shrink-0 h-9 px-3 rounded-lg text-xs font-mono border border-outline-variant text-on-surface-variant hover:text-on-surface"
          >
            Copiar
          </button>
        </div>
      </div>

      {config?.envHasApiKey && config.configSource === 'database' && (
        <p className="text-xs text-on-surface-variant">
          Há também <code className="text-[11px]">ASAAS_API_KEY</code> nas variáveis de ambiente da Vercel.
          O portal interno tem prioridade quando a API key está salva aqui.
        </p>
      )}
    </div>
  )
}

function StatusCard({ label, value, ok }: { label: string; value?: string; ok?: boolean }) {
  return (
    <div className="bg-surface-container border border-outline-variant rounded-xl p-4">
      <p className="text-[10px] font-mono uppercase text-on-surface-variant">{label}</p>
      <p className={`text-sm font-semibold mt-1 ${ok === true ? 'text-emerald-400' : ok === false ? 'text-amber-400' : 'text-on-surface'}`}>
        {value ?? '—'}
      </p>
    </div>
  )
}

function Field({
  label, hint, value, onChange, placeholder, mono,
}: {
  label: string; hint?: string | null; value: string; onChange: (v: string) => void; placeholder?: string; mono?: boolean
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-[10px] font-mono uppercase tracking-wider text-on-surface-variant">{label}</label>
      <input
        type="password"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete="off"
        className={`h-10 px-3 rounded-lg text-sm bg-surface-dim border border-outline-variant text-on-surface outline-none focus:border-primary ${mono ? 'font-mono' : ''}`}
      />
      {hint && <p className="text-[10px] text-on-surface-variant">{hint}</p>}
    </div>
  )
}
