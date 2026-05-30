'use client'

import Link from 'next/link'
import { useState } from 'react'
import { QomandaLogo } from '@/components/qomanda-logo'

// ── Design tokens (inline styles para não depender do Tailwind config) ──────
const C = {
  bg:        '#0b1326',
  bgCard:    '#131b2e',
  bgCard2:   '#1e293b',
  border:    'rgba(88,66,55,0.35)',
  borderBlu: 'rgba(51,65,85,0.6)',
  primary:   '#f97316',
  primaryDm: '#ffb690',
  text:      '#dae2fd',
  muted:     '#a78b7d',
  faint:     '#584237',
  green:     '#34d399',
  blue:      '#7bd0ff',
}

const font  = { fontFamily: 'Geist, system-ui, sans-serif' }
const mono  = { fontFamily: 'JetBrains Mono, monospace' }

function Tag({ children, color = C.primary }: { children: string; color?: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest px-3 py-1 rounded-full"
      style={{ ...mono, background: `${color}18`, color, border: `1px solid ${color}30` }}>
      {children}
    </span>
  )
}

function FeatureCard({ icon, title, desc }: { icon: string; title: string; desc: string }) {
  return (
    <div className="rounded-2xl p-6 flex flex-col gap-4 transition-all hover:scale-[1.02]"
      style={{ background: C.bgCard, border: `1px solid ${C.borderBlu}` }}>
      <div className="w-12 h-12 rounded-xl flex items-center justify-center"
        style={{ background: `${C.primary}15` }}>
        <span className="material-symbols-outlined text-[24px]" style={{ color: C.primary }}>{icon}</span>
      </div>
      <div>
        <h3 className="text-base font-bold mb-1" style={{ ...font, color: C.text }}>{title}</h3>
        <p className="text-sm leading-relaxed" style={{ color: C.muted }}>{desc}</p>
      </div>
    </div>
  )
}

function PricingCard({
  name, mesas, price, txFee, features, highlight = false,
}: {
  name: string; mesas: string; price: string | null; txFee: string; features: string[]; highlight?: boolean
}) {
  return (
    <div className="rounded-2xl p-7 flex flex-col gap-6 relative transition-all hover:scale-[1.01]"
      style={{
        background: highlight ? `linear-gradient(145deg, #1e3a2f, ${C.bgCard})` : C.bgCard,
        border: `2px solid ${highlight ? C.primary : C.borderBlu}`,
        boxShadow: highlight ? `0 0 40px rgba(249,115,22,0.12)` : 'none',
      }}>
      {highlight && (
        <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
          <span className="text-[10px] font-black uppercase tracking-widest px-4 py-1 rounded-full"
            style={{ ...mono, background: C.primary, color: '#582200' }}>
            Mais Popular
          </span>
        </div>
      )}
      <div>
        <p className="text-xs font-bold uppercase tracking-widest mb-1" style={{ ...mono, color: highlight ? C.primary : C.muted }}>{name}</p>
        <p className="text-sm mb-4" style={{ color: C.muted }}>até {mesas} mesas</p>
        {price ? (
          <div>
            <div className="flex items-end gap-1">
              <span className="text-[13px] font-bold" style={{ color: C.muted }}>R$</span>
              <span className="text-5xl font-black leading-none" style={{ ...font, color: C.text }}>{price}</span>
              <span className="text-sm mb-1" style={{ color: C.muted }}>/mês</span>
            </div>
            <p className="text-sm mt-2 font-semibold" style={{ color: highlight ? C.primary : C.blue }}>
              + {txFee} por transação
            </p>
          </div>
        ) : (
          <p className="text-3xl font-black" style={{ ...font, color: C.text }}>Sob consulta</p>
        )}
      </div>
      <ul className="space-y-2.5 flex-1">
        {features.map(f => (
          <li key={f} className="flex items-start gap-2.5 text-sm" style={{ color: C.text }}>
            <span className="material-symbols-outlined text-[16px] mt-0.5 shrink-0" style={{ color: C.green }}>check_circle</span>
            {f}
          </li>
        ))}
      </ul>
      <Link href="/dashboard/login"
        className="w-full py-3.5 rounded-xl text-sm font-bold text-center transition-all active:scale-95"
        style={{
          background: highlight ? C.primary : 'transparent',
          color: highlight ? '#582200' : C.primary,
          border: highlight ? 'none' : `1px solid ${C.primary}`,
        }}>
        Começar agora
      </Link>
    </div>
  )
}

