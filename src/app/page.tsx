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
      <Link href="/cadastro"
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
    a: 'Não. A Qomanda funciona 100% no navegador. Seus clientes usam o próprio celular; você gerencia pelo computador ou tablet. Não precisa instalar app.',
  },
  {
    q: 'Como funciona o check-in na mesa?',
    a: 'Cada mesa tem um QR Code único e seguro. Na primeira visita, o cliente informa nome, WhatsApp e cria um PIN de 4 dígitos. Nas próximas, entra mais rápido pelo WhatsApp. Sem app, sem fila no balcão.',
  },
  {
    q: 'O QR Code pode levar o cliente para outro restaurante?',
    a: 'Não. Cada QR combina restaurante, número da mesa e um token secreto gerado pelo sistema. Só funciona na mesa correta — não dá para adivinhar ou reutilizar em outro lugar.',
  },
  {
    q: 'Como funciona a taxa de transação?',
    a: 'Cobramos uma pequena porcentagem apenas sobre pagamentos processados pelo Qomanda Pay (PIX, débito e crédito via Asaas). Se o cliente pagar em dinheiro ou na maquininha da casa, não há taxa Qomanda.',
  },
  {
    q: 'Posso usar sem integrar o pagamento?',
    a: 'Sim. Cardápio digital, pedidos e gestão de mesas funcionam de forma independente. Você ativa o Qomanda Pay quando quiser — nossa equipe ajuda na configuração inicial com o Asaas.',
  },
  {
    q: 'Quanto tempo leva para configurar?',
    a: 'Em cerca de 30 minutos você cadastra o restaurante, monta o cardápio e gera os QR Codes das mesas. Pagamentos online exigem a conta Asaas — o onboarding leva mais um passo, com suporte nosso.',
  },
  {
    q: 'Como funciona a fidelidade?',
    a: 'Você define regras por visitas ou valor gasto. O sistema identifica o cliente pelo WhatsApp, concede benefícios automaticamente e o cliente resgata no checkout da próxima ida. Você também pode enviar ofertas personalizadas.',
  },
  {
    q: 'Posso cancelar quando quiser?',
    a: 'Sim. Sem fidelidade mínima. Cancele a qualquer momento sem multa.',
  },
]

