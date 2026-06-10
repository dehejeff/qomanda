'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { QomandaLogo } from '@/components/qomanda-logo'

const C = {
  bg: '#0b1326', bgCard: '#131b2e', bgCard2: '#1e293b',
  border: 'rgba(88,66,55,0.35)', borderBlu: 'rgba(51,65,85,0.6)',
  primary: '#f97316', text: '#dae2fd', muted: '#a78b7d', faint: '#584237',
  green: '#34d399', amber: '#fbbf24', red: '#f87171', blue: '#7bd0ff',
}
const mono = { fontFamily: 'JetBrains Mono, ui-monospace, monospace' }
const STORAGE_KEY = 'qomanda_pilotos_checklist_v2'

type CheckItem = { id: string; label: string; hint?: string; optional?: boolean }

const PLATFORM_ITEMS: CheckItem[] = [
  { id: 'plat-deploy', label: 'Deploy Vercel ligado ao repo (produção)' },
  { id: 'plat-app-url', label: 'NEXT_PUBLIC_APP_URL apontando para a URL de produção' },
  { id: 'plat-env', label: 'Variáveis de ambiente em Production', hint: 'Supabase, CPF_ENCRYPTION_KEY, CPF_HASH_SALT, CRON_SECRET, PLATFORM_SECRETS_KEY, QOMANDA_STAFF_EMAILS, NEXT_PUBLIC_DEV_BYPASS=false' },
  { id: 'plat-crons', label: 'Crons ativos no painel Vercel', hint: 'process-jobs, monthly-billing, billing-reminders, financial-retention' },
  { id: 'plat-mig-core', label: 'Migrações Supabase — núcleo operacional', hint: 'call-waiter, async-jobs, realtime-notifications, realtime-close-requests, webhook-events, service-nfe, billing-reminders, performance-indexes' },
  { id: 'plat-mig-fila', label: 'Migrações fila (se usar reserva de grupo / WhatsApp na fila)', hint: 'waitlist-allocations → waitlist-notify-contacts', optional: true },
  { id: 'plat-billing', label: 'Cobrança Qomanda configurada', hint: 'ASAAS_API_KEY master + webhook /api/asaas/webhook + RESEND_API_KEY para e-mails', optional: true },
  { id: 'plat-smokes', label: 'Smokes automatizados passando', hint: 'npm run smoke:garcom + scripts/smoke/internal-health.mjs' },
  { id: 'plat-load', label: 'Teste de carga baseline', hint: 'npm run load:10x20 (ou contra staging)', optional: true },
  { id: 'plat-health', label: 'Painel /internal/health em 🟢 antes do 1º go-live' },
  { id: 'plat-sentry', label: 'Sentry com DSN + alerta de 5xx', optional: true },
  { id: 'plat-backup', label: 'Backups / PITR + alertas CPU/conexões no Supabase', optional: true },
]

const RESTAURANT_ITEMS: CheckItem[] = [
  { id: 'r-data', label: 'Dados comerciais completos no portal interno', hint: 'CNPJ/CPF, endereço, contato, plano/trial, slug conferido (/<slug>)' },
  { id: 'r-model', label: 'Modelo operacional definido', hint: 'salão · balcão · salão+balcão · food hall — também em Settings → Pagamentos' },
  { id: 'r-menu', label: 'Cardápio montado (categorias + itens + preços + fotos)' },
  { id: 'r-tables', label: 'Mesas + seções (se salão) + QR impresso — ou link /balcao testado' },
  { id: 'r-pay', label: 'Recebimento configurado em Settings → Pagamentos', hint: 'Piloto: PIX manual + dinheiro (recomendado)' },
  { id: 'r-team', label: 'Equipe com senha: garçom + cozinha (+ caixa se usar /dashboard/caixa)', hint: '/garcom e /cozinha no celular/tablet' },
  { id: 'r-kds', label: 'Cozinha (/cozinha) aberta em tablet ou tela fixa' },
  { id: 'r-overview', label: 'Checklist "Primeiros passos" do Overview em 100%' },
  { id: 'r-training', label: 'Treinamento de 15 min com dono + equipe', hint: 'pedido, pagamento, fechar mesa, Chamar Garçom' },
  { id: 'r-smoke', label: 'Teste manual ponta a ponta', hint: 'check-in → pedido → cozinha → pagamento → fechar conta' },
  { id: 'r-go', label: 'Go-live — primeira noite real com equipe avisada' },
  { id: 'r-nfe', label: 'NF-e Focus NFe (se o cliente emitir nota)', optional: true },
  { id: 'r-whatsapp', label: 'WhatsApp Business em Integrações (se enviar NF/recibo por zap)', optional: true },
  { id: 'r-fidelity', label: 'Regras de fidelidade (se usar programa de visitas)', optional: true },
  { id: 'r-recepcionista', label: 'Recepcionista na equipe (se usar fila de espera)', optional: true },
]

