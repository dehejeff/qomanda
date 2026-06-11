'use client'

import Link from 'next/link'
import { useState } from 'react'
import { KiComandaLogo } from '@/components/kicomanda-logo'
import { getAvailableRestaurantModels, RESTAURANT_MODELS } from '@/lib/restaurant-models'

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

const MODEL_BENEFITS: Record<string, string[]> = {
  salao: [
    'QR seguro por mesa — check-in com WhatsApp e PIN',
    'Pedidos na mesa e fila da cozinha em tempo real',
    'Divisão de conta, PIX manual ou Asaas, dinheiro na mesa',
    'Painel garçom e confirmação de pagamentos',
  ],
  balcao: [
    'Link do balcão — sem fila de QR na mesa',
    'Pedido com número (#42) e aviso “pronto” no celular',
    'PIX direto na sua chave ou Asaas na sua conta',
    'Ideal para pagar antes de retirar',
  ],
  salao_balcao: [
    'Salão com mesas + balcão no mesmo cardápio',
    'Dois fluxos configurados automaticamente no cadastro',
    '100% do pagamento digital na conta do restaurante',
    'Comissão KiComanda faturada no dia 5 — não na hora da venda',
  ],
  food_hall: [
    'Mesmo fluxo do balcão — ideal para praça de alimentação',
    'Um cardápio, pedido # e aviso “pronto” no celular',
    'PIX manual ou Asaas na conta do operador',
    'Multi-estação no cardápio (categorias por cozinha)',
  ],
}