export default function LandingPage() {
  const [openFaq, setOpenFaq] = useState<number | null>(null)
  const [mobileMenu, setMobileMenu] = useState(false)

  return (
    <div style={{ background: C.bg, color: C.text, ...font }} className="min-h-screen overflow-x-hidden w-full">

      {/* ── NAVBAR ──────────────────────────────────────────── */}
      <nav className="fixed top-0 left-0 right-0 z-50"
        style={{ background: 'rgba(11,19,38,0.95)', borderBottom: `1px solid ${C.border}`, backdropFilter: 'blur(16px)' }}>
        <div className="flex justify-between items-center px-5 md:px-12 h-16">
          <div className="flex items-center gap-2.5">
            <QomandaLogo size={28} />
            <span className="text-base font-black" style={{ color: C.text, letterSpacing: '-0.02em' }}>Qomanda</span>
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
            <Link href="/login?perfil=cliente" className="hidden sm:block text-sm font-medium transition-colors hover:opacity-80"
              style={{ color: C.muted }}>
              Área do cliente
            </Link>
            <Link href="/login?perfil=admin" className="hidden md:block text-sm font-medium transition-colors hover:opacity-80"
              style={{ color: C.muted }}>
              Entrar
            </Link>
            <Link href="/cadastro"
              className="text-sm font-bold px-4 py-2.5 rounded-xl transition-all active:scale-95 hover:opacity-90"
              style={{ background: C.primary, color: '#582200' }}>
              <span className="hidden sm:inline">Cadastre-se grátis</span>
              <span className="sm:hidden">Cadastrar</span>
            </Link>
            {/* Mobile hamburger */}
            <button
              className="md:hidden p-2 rounded-lg transition-colors"
              style={{ color: C.muted }}
              onClick={() => setMobileMenu(v => !v)}
            >
              <span className="material-symbols-outlined text-[22px]">
                {mobileMenu ? 'close' : 'menu'}
              </span>
            </button>
          </div>
        </div>

        {/* Mobile dropdown */}
        {mobileMenu && (
          <div className="md:hidden flex flex-col px-5 pb-4 gap-1"
            style={{ borderTop: `1px solid ${C.border}` }}>
            {['Funcionalidades', 'Como funciona', 'Preços', 'FAQ'].map(item => (
              <a key={item}
                href={`#${item.toLowerCase().replace(' ', '-')}`}
                onClick={() => setMobileMenu(false)}
                className="py-3 text-sm border-b transition-colors hover:opacity-80"
                style={{ ...mono, color: C.muted, borderColor: `${C.border}` }}>
                {item}
              </a>
            ))}
            <Link href="/login?perfil=cliente" onClick={() => setMobileMenu(false)}
              className="py-3 text-sm font-semibold transition-colors"
              style={{ color: C.primary }}>
              Área do cliente
            </Link>
            <Link href="/login?perfil=admin" onClick={() => setMobileMenu(false)}
              className="py-3 text-sm font-semibold transition-colors"
              style={{ color: C.primary }}>
              Já tenho conta — Entrar
            </Link>
          </div>
        )}
      </nav>

      {/* ── HERO ────────────────────────────────────────────── */}
      <section className="relative pt-24 pb-16 md:pt-32 md:pb-24 px-5 md:px-12 flex flex-col items-center text-center overflow-hidden">
        {/* Glows */}
        <div className="pointer-events-none absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] rounded-full"
          style={{ background: 'rgba(249,115,22,0.08)', filter: 'blur(120px)' }} />
        <div className="pointer-events-none absolute top-40 left-[-10%] w-[400px] h-[400px] rounded-full"
          style={{ background: 'rgba(123,208,255,0.05)', filter: 'blur(100px)' }} />

        <div className="relative z-10 max-w-4xl mx-auto">
          <Tag>Cardápio digital · Pedidos · Pagamento na mesa</Tag>

          <h1 className="text-[38px] sm:text-5xl md:text-7xl font-black leading-[1.05] tracking-tight mt-6 mb-6"
            style={{ letterSpacing: '-0.03em' }}>
            Seu cliente pede e paga<br />
            <span style={{ color: C.primary }}>pelo celular.</span><br />
            Você controla tudo.
          </h1>

          <p className="text-base md:text-xl leading-relaxed max-w-2xl mx-auto mb-8 md:mb-10 px-2" style={{ color: C.muted }}>
            QR Code seguro na mesa, cardápio digital, pedidos em tempo real e pagamento integrado — sem comissão por pedido e sem app para o cliente instalar.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/cadastro"
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
            { n: 'PIX', label: 'Crédito e débito na mesa' },
            { n: 'QR', label: 'Seguro por mesa' },
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
      <section id="funcionalidades" className="py-24 px-4 md:px-12 w-full max-w-6xl mx-auto">
        <div className="text-center mb-16">
          <Tag color={C.blue}>Funcionalidades</Tag>
          <h2 className="text-4xl md:text-5xl font-black mt-4 mb-4" style={{ letterSpacing: '-0.02em' }}>
            O que já está pronto<br />para o seu restaurante
          </h2>
          <p className="text-lg max-w-xl mx-auto" style={{ color: C.muted }}>
            Funcionalidades reais, testadas em operação — da mesa ao caixa, sem promessas vazias.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          <FeatureCard icon="qr_code_scanner" title="Check-in seguro por QR"
            desc="Cada mesa tem um QR único com token secreto. O cliente faz check-in com WhatsApp e PIN — só entra na mesa certa, no restaurante certo." />
          <FeatureCard icon="restaurant_menu" title="Cardápio digital"
            desc="Atualize preços, categorias e disponibilidade em tempo real. O cliente vê o cardápio correto direto no celular, sem baixar app." />
          <FeatureCard icon="shopping_cart" title="Pedidos em tempo real"
            desc="O cliente monta o pedido na mesa. A cozinha recebe na fila kanban do painel — pendente, preparando, pronto, entregue." />
          <FeatureCard icon="account_balance_wallet" title="Qomanda Pay"
            desc="PIX, crédito e débito integrados via Asaas. Cartão salvo com senha de 6 dígitos. Divisão de conta automática por cliente." />
          <FeatureCard icon="groups" title="Divisão de conta inteligente"
            desc="Cada um paga a própria parte — ou paga a conta de outro na mesa. O sistema calcula saldo, taxa de serviço e quem falta pagar." />
          <FeatureCard icon="workspace_premium" title="Fidelidade e ofertas"
            desc="Regras por visitas ou valor gasto. Benefícios automáticos no checkout e cortesias personalizadas que você envia pelo painel." />
          <FeatureCard icon="person" title="Hub do cliente"
            desc="Seus clientes têm área própria: histórico de visitas, recibos, cartões salvos e restaurantes favoritos — tudo pelo WhatsApp." />
          <FeatureCard icon="table_restaurant" title="Gestão de mesas"
            desc="Mapa ao vivo: mesas livres, ocupadas ou reservadas. QR Code por mesa, troca de mesa e visão operacional no dashboard." />
          <FeatureCard icon="monitoring" title="Relatórios de vendas"
            desc="Receita, ticket médio e volume de pedidos por período — semana, quinzena ou mês. Dados reais do seu fluxo, não estimativas." />
        </div>
      </section>

      {/* ── HOW IT WORKS ────────────────────────────────────── */}
      <section id="como-funciona" className="py-24 px-4 md:px-12 w-full"
        style={{ background: C.bgCard }}>
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <Tag color={C.green}>Como funciona</Tag>
            <h2 className="text-4xl md:text-5xl font-black mt-4 mb-4" style={{ letterSpacing: '-0.02em' }}>
              Três passos para<br />colocar no ar
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              {
                step: '01',
                icon: 'storefront',
                title: 'Cadastre seu restaurante',
                desc: 'Crie sua conta, adicione mesas e monte o cardápio com preços e categorias. O painel é intuitivo — sem depender de TI.',
              },
              {
                step: '02',
                icon: 'print',
                title: 'Imprima os QR Codes',
                desc: 'Cada mesa ganha um QR Code único e seguro. Imprima, plastifique e coloque na mesa. Troca de mesa? Gere outro QR no painel.',
              },
              {
                step: '03',
                icon: 'trending_up',
                title: 'Receba pedidos e pagamentos',
                desc: 'Clientes escaneiam, pedem e pagam pelo celular. Você acompanha mesas, fila da cozinha e receita em tempo real.',
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
      <section id="preços" className="py-24 px-4 md:px-12 w-full max-w-6xl mx-auto">
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
              'Pedidos em tempo real (kanban)',
              'QR Code seguro por mesa',
              'Painel de mesas e operação',
              'Qomanda Pay (PIX, crédito, débito)*',
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
              'Programa de fidelidade e ofertas',
              'Divisão automática de conta',
              'Relatórios de receita e ticket',
              'Suporte prioritário',
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
              'Ofertas e cortesias personalizadas',
              'Histórico de clientes e recibos',
              'Relatórios por período',
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
              'Multi-unidades (em breve)',
              'API para integrações (em breve)',
              'Onboarding personalizado',
              'SLA negociável',
              'Suporte dedicado',
            ]}
          />
        </div>

        <p className="text-center text-sm mt-8 max-w-xl mx-auto leading-relaxed" style={{ ...mono, color: C.faint }}>
          Todos os planos incluem 14 dias grátis · Sem taxa de setup · Cancele quando quiser
          <br />
          <span style={{ color: C.muted }}>* Qomanda Pay requer conta Asaas — ajudamos na configuração inicial.</span>
        </p>
      </section>

      {/* ── COMPARISON ──────────────────────────────────────── */}
      <section className="py-16 px-4 md:px-12 w-full max-w-4xl mx-auto">
        <h3 className="text-2xl font-black text-center mb-10" style={{ letterSpacing: '-0.02em' }}>
          Por que a Qomanda?
        </h3>
        <div className="rounded-2xl overflow-hidden overflow-x-auto" style={{ border: `1px solid ${C.borderBlu}` }}>
          <table className="w-full text-sm" style={{ minWidth: 400 }}>
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
                ['Cardápio digital com QR Code', true, true, true, false],
                ['QR Code seguro por mesa (token)', true, false, false, false],
                ['Pedidos pelo celular do cliente', true, false, true, true],
                ['Pagamento na mesa (PIX e cartão)', true, false, false, true],
                ['Sem comissão por pedido', true, true, true, false],
                ['Divisão de conta por cliente', true, false, false, false],
                ['Fidelidade automática', true, false, false, false],
                ['Relatórios de receita', true, true, false, true],
                ['Setup em ~30 minutos', true, true, true, false],
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
      <section id="faq" className="py-24 px-4 md:px-12 w-full max-w-3xl mx-auto">
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
            Pronto para colocar<br />seu restaurante no ar?
          </h2>
          <p className="text-lg mb-10" style={{ color: C.muted }}>
            Teste grátis por 14 dias. Cardápio digital, pedidos na mesa e pagamento integrado — tudo em uma plataforma, sem comissão por pedido.
          </p>
          <Link href="/cadastro"
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
      <footer className="py-12 px-4 md:px-12 w-full" style={{ borderTop: `1px solid ${C.border}` }}>
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row justify-between items-center gap-6 text-center md:text-left">
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
            © 2026 Qomanda. Todos os direitos reservados.
          </p>
        </div>
      </footer>

    </div>
  )
}