const PILOT_WAVES = [
  { id: 'p1', wave: 'Semana 1', title: 'Piloto #1', subtitle: 'Validar fluxo completo numa casa só' },
  { id: 'p2', wave: 'Semana 2–3', title: 'Piloto #2', subtitle: 'Repetir playbook; modelo simples (salão ou balcão)' },
  { id: 'p3', wave: 'Semana 2–3', title: 'Piloto #3', subtitle: 'Mesmo ritmo do #2' },
  { id: 'p4', wave: 'Semana 4', title: 'Piloto #4', subtitle: 'Escala controlada' },
  { id: 'p5', wave: 'Semana 4', title: 'Piloto #5', subtitle: 'Fila/NF-e só se migrações já rodaram' },
]

const DEFER_ITEMS = [
  'Fila de espera com WhatsApp (após migrações allocations + notify-contacts)',
  'NF-e real Focus NFe (hoje simulado)',
  'Mercado Pago OAuth (token manual basta no piloto)',
  'Domínio qomanda.app (Vercel .vercel.app serve)',
]

type State = {
  platform: Record<string, boolean>
  restaurants: Record<string, { name: string; checks: Record<string, boolean> }>
}

function defaultState(): State {
  const restaurants: State['restaurants'] = {}
  for (const p of PILOT_WAVES) {
    restaurants[p.id] = { name: '', checks: {} }
  }
  return { platform: {}, restaurants }
}

function loadState(): State {
  if (typeof window === 'undefined') return defaultState()
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return defaultState()
    const parsed = JSON.parse(raw) as State
    const base = defaultState()
    return {
      platform: { ...base.platform, ...parsed.platform },
      restaurants: Object.fromEntries(
        Object.keys(base.restaurants).map(id => [
          id,
          {
            name: parsed.restaurants?.[id]?.name ?? '',
            checks: { ...base.restaurants[id].checks, ...parsed.restaurants?.[id]?.checks },
          },
        ]),
      ),
    }
  } catch {
    return defaultState()
  }
}

function CheckRow({
  item, checked, onToggle,
}: { item: CheckItem; checked: boolean; onToggle: () => void }) {
  return (
    <label
      className="flex items-start gap-3 rounded-lg px-3 py-2.5 cursor-pointer transition-colors hover:bg-white/[0.03]"
      style={{ border: `1px solid ${checked ? 'rgba(52,211,153,0.25)' : C.borderBlu}` }}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={onToggle}
        className="mt-1 h-4 w-4 shrink-0 accent-[#f97316]"
      />
      <div className="min-w-0">
        <span className="text-sm block" style={{ color: checked ? C.green : C.text }}>
          {item.label}
          {item.optional && (
            <span className="ml-2 text-[10px] font-mono uppercase" style={{ color: C.faint }}>opcional</span>
          )}
        </span>
        {item.hint && (
          <span className="text-[11px] mt-0.5 block leading-relaxed" style={{ color: C.muted }}>{item.hint}</span>
        )}
      </div>
    </label>
  )
}