const FAQS = [
  {
    q: 'Preciso de equipamento específico?',
    a: 'Não. A Qomanda funciona 100% via navegador. Seus clientes usam o próprio celular; você gerencia pelo computador ou tablet.',
  },
  {
    q: 'Como funciona a taxa de transação?',
    a: 'Cobramos uma pequena porcentagem apenas sobre pagamentos processados pelo Qomanda Pay (PIX, débito e crédito). Se o cliente pagar em dinheiro ou na máquina da casa, não há taxa.',
  },
  {
    q: 'Posso usar sem integrar o pagamento?',
    a: 'Sim. O cardápio digital e a gestão de pedidos funcionam de forma independente. Você ativa o Qomanda Pay quando quiser.',
  },
  {
    q: 'Quanto tempo leva para configurar?',
    a: 'Menos de 30 minutos. Você cadastra o restaurante, sobe o cardápio e imprime os QR Codes. Pronto.',
  },
  {
    q: 'Tem fidelidade automática?',
    a: 'Sim. O sistema conta as visitas de cada cliente (identificado pelo WhatsApp) e libera automaticamente os benefícios que você configurar.',
  },
  {
    q: 'Posso cancelar quando quiser?',
    a: 'Sim. Sem fidelidade mínima. Cancele a qualquer momento sem multa.',
  },
]