const COMING_SOON_MODELS = RESTAURANT_MODELS.filter(m => m.status === 'coming_soon')

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
  name, mesas, price, commissionNote, features, highlight = false,
}: {
  name: string; mesas: string; price: string | null; commissionNote: string; features: string[]; highlight?: boolean
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
            <p className="text-sm mt-2 font-semibold leading-snug" style={{ color: highlight ? C.primary : C.blue }}>
              {commissionNote}
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
    a: 'Não. A KiComanda funciona 100% no navegador. Seus clientes usam o próprio celular; você gerencia pelo computador ou tablet. Não precisa instalar app.',
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
    q: 'Como funciona a comissão da KiComanda?',
    a: 'Cobramos mensalidade fixa + comissão progressiva apenas sobre vendas digitais registradas pelo app (PIX e cartão via KiComanda). O valor pago pelo cliente cai 100% na sua conta (PIX manual ou Asaas). A comissão é somada no mês e faturada todo dia 5. Dinheiro na mesa: 0% de comissão.',
  },
  {
    q: 'Preciso usar Asaas ou maquininha?',
    a: 'Não. Você pode começar com PIX manual (sua chave PIX no checkout) e dinheiro na mesa. Quando quiser automatizar PIX e cartão, conecta a API key da sua conta Asaas — o dinheiro continua indo 100% para você.',
  },
  {
    q: 'Quanto tempo leva para configurar?',
    a: 'No cadastro você escolhe o modelo (salão, balcão ou ambos). O sistema já configura fluxo e painel. Em ~30 minutos: chave PIX ou Asaas, cardápio e QR das mesas ou link do balcão.',
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
            <KiComandaLogo size={28} />
            <span className="text-base font-black" style={{ color: C.text, letterSpacing: '-0.02em' }}>KiComanda</span>
          </div>
          <div className="hidden md:flex items-center gap-8">
            {['Funcionalidades', 'Modelos', 'Como funciona', 'Preços', 'FAQ'].map(item => (
              <a key={item} href={`#${item.toLowerCase().replace(/ /g, '-')}`}
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
            {['Funcionalidades', 'Modelos', 'Como funciona', 'Preços', 'FAQ'].map(item => (
              <a key={item}
                href={`#${item.toLowerCase().replace(/ /g, '-')}`}
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
          <Tag>Salão · Balcão · Pagamento na sua conta</Tag>

          <h1 className="text-[38px] sm:text-5xl md:text-7xl font-black leading-[1.05] tracking-tight mt-6 mb-6"
            style={{ letterSpacing: '-0.03em' }}>
            O modelo certo<br />
            <span style={{ color: C.primary }}>para o seu negócio.</span><br />
            Pedido e pagamento no celular.
          </h1>

          <p className="text-base md:text-xl leading-relaxed max-w-2xl mx-auto mb-8 md:mb-10 px-2" style={{ color: C.muted }}>
            Escolha salão, balcão ou os dois no cadastro — o sistema já vem configurado. Pagamento cai 100% na sua conta; comissão KiComanda só sobre vendas digitais, faturada mensalmente.
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
            { n: '4', label: 'Modelos no cadastro' },
            { n: '100%', label: 'Pagamento na sua conta' },
            { n: '0%', label: 'Comissão em dinheiro' },
            { n: '14d', label: 'Trial grátis' },
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
            desc="O cliente monta o pedido na mesa e tudo atualiza sozinho — sem recarregar a tela. Painel, garçom, cozinha e cliente sempre sincronizados." />
          <FeatureCard icon="skillet" title="Tela de cozinha (KDS)"
            desc="Painel dedicado da cozinha: fila por status, tempo de cada pedido e comanda imprimível. A cozinha só avança até 'pronto'; o garçom entrega." />
          <FeatureCard icon="countertops" title="Balcão e fila por número"
            desc="QR único do balcão para imprimir. O cliente pede pelo celular, recebe um número (#42) e é avisado quando fica pronto — ideal para fast food e praça." />
          <FeatureCard icon="point_of_sale" title="Caixa e confirmação"
            desc="Tela de caixa com busca por código de pagamento. Confirma dinheiro e PIX manual, valida o recibo e libera a saída do cliente com segurança." />
          <FeatureCard icon="account_balance_wallet" title="Recebimento na sua conta"
            desc="PIX manual, Asaas ou Mercado Pago — o dinheiro cai 100% na sua conta. Sem split na hora; comissão KiComanda faturada todo dia 5 sobre vendas digitais." />
          <FeatureCard icon="groups" title="Divisão de conta inteligente"
            desc="Cada um paga a própria parte — ou paga a conta de outro na mesa. O sistema calcula saldo, taxa de serviço e quem falta pagar, com proteção contra fechamento acidental." />
          <FeatureCard icon="badge" title="Equipe com perfis"
            desc="Garçom, cozinha, caixa e gerente — cada um vê só o que precisa. Acesso segregado por papel, do app do garçom ao painel do dono." />
          <FeatureCard icon="workspace_premium" title="Fidelidade e ofertas"
            desc="Regras por visitas ou valor gasto. Benefícios automáticos no checkout e cortesias personalizadas que você envia pelo painel." />
          <FeatureCard icon="receipt_long" title="Nota fiscal automática"
            desc="NF-e emitida e enviada por WhatsApp após o pagamento (Focus NFe). Opcional: quem já emite no PDV próprio desliga em um clique." />
          <FeatureCard icon="monitoring" title="Relatórios e gestão de mesas"
            desc="Mapa de mesas ao vivo, receita, ticket médio e volume por período. Dados reais do seu fluxo, atualizados em tempo real — não estimativas." />
        </div>
      </section>

      {/* ── MODELOS DE RESTAURANTE ───────────────────────────── */}
      <section id="modelos" className="py-24 px-4 md:px-12 w-full"
        style={{ background: C.bgCard }}>
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-14">
            <Tag color={C.primary}>Modelos operacionais</Tag>
            <h2 className="text-4xl md:text-5xl font-black mt-4 mb-4" style={{ letterSpacing: '-0.02em' }}>
              Para cada tipo de restaurante,<br />um fluxo pronto
            </h2>
            <p className="text-lg max-w-2xl mx-auto" style={{ color: C.muted }}>
              No cadastro você escolhe como opera. O painel, check-in e pagamento já vêm ajustados — falta só sua chave PIX ou Asaas e o cardápio.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-4 gap-5 mb-10">
            {getAvailableRestaurantModels().map(model => (
              <div key={model.id} className="rounded-2xl p-6 flex flex-col gap-4"
                style={{ background: C.bg, border: `1px solid ${C.borderBlu}` }}>
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-xl flex items-center justify-center"
                    style={{ background: `${C.primary}15` }}>
                    <span className="material-symbols-outlined text-[22px]" style={{ color: C.primary }}>{model.icon}</span>
                  </div>
                  <div>
                    <h3 className="text-base font-bold" style={{ color: C.text }}>{model.name}</h3>
                    <p className="text-xs" style={{ color: C.muted }}>{model.tagline}</p>
                  </div>
                </div>
                <p className="text-[11px] font-mono uppercase tracking-wider" style={{ color: C.faint }}>
                  {model.examples}
                </p>
                <ul className="space-y-2 flex-1">
                  {(MODEL_BENEFITS[model.id] ?? []).map(b => (
                    <li key={b} className="flex items-start gap-2 text-sm" style={{ color: C.text }}>
                      <span className="material-symbols-outlined text-[15px] mt-0.5 shrink-0" style={{ color: C.green }}>check</span>
                      {b}
                    </li>
                  ))}
                </ul>
                <Link href="/cadastro"
                  className="text-center py-3 rounded-xl text-sm font-bold transition-all active:scale-95"
                  style={{ background: `${C.primary}18`, color: C.primary, border: `1px solid ${C.primary}40` }}>
                  Começar com este modelo
                </Link>
              </div>
            ))}
          </div>

          {COMING_SOON_MODELS.length > 0 && (
            <div className="rounded-xl p-5" style={{ background: `${C.bgCard2}80`, border: `1px dashed ${C.borderBlu}` }}>
              <p className="text-xs font-bold uppercase tracking-widest mb-3" style={{ ...mono, color: C.faint }}>
                Em breve na esteira
              </p>
              <div className="flex flex-wrap gap-3">
                {COMING_SOON_MODELS.map(m => (
                  <span key={m.id} className="text-xs px-3 py-1.5 rounded-full"
                    style={{ ...mono, background: C.bg, color: C.muted, border: `1px solid ${C.borderBlu}` }}>
                    {m.name}
                  </span>
                ))}
              </div>
            </div>
          )}
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
                icon: 'tune',
                title: 'Escolha o modelo no cadastro',
                desc: 'Salão com mesas, balcão fast food ou os dois. Mesas seed, fluxo de pedido e modo de pagamento já vêm configurados.',
              },
              {
                step: '02',
                icon: 'payments',
                title: 'Configure recebimento e cardápio',
                desc: 'Cadastre sua chave PIX (ou conecte Asaas), publique o cardápio e imprima QR das mesas ou divulgue o link do balcão.',
              },
              {
                step: '03',
                icon: 'trending_up',
                title: 'Atenda e receba na sua conta',
                desc: 'Clientes pedem e pagam pelo celular. Você confirma PIX/dinheiro quando necessário. Comissão KiComanda faturada todo dia 5.',
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
            Mensalidade fixa por tamanho da operação + comissão progressiva sobre vendas digitais (PIX/cartão pelo app). Sem taxa por transação na hora — tudo faturado no dia 5. Dinheiro na mesa: 0% comissão.
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
              <span style={{ color: C.primary, fontWeight: 600 }}>Como funciona:</span> pagamentos digitais caem 100% na sua conta (PIX manual ou Asaas seu). A KiComanda registra o GMV digital e fatura mensalidade + comissão progressiva (2,99%→1,49%) todo dia 5. Implantação piloto R$ 1.990.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
          <PricingCard
            name="Starter"
            mesas="20"
            price="299"
            commissionNote="Comissão digital: 0,7%*"
            features={[
              'Modelo salão, balcão ou ambos no cadastro',
              'Cardápio digital e pedidos em tempo real',
              'PIX manual, Asaas ou Mercado Pago (conta do restaurante)',
              'Balcão ilimitado (não conta no limite)',
              'Dinheiro na mesa sem comissão',
              'Suporte por e-mail',
            ]}
          />
          <PricingCard
            name="Growth"
            mesas="50"
            price="399"
            commissionNote="Comissão digital: 0,5%*"
            highlight
            features={[
              'Tudo do Starter',
              'Até 50 mesas',
              'Programa de fidelidade e ofertas',
              'Comissão menor sobre vendas digitais',
              'Caixa dedicado + perfis de equipe',
              'Suporte prioritário',
            ]}
          />
          <PricingCard
            name="Pro"
            mesas="ilimitadas"
            price="599"
            commissionNote="Comissão digital: 0,3%*"
            features={[
              'Tudo do Growth',
              'Mesas ilimitadas',
              'Menor comissão sobre vendas digitais',
              'Painel garçom + tela de cozinha (KDS)',
              'Relatórios por período',
              'Gerente de conta dedicado',
            ]}
          />
          <PricingCard
            name="Enterprise"
            mesas="ilimitadas"
            price={null}
            commissionNote="Comissão negociável"
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
          14 dias grátis · Implantação piloto R$ 1.990 · Fatura mensal (dia 5)
          <br />
          <span style={{ color: C.muted }}>* Comissão flat sobre GMV digital do mês (PIX/cartão via app): Starter 0,7% · Growth 0,5% · Pro 0,3%. Dinheiro: 0%. O recebimento cai 100% na conta do restaurante — a comissão KiComanda é faturada à parte no dia 5. Gateways: PIX manual, Asaas e Mercado Pago hoje · PagBank, Stone e Cielo no <Link href="/roadmap" className="underline" style={{ color: C.blue }}>roadmap</Link>.</span>
        </p>
      </section>

      {/* ── COMPARISON ──────────────────────────────────────── */}
      <section className="py-16 px-4 md:px-12 w-full max-w-4xl mx-auto">
        <h3 className="text-2xl font-black text-center mb-10" style={{ letterSpacing: '-0.02em' }}>
          Por que a KiComanda?
        </h3>
        <div className="rounded-2xl overflow-hidden overflow-x-auto" style={{ border: `1px solid ${C.borderBlu}` }}>
          <table className="w-full text-sm" style={{ minWidth: 400 }}>
            <thead>
              <tr style={{ background: C.bgCard }}>
                <th className="text-left px-5 py-4 font-mono text-xs uppercase tracking-wider" style={{ color: C.muted }}>Funcionalidade</th>
                {['KiComanda', 'Goomer', 'Anota AI', 'iFood'].map(h => (
                  <th key={h} className="px-4 py-4 text-center font-mono text-xs uppercase tracking-wider"
                    style={{ color: h === 'KiComanda' ? C.primary : C.muted }}>
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
                ['Modo balcão / fast food', true, false, false, false],
                ['Pagamento 100% na conta do restaurante', true, false, false, false],
                ['Comissão mensal (não na hora da venda)', true, false, false, false],
                ['Sem comissão em dinheiro na mesa', true, true, true, false],
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
          <KiComandaLogo size={56} className="mx-auto mb-6" />
          <h2 className="text-4xl md:text-5xl font-black mb-4" style={{ letterSpacing: '-0.02em' }}>
            Pronto para colocar<br />seu restaurante no ar?
          </h2>
          <p className="text-lg mb-10" style={{ color: C.muted }}>
            Teste grátis por 14 dias. Escolha seu modelo no cadastro — salão, balcão ou ambos. Só falta configurar PIX e publicar o cardápio.
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
            <KiComandaLogo size={28} />
            <span className="font-black text-base" style={{ letterSpacing: '-0.02em' }}>KiComanda</span>
          </div>
          <div className="flex items-center gap-6 text-sm" style={{ ...mono, color: C.faint }}>
            <Link href="/integracoes" className="hover:opacity-80 transition-opacity">Integrações</Link>
            <Link href="/roadmap" className="hover:opacity-80 transition-opacity">Roadmap</Link>
            <Link href="/termos" className="hover:opacity-80 transition-opacity">Termos de uso</Link>
            <Link href="/privacidade" className="hover:opacity-80 transition-opacity">Privacidade</Link>
            <a href="mailto:contato@kicomanda.com.br" className="hover:opacity-80 transition-opacity">contato@kicomanda.com.br</a>
          </div>
          <p className="text-xs" style={{ ...mono, color: C.faint }}>
            © 2026 KiComanda. Todos os direitos reservados.
          </p>
        </div>
      </footer>

    </div>
  )
}