export function PilotosChecklist() {
  const [state, setState] = useState<State>(defaultState)
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    setState(loadState())
    setHydrated(true)
  }, [])

  useEffect(() => {
    if (!hydrated) return
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  }, [state, hydrated])

  const togglePlatform = useCallback((id: string) => {
    setState(s => ({ ...s, platform: { ...s.platform, [id]: !s.platform[id] } }))
  }, [])

  const setRestaurantName = useCallback((pid: string, name: string) => {
    setState(s => ({
      ...s,
      restaurants: { ...s.restaurants, [pid]: { ...s.restaurants[pid], name } },
    }))
  }, [])

  const toggleRestaurant = useCallback((pid: string, itemId: string) => {
    setState(s => {
      const r = s.restaurants[pid]
      return {
        ...s,
        restaurants: {
          ...s.restaurants,
          [pid]: { ...r, checks: { ...r.checks, [itemId]: !r.checks[itemId] } },
        },
      }
    })
  }, [])

  const resetAll = () => {
    if (!window.confirm('Limpar todo o progresso salvo neste navegador?')) return
    localStorage.removeItem(STORAGE_KEY)
    setState(defaultState())
  }

  const platformDone = PLATFORM_ITEMS.filter(i => state.platform[i.id]).length
  const platformTotal = PLATFORM_ITEMS.length

  function restaurantProgress(pid: string) {
    const checks = state.restaurants[pid]?.checks ?? {}
    const done = RESTAURANT_ITEMS.filter(i => checks[i.id]).length
    return { done, total: RESTAURANT_ITEMS.length }
  }

  const allRestaurantDone = PILOT_WAVES.reduce((s, p) => s + restaurantProgress(p.id).done, 0)
  const allRestaurantTotal = PILOT_WAVES.length * RESTAURANT_ITEMS.length

  return (
    <div className="min-h-screen" style={{ background: C.bg, color: C.text, ...mono }}>
      {/* Header */}
      <header className="sticky top-0 z-40 px-6 py-4 flex items-center justify-between backdrop-blur-md"
        style={{ background: 'rgba(11,19,38,0.92)', borderBottom: `1px solid ${C.border}` }}>
        <Link href="/" className="flex items-center gap-2 hover:opacity-90 transition-opacity">
          <QomandaLogo className="h-7 w-auto" />
        </Link>
        <div className="flex items-center gap-3 text-xs" style={{ color: C.muted }}>
          <Link href="/roadmap" className="hover:text-[#dae2fd] hidden sm:inline">Roadmap</Link>
          <button type="button" onClick={resetAll} className="hover:text-[#dae2fd]">Limpar progresso</button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-12">
        {/* Hero */}
        <div className="mb-12">
          <p className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: C.primary }}>
            Go-live · Piloto comercial
          </p>
          <h1 className="text-4xl md:text-5xl font-black mb-4" style={{ fontFamily: 'Geist, sans-serif', letterSpacing: '-0.03em' }}>
            5 primeiros restaurantes
          </h1>
          <p className="text-base leading-relaxed max-w-2xl" style={{ color: C.muted }}>
            Checklist operacional da equipe Qomanda. Marque conforme avança — o progresso fica salvo neste navegador.
            Comece com <strong style={{ color: C.text }}>1 casa na semana 1</strong>; só abra as próximas depois do smoke verde.
          </p>
        </div>

        {/* Progress summary */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-12">
          {[
            { label: 'Plataforma', done: platformDone, total: platformTotal, color: C.amber },
            { label: '5 restaurantes', done: allRestaurantDone, total: allRestaurantTotal, color: C.primary },
            { label: 'Meta', done: allRestaurantDone >= allRestaurantTotal && platformDone >= 5 ? 1 : 0, total: 1, color: C.green },
          ].map(({ label, done, total, color }) => (
            <div key={label} className="rounded-xl p-4" style={{ background: C.bgCard, border: `1px solid ${C.borderBlu}` }}>
              <p className="text-[10px] uppercase tracking-widest" style={{ color: C.muted }}>{label}</p>
              <p className="text-2xl font-black mt-1" style={{ color }}>{done}<span className="text-base font-normal" style={{ color: C.faint }}>/{total}</span></p>
            </div>
          ))}
        </div>

        {/* Timeline */}
        <div className="rounded-2xl p-6 mb-10" style={{ background: C.bgCard, border: `1px solid ${C.borderBlu}` }}>
          <h2 className="text-lg font-black mb-4" style={{ fontFamily: 'Geist, sans-serif' }}>Ritmo sugerido</h2>
          <div className="space-y-3">
            {[
              { w: 'Semana 1', t: '1 restaurante', d: 'Tasca ou similar — migrações + smoke + uma semana real' },
              { w: 'Semana 2–3', t: '+2 restaurantes', d: 'Salão ou balcão puro; PIX manual' },
              { w: 'Semana 4', t: '+2 restaurantes', d: 'Escala; fila só se migrações rodaram' },
            ].map(row => (
              <div key={row.w} className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4 text-sm">
                <span className="font-mono font-bold shrink-0 w-28" style={{ color: C.primary }}>{row.w}</span>
                <span className="font-semibold shrink-0" style={{ color: C.text }}>{row.t}</span>
                <span style={{ color: C.muted }}>{row.d}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Platform block */}
        <section className="mb-12">
          <div className="flex items-baseline justify-between gap-4 mb-4">
            <h2 className="text-xl font-black" style={{ fontFamily: 'Geist, sans-serif' }}>
              A · Plataforma <span className="text-sm font-normal" style={{ color: C.muted }}>(uma vez)</span>
            </h2>
            <span className="text-xs font-mono" style={{ color: C.amber }}>{platformDone}/{platformTotal}</span>
          </div>
          <p className="text-sm mb-4" style={{ color: C.muted }}>
            Antes do piloto #1. Detalhes em <code className="text-xs px-1 py-0.5 rounded" style={{ background: C.bgCard2 }}>docs/GO-LIVE-CHECKLIST.md</code>.
          </p>
          <div className="space-y-2">
            {PLATFORM_ITEMS.map(item => (
              <CheckRow
                key={item.id}
                item={item}
                checked={!!state.platform[item.id]}
                onToggle={() => togglePlatform(item.id)}
              />
            ))}
          </div>
        </section>

        {/* 5 restaurants */}
        <section className="mb-12">
          <h2 className="text-xl font-black mb-2" style={{ fontFamily: 'Geist, sans-serif' }}>
            B · Um checklist por restaurante
          </h2>
          <p className="text-sm mb-6" style={{ color: C.muted }}>
            Preencha o nome e marque cada etapa. Recomendação no piloto: <strong style={{ color: C.text }}>PIX manual + dinheiro</strong> (menos dependência de gateway).
          </p>
          <div className="space-y-6">
            {PILOT_WAVES.map((p, idx) => {
              const prog = restaurantProgress(p.id)
              const name = state.restaurants[p.id]?.name ?? ''
              return (
                <div key={p.id} className="rounded-2xl p-5 md:p-6" style={{ background: C.bgCard, border: `1px solid ${C.borderBlu}` }}>
                  <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
                    <div>
                      <p className="text-[10px] font-mono uppercase tracking-widest" style={{ color: C.primary }}>
                        {p.wave} · {p.title}
                      </p>
                      {p.subtitle && <p className="text-xs mt-1" style={{ color: C.faint }}>{p.subtitle}</p>}
                    </div>
                    <span className="text-xs font-mono px-2 py-1 rounded-lg" style={{ background: C.bgCard2, color: prog.done === prog.total ? C.green : C.muted }}>
                      {prog.done}/{prog.total}
                    </span>
                  </div>
                  <input
                    type="text"
                    value={name}
                    onChange={e => setRestaurantName(p.id, e.target.value)}
                    placeholder={`Nome do restaurante #${idx + 1} (ex.: Tasca do Porto)`}
                    className="w-full h-11 px-4 rounded-lg text-sm mb-4 outline-none"
                    style={{ background: C.bgCard2, border: `1px solid ${C.borderBlu}`, color: C.text, fontFamily: 'Geist, sans-serif' }}
                  />
                  <div className="space-y-2">
                    {RESTAURANT_ITEMS.map(item => (
                      <CheckRow
                        key={item.id}
                        item={item}
                        checked={!!state.restaurants[p.id]?.checks[item.id]}
                        onToggle={() => toggleRestaurant(p.id, item.id)}
                      />
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        </section>

        {/* Smoke manual */}
        <section className="mb-12 rounded-2xl p-6" style={{ background: C.bgCard2, border: `1px solid ${C.borderBlu}` }}>
          <h2 className="text-lg font-black mb-3" style={{ fontFamily: 'Geist, sans-serif' }}>C · Smoke manual (por casa)</h2>
          <ol className="space-y-2 text-sm list-decimal list-inside" style={{ color: C.muted }}>
            <li>Dono faz login no dashboard · Overview em 100%</li>
            <li>Cliente escaneia QR (mesa) ou abre <code className="text-xs">/{'{slug}'}/balcao</code></li>
            <li>Pedido no celular → cozinha (<code className="text-xs">/cozinha</code>) → garçom marca entregue</li>
            <li>Chamar Garçom: cliente toca no app · sino no dashboard + banner no garçom</li>
            <li>Pagamento PIX manual ou dinheiro confirmado (<code className="text-xs">/garcom/pagamentos</code> ou caixa)</li>
            <li>Conta fecha · mesa libera no mapa</li>
            <li><code className="text-xs">/internal/health</code> continua 🟢</li>
          </ol>
        </section>

        {/* Defer */}
        <section className="mb-12 rounded-2xl p-6" style={{ background: C.bgCard, border: `1px dashed ${C.border}` }}>
          <h2 className="text-lg font-black mb-3" style={{ fontFamily: 'Geist, sans-serif' }}>Pode esperar no piloto</h2>
          <ul className="space-y-2">
            {DEFER_ITEMS.map(t => (
              <li key={t} className="flex items-start gap-2 text-sm" style={{ color: C.muted }}>
                <span className="material-symbols-outlined text-[16px] shrink-0 mt-0.5" style={{ color: C.faint }}>schedule</span>
                {t}
              </li>
            ))}
          </ul>
        </section>

        {/* CTA */}
        <div className="text-center rounded-2xl p-8" style={{ background: C.bgCard, border: `1px solid ${C.borderBlu}` }}>
          <p className="text-sm mb-4" style={{ color: C.muted }}>
            Cadastrar novo piloto no portal interno
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link href="/internal/clients/new"
              className="px-6 py-3 rounded-xl font-bold text-sm"
              style={{ background: C.primary, color: '#582200' }}>
              Novo cliente · /internal
            </Link>
            <Link href="/internal/health"
              className="px-6 py-3 rounded-xl font-bold text-sm border"
              style={{ borderColor: C.border, color: C.text }}>
              Saúde do sistema
            </Link>
          </div>
        </div>
      </main>

      <footer className="py-8 px-6 text-center" style={{ borderTop: `1px solid ${C.border}` }}>
        <div className="flex flex-wrap items-center justify-center gap-4 text-xs mb-3" style={{ color: C.faint }}>
          <Link href="/roadmap" className="hover:opacity-80">Roadmap</Link>
          <Link href="/termos" className="hover:opacity-80">Termos</Link>
          <Link href="/privacidade" className="hover:opacity-80">Privacidade</Link>
        </div>
        <p className="text-xs" style={{ color: C.faint }}>© 2026 Qomanda · Uso interno · equipe piloto</p>
      </footer>
    </div>
  )
}