export default function LandingPage() {
  const [openFaq, setOpenFaq] = useState<number | null>(null)

  return (
    <div style={{ background: C.bg, color: C.text, ...font }} className="min-h-screen">

      {/* ── NAVBAR ──────────────────────────────────────────── */}
      <nav className="fixed top-0 left-0 right-0 z-50 flex justify-between items-center px-6 md:px-12 h-16"
        style={{ background: 'rgba(11,19,38,0.85)', borderBottom: `1px solid ${C.border}`, backdropFilter: 'blur(16px)' }}>
        <div className="flex items-center gap-2.5">
          <QomandaLogo size={30} />
          <span className="text-lg font-black" style={{ color: C.text, letterSpacing: '-0.02em' }}>Qomanda</span>
        </div>
        <div className="hidden md:flex items-center gap-8">
          {['Funcionalidades', 'Como funciona', 'Preços', 'FAQ'].map(item => (
            <a key={item} href={`#${item.toLowerCase().replace(' ', '-')}`}
              className="text-sm transition-colors hover:opacity-80" style={{ ...mono, color: C.muted }}>
              {item}
            </a>
          ))}
        </div>
        <div className="flex items-center gap-3">
          <Link href="/dashboard" className="hidden md:block text-sm font-medium transition-colors hover:opacity-80"
            style={{ color: C.muted }}>
            Entrar
          </Link>
          <Link href="/dashboard/login"
            className="text-sm font-bold px-5 py-2.5 rounded-xl transition-all active:scale-95 hover:opacity-90"
            style={{ background: C.primary, color: '#582200' }}>
            Cadastre-se grátis
          </Link>
        </div>
      </nav>

      {/* ── HERO ────────────────────────────────────────────── */}
      <section className="relative pt-32 pb-24 px-6 md:px-12 flex flex-col items-center text-center overflow-hidden">
        {/* Glows */}
        <div className="pointer-events-none absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] rounded-full"
          style={{ background: 'rgba(249,115,22,0.08)', filter: 'blur(120px)' }} />
        <div className="pointer-events-none absolute top-40 left-[-10%] w-[400px] h-[400px] rounded-full"
          style={{ background: 'rgba(123,208,255,0.05)', filter: 'blur(100px)' }} />

        <div className="relative z-10 max-w-4xl mx-auto">
          <Tag>Novo · Cardápio digital + Pagamento integrado</Tag>

          <h1 className="text-5xl md:text-7xl font-black leading-[1.05] tracking-tight mt-6 mb-6"
            style={{ letterSpacing: '-0.03em' }}>
            O restaurante do<br />
            <span style={{ color: C.primary }}>futuro começa</span><br />
            com um QR Code.
          </h1>

          <p className="text-lg md:text-xl leading-relaxed max-w-2xl mx-auto mb-10" style={{ color: C.muted }}>
            Substitua cardápios físicos, reduza erros de pedido, receba pagamentos direto na mesa e fidelize seus clientes — tudo em uma plataforma só.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/dashboard/login"
              className="w-full sm:w-auto px-8 py-4 rounded-xl font-bold text-base flex items-center justify-center gap-2 transition-all hover:opacity-90 active:scale-95"
              style={{ background: C.primary, color: '#582200', boxShadow: '0 12px 40px rgba(249,115,22,0.3)' }}>
              <span className="material-symbols-outlined text-[20px]">rocket_launch</span>
              Comece grátis por 14 dias
            </Link>
            <a href="#como-funciona"
              className="w-full sm:w-auto px-8 py-4 rounded-xl font-bold text-base flex items-center justify-center gap-2 transition-all hover:opacity-80"
              style={{ background: 'transparent', color: C.text, border: `1px solid ${C.border}` }}>
              Ver como funciona
            </a>
          </div>

          <p className="text-xs mt-5" style={{ ...mono, color: C.faint }}>
            Sem cartão de crédito · Cancele quando quiser · Setup em 30 minutos
          </p>
        </div>

        {/* Stats bar */}
        <div className="relative z-10 mt-20 w-full max-w-3xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { n: '30 min', label: 'Para entrar no ar' },
            { n: '0%', label: 'Comissão sobre pedidos' },
            { n: '3x', label: 'Mais agilidade na mesa' },
            { n: '24/7', label: 'Suporte disponível' },
          ].map(s => (
            <div key={s.n} className="rounded-xl p-4 text-center"
              style={{ background: C.bgCard, border: `1px solid ${C.borderBlu}` }}>
              <p className="text-3xl font-black" style={{ color: C.primary }}>{s.n}</p>
              <p className="text-xs mt-1" style={{ ...mono, color: C.muted }}>{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── FEATURES ────────────────────────────────────────── */}
      <section id="funcionalidades" className="py-24 px-6 md:px-12 max-w-6xl mx-auto">
        <div className="text-center mb-16">
          <Tag color={C.blue}>Funcionalidades</Tag>
          <h2 className="text-4xl md:text-5xl font-black mt-4 mb-4" style={{ letterSpacing: '-0.02em' }}>
            Tudo que seu restaurante<br />precisa em um só lugar
          </h2>
          <p className="text-lg max-w-xl mx-auto" style={{ color: C.muted }}>
            Da entrada do cliente ao pagamento. Sem papel, sem fila, sem erro.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          <FeatureCard icon="qr_code_scanner" title="Check-in via QR Code"
            desc="O cliente escaneia o QR da mesa, informa nome e WhatsApp e já acessa o cardápio. Sem app, sem cadastro longo." />
          <FeatureCard icon="restaurant_menu" title="Cardápio Digital Dinâmico"
            desc="Atualize preços, fotos e disponibilidade em tempo real. O cliente sempre vê o cardápio correto." />
          <FeatureCard icon="shopping_cart" title="Pedidos Direto da Mesa"
            desc="O cliente monta o pedido no celular. A cozinha recebe instantaneamente no painel. Menos erros, mais velocidade." />
          <FeatureCard icon="account_balance_wallet" title="Qomanda Pay"
            desc="Pagamento integrado: PIX, débito e crédito. Divisão de conta automática. O garçom só confirma." />
          <FeatureCard icon="workspace_premium" title="Programa de Fidelidade"
            desc="Defina recompensas por número de visitas. O sistema identifica o cliente pelo WhatsApp e aplica o benefício automaticamente." />
          <FeatureCard icon="monitoring" title="Analytics em Tempo Real"
            desc="Veja os pratos mais pedidos, horários de pico, ticket médio e receita transacionada. Tome decisões com dados." />
          <FeatureCard icon="groups" title="Divisão de Conta"
            desc="Cada cliente paga a própria parte. O sistema calcula e processa individualmente — sem confusão no caixa." />
          <FeatureCard icon="table_restaurant" title="Gestão de Mesas"
            desc="Visualize em tempo real quais mesas estão livres, ocupadas ou reservadas. Gerencie trocas de mesa sem papel." />
          <FeatureCard icon="notifications_active" title="Alertas para o Garçom"
            desc="Pedido pronto na cozinha? Notificação automática. Fechamento de conta solicitado? O garçom recebe na hora." />
        </div>
      </section>

      {/* ── HOW IT WORKS ────────────────────────────────────── */}
      <section id="como-funciona" className="py-24 px-6 md:px-12"
        style={{ background: C.bgCard }}>
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <Tag color={C.green}>Como funciona</Tag>
            <h2 className="text-4xl md:text-5xl font-black mt-4 mb-4" style={{ letterSpacing: '-0.02em' }}>
              Do cadastro ao primeiro pedido<br />em menos de uma hora
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              {
                step: '01',
                icon: 'storefront',
                title: 'Cadastre seu restaurante',
                desc: 'Crie sua conta, adicione as mesas, suba o cardápio com fotos e preços. O painel é intuitivo — sem precisar de TI.',
              },
              {
                step: '02',
                icon: 'print',
                title: 'Imprima os QR Codes',
                desc: 'Cada mesa ganha um QR Code único. Imprima, plastifique e coloque na mesa. Custo: zero.',
              },
              {
                step: '03',
                icon: 'trending_up',
                title: 'Comece a receber pedidos',
                desc: 'Seus clientes escaneiam, pedem e pagam. Você acompanha tudo em tempo real. Simples assim.',
              },
            ].map(step => (
              <div key={step.step} className="flex flex-col gap-5">
                <div className="flex items-center gap-4">
                  <span className="text-5xl font-black" style={{ ...mono, color: `${C.primary}30` }}>{step.step}</span>
                  <div className="w-12 h-12 rounded-xl flex items-center justify-center"
                    style={{ background: `${C.primary}15` }}>
                    <span className="material-symbols-outlined text-[22px]" style={{ color: C.primary }}>{step.icon}</span>
                  </div>
                </div>
                <div>
                  <h3 className="text-xl font-bold mb-2" style={{ color: C.text }}>{step.title}</h3>
                  <p className="text-sm leading-relaxed" style={{ color: C.muted }}>{step.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── PRICING ─────────────────────────────────────────── */}
      <section id="preços" className="py-24 px-6 md:px-12 max-w-6xl mx-auto">
        <div className="text-center mb-6">
          <Tag color={C.primary}>Preços</Tag>
          <h2 className="text-4xl md:text-5xl font-black mt-4 mb-4" style={{ letterSpacing: '-0.02em' }}>
            Mensalidade justa.<br />Você cresce, a gente cresce.
          </h2>
          <p className="text-lg max-w-2xl mx-auto" style={{ color: C.muted }}>
            Cobramos uma mensalidade fixa por tamanho de operação e uma pequena taxa apenas sobre o que é processado pelo Qomanda Pay. Você nunca paga comissão sobre pedidos — só sobre pagamentos.
          </p>
        </div>

        {/* Benchmark note — dados verificados */}
        <div className="max-w-2xl mx-auto mb-14 rounded-xl overflow-hidden"
          style={{ border: `1px solid ${C.blue}25` }}>
          <div className="px-5 py-3 flex items-center gap-2"
            style={{ background: `${C.blue}12` }}>
            <span className="material-symbols-outlined text-[16px]" style={{ color: C.blue }}>lab_research</span>
            <span className="text-xs font-bold uppercase tracking-widest" style={{ ...mono, color: C.blue }}>
              Benchmark verificado · Dados de 2025–2026
            </span>
          </div>
          <div className="px-5 py-4 grid grid-cols-1 sm:grid-cols-3 gap-4"
            style={{ background: `${C.blue}06` }}>
            {[
              { name: 'Goomer (BR)', price: 'R$0–R$184/mês', note: 'Sem processamento de pagamento' },
              { name: 'Square (EUA)', price: '$0–$149/mês', note: '+ 2,4–2,6% por transação' },
              { name: 'Toast POS (EUA)', price: '$69/mês', note: '+ 2,49% + $0,15 por transação' },
            ].map(b => (
              <div key={b.name}>
                <p className="text-xs font-bold" style={{ ...mono, color: C.muted }}>{b.name}</p>
                <p className="text-sm font-semibold mt-0.5" style={{ color: C.text }}>{b.price}</p>
                <p className="text-xs mt-0.5" style={{ color: C.faint }}>{b.note}</p>
              </div>
            ))}
          </div>
          <div className="px-5 py-3" style={{ background: `${C.primary}08`, borderTop: `1px solid ${C.border}` }}>
            <p className="text-xs leading-relaxed" style={{ color: C.muted }}>
              <span style={{ color: C.primary, fontWeight: 600 }}>Vantagem Qomanda:</span> único no Brasil a combinar cardápio digital + pedidos + pagamento integrado em um plano. Taxa de transação de 1,49–1,99% — abaixo de Square e Toast. Goomer não processa pagamento; iFood cobra 12–27% de comissão por pedido.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
          <PricingCard
            name="Starter"
            mesas="20"
            price="199"
            txFee="1,99%"
            features={[
              'Cardápio digital ilimitado',
              'Pedidos em tempo real',
              'Qomanda Pay (PIX, débito, crédito)',
              'QR Codes para até 20 mesas',
              'Painel de gestão',
              'Suporte por e-mail',
            ]}
          />
          <PricingCard
            name="Growth"
            mesas="50"
            price="299"
            txFee="1,79%"
            highlight
            features={[
              'Tudo do Starter',
              'Até 50 mesas',
              'Programa de fidelidade',
              'Divisão automática de conta',
              'Analytics avançado',
              'Suporte prioritário (chat)',
            ]}
          />
          <PricingCard
            name="Pro"
            mesas="100"
            price="449"
            txFee="1,49%"
            features={[
              'Tudo do Growth',
              'Até 100 mesas',
              'Multi-cardápio (almoço/jantar)',
              'Relatórios exportáveis',
              'Integração com impressora de cozinha',
              'Gerente de conta dedicado',
            ]}
          />
          <PricingCard
            name="Enterprise"
            mesas="ilimitadas"
            price={null}
            txFee="Negociável"
            features={[
              'Mesas ilimitadas',
              'Multi-unidades',
              'API para integrações',
              'SLA garantido',
              'Onboarding presencial',
              'Suporte 24/7',
            ]}
          />
        </div>

        <p className="text-center text-sm mt-8" style={{ ...mono, color: C.faint }}>
          Todos os planos incluem 14 dias grátis · Sem taxa de setup · Cancele quando quiser
        </p>
      </section>

      {/* ── COMPARISON ──────────────────────────────────────── */}
      <section className="py-16 px-6 md:px-12 max-w-4xl mx-auto">
        <h3 className="text-2xl font-black text-center mb-10" style={{ letterSpacing: '-0.02em' }}>
          Por que a Qomanda?
        </h3>
        <div className="rounded-2xl overflow-hidden" style={{ border: `1px solid ${C.borderBlu}` }}>
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: C.bgCard }}>
                <th className="text-left px-5 py-4 font-mono text-xs uppercase tracking-wider" style={{ color: C.muted }}>Funcionalidade</th>
                {['Qomanda', 'Goomer', 'Anota AI', 'iFood'].map(h => (
                  <th key={h} className="px-4 py-4 text-center font-mono text-xs uppercase tracking-wider"
                    style={{ color: h === 'Qomanda' ? C.primary : C.muted }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y" style={{ borderColor: `${C.borderBlu}` }}>
              {[
                ['Cardápio digital QR Code', true, true, true, false],
                ['Pedidos pelo celular do cliente', true, false, true, true],
                ['Pagamento integrado', true, false, false, true],
                ['Sem comissão por pedido', true, true, true, false],
                ['Programa de fidelidade', true, false, false, false],
                ['Divisão de conta', true, false, false, false],
                ['Analytics de vendas', true, true, false, true],
                ['Setup em 30 minutos', true, true, true, false],
              ].map(([label, ...vals], i) => (
                <tr key={i} className="transition-colors hover:bg-white/5">
                  <td className="px-5 py-3.5" style={{ color: C.text }}>{label as string}</td>
                  {(vals as boolean[]).map((v, j) => (
                    <td key={j} className="px-4 py-3.5 text-center">
                      <span className="material-symbols-outlined text-[18px]"
                        style={{ color: v ? C.green : C.faint, fontVariationSettings: v ? "'FILL' 1" : undefined }}>
                        {v ? 'check_circle' : 'cancel'}
                      </span>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* ── FAQ ─────────────────────────────────────────────── */}
      <section id="faq" className="py-24 px-6 md:px-12 max-w-3xl mx-auto">
        <div className="text-center mb-12">
          <Tag color={C.muted}>FAQ</Tag>
          <h2 className="text-4xl font-black mt-4" style={{ letterSpacing: '-0.02em' }}>Dúvidas frequentes</h2>
        </div>
        <div className="space-y-3">
          {FAQS.map((faq, i) => (
            <div key={i} className="rounded-xl overflow-hidden cursor-pointer"
              style={{ background: C.bgCard, border: `1px solid ${openFaq === i ? C.primary + '50' : C.borderBlu}` }}
              onClick={() => setOpenFaq(openFaq === i ? null : i)}>
              <div className="flex justify-between items-center px-6 py-4">
                <p className="font-semibold text-sm pr-4" style={{ color: C.text }}>{faq.q}</p>
                <span className="material-symbols-outlined text-[20px] shrink-0 transition-transform"
                  style={{ color: C.primary, transform: openFaq === i ? 'rotate(180deg)' : 'none' }}>
                  expand_more
                </span>
              </div>
              {openFaq === i && (
                <div className="px-6 pb-5">
                  <p className="text-sm leading-relaxed" style={{ color: C.muted }}>{faq.a}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* ── FINAL CTA ───────────────────────────────────────── */}
      <section className="py-24 px-6 md:px-12 relative overflow-hidden"
        style={{ background: C.bgCard }}>
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="w-[600px] h-[400px] rounded-full"
            style={{ background: 'rgba(249,115,22,0.07)', filter: 'blur(100px)' }} />
        </div>
        <div className="relative z-10 max-w-2xl mx-auto text-center">
          <QomandaLogo size={56} className="mx-auto mb-6" />
          <h2 className="text-4xl md:text-5xl font-black mb-4" style={{ letterSpacing: '-0.02em' }}>
            Pronto para modernizar<br />seu restaurante?
          </h2>
          <p className="text-lg mb-10" style={{ color: C.muted }}>
            Junte-se a centenas de restaurantes que já transformaram a experiência dos seus clientes com a Qomanda.
          </p>
          <Link href="/dashboard/login"
            className="inline-flex items-center gap-2 px-10 py-5 rounded-xl font-bold text-lg transition-all active:scale-95 hover:opacity-90"
            style={{ background: C.primary, color: '#582200', boxShadow: '0 12px 40px rgba(249,115,22,0.3)' }}>
            <span className="material-symbols-outlined">rocket_launch</span>
            Começar 14 dias grátis
          </Link>
          <p className="text-sm mt-5" style={{ ...mono, color: C.faint }}>
            Sem cartão de crédito · Cancele quando quiser
          </p>
        </div>
      </section>

      {/* ── FOOTER ──────────────────────────────────────────── */}
      <footer className="py-12 px-6 md:px-12" style={{ borderTop: `1px solid ${C.border}` }}>
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-2.5">
            <QomandaLogo size={28} />
            <span className="font-black text-base" style={{ letterSpacing: '-0.02em' }}>Qomanda</span>
          </div>
          <div className="flex items-center gap-6 text-sm" style={{ ...mono, color: C.faint }}>
            <Link href="/roadmap" className="hover:opacity-80 transition-opacity">Roadmap</Link>
            <a href="#" className="hover:opacity-80 transition-opacity">Termos de uso</a>
            <a href="#" className="hover:opacity-80 transition-opacity">Privacidade</a>
            <a href="mailto:contato@qomanda.com.br" className="hover:opacity-80 transition-opacity">contato@qomanda.com.br</a>
          </div>
          <p className="text-xs" style={{ ...mono, color: C.faint }}>
            © 2025 Qomanda. Todos os direitos reservados.
          </p>
        </div>
      </footer>

    </div>
  )
}
