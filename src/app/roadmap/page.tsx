import Link from 'next/link'
import { QomandaLogo } from '@/components/qomanda-logo'

const C = {
  bg: '#0b1326', bgCard: '#131b2e', bgCard2: '#1e293b',
  border: 'rgba(88,66,55,0.35)', borderBlu: 'rgba(51,65,85,0.6)',
  primary: '#f97316', text: '#dae2fd', muted: '#a78b7d', faint: '#584237',
  green: '#34d399', blue: '#7bd0ff', amber: '#f59e0b', red: '#f87171',
}
const font = { fontFamily: 'Geist, system-ui, sans-serif' }
const mono = { fontFamily: 'JetBrains Mono, monospace' }

const PHASES = [
  {
    id: 'mvp',
    label: 'MVP',
    title: 'Implementado',
    status: 'done',
    color: C.green,
    period: 'Concluído',
    groups: [
      {
        title: 'Plataforma Cliente (PWA)',
        items: [
          'Scanner de QR Code com fallback manual',
          'Check-in com captura de nome, sobrenome e WhatsApp',
          'Home hub pós check-in com status de pedido em tempo real',
          'Cardápio digital com categorias, fotos e filtros',
          'Pedidos direto do celular com carrinho',
          'Acompanhamento de pedidos com barra de progresso animada',
          'Checkout com divisão de conta automática',
          'Telas de pagamento: PIX, Débito, Crédito',
          'Tela de confirmação com código de validação',
          'Perfil do cliente com edição de dados e preferências',
          'Programa de fidelidade (contagem de visitas)',
        ],
      },
      {
        title: 'Painel Administrativo',
        items: [
          'Overview em tempo real (mesas, pedidos, receita)',
          'Mapa de mesas com status e gestão',
          'Geração de QR Code por mesa',
          'Gestão de cardápio com toggle de disponibilidade',
          'Fila de pedidos em tempo real (kanban)',
          'Settings: Pagamentos com histórico de transações',
          'Settings: Fidelidade com configuração de regras',
        ],
      },
    ],
  },
  {
    id: 'fechamento',
    label: 'Prioridade',
    title: 'Fechamento do Projeto',
    status: 'next',
    color: C.red,
    period: 'Próximo · Maio 2026',
    groups: [
      {
        title: '1 · Método de pagamento',
        items: [
          'Settings → Pagamentos: conectar credenciais Asaas (sandbox/produção)',
          'Validação de integração e status no painel',
          'Habilitar PIX, crédito e débito conforme conta Asaas',
          'Desligar modo teste (bypass) em produção',
        ],
      },
      {
        title: '2 · QR Codes e notas fiscais',
        items: [
          'QR Code das mesas — geração, download e impressão no painel',
          'NF-e automática após pagamento confirmado (SEFAZ / emissor)',
          'Envio da nota ao cliente via WhatsApp',
          'Histórico pagamento ↔ nota fiscal (cliente e dashboard)',
        ],
      },
      {
        title: '3 · Fotos do cardápio',
        items: [
          'Corrigir modal de edição de produto (hoje não funciona)',
          'Upload de imagem via Supabase Storage',
          'Preview e remoção de foto no formulário',
          'Exibir fotos no cardápio do cliente',
        ],
      },
    ],
  },
  {
    id: 'fase1',
    label: 'Fase 1',
    title: 'Lançamento',
    status: 'planned',
    color: C.primary,
    period: 'Q3 2026',
    groups: [
      {
        title: 'Pagamentos (melhorias)',
        items: [
          'Asaas PIX, crédito, webhook — base implementada ✓',
          'Recibos, códigos e histórico de pagamentos ✓',
          'Conta paga por outro cliente + WhatsApp ✓',
          'Webhook robusto com retry e idempotência',
        ],
      },
      {
        title: 'Onboarding do Restaurante',
        items: [
          'Fluxo de cadastro público para novos clientes',
          'Wizard de configuração inicial (nome, logo, horários)',
          'Upload de logo do restaurante via Supabase Storage',
        ],
      },
      {
        title: 'Funcionalidades Críticas',
        items: [
          'Fidelidade: salvar regras no Supabase (atualmente UI only)',
          'Alerta no dashboard quando cliente atinge meta de fidelidade',
          'Botão "Chamar Garçom" — notificação no dashboard',
        ],
      },
    ],
  },
  {
    id: 'fase2',
    label: 'Fase 2',
    title: 'Crescimento',
    status: 'planned',
    color: C.blue,
    period: 'Q4 2026',
    groups: [
      {
        title: 'Analytics',
        items: [
          'Gráfico de receita por período',
          'Ranking de pratos mais pedidos e horário de pico',
          'Ticket médio por mesa e por cliente',
          'Exportação de relatórios (CSV/PDF)',
        ],
      },
      {
        title: 'Equipe & Segurança',
        items: [
          'Gestão de equipe: garçons, cozinheiros, gerentes',
          'Controle de acesso por perfil',
          '2FA e histórico de sessões do administrador',
        ],
      },
      {
        title: 'Comunicação',
        items: [
          'WhatsApp Business API — confirmação de pedidos',
          'Envio de nota fiscal via WhatsApp',
          'Campanhas de promoção para clientes fiéis',
        ],
      },
    ],
  },
  {
    id: 'fase3',
    label: 'Fase 3',
    title: 'Escala',
    status: 'future',
    color: C.muted,
    period: '2027',
    groups: [
      {
        title: 'Multi-unidades',
        items: [
          'Múltiplos restaurantes por conta',
          'Dashboard consolidado multi-unidade',
        ],
      },
      {
        title: 'Integrações',
        items: [
          'Impressora de cozinha (Epson, Bixolon)',
          'API pública para ERPs e sistemas de delivery',
          'Integração iFood / Rappi',
        ],
      },
      {
        title: 'Produto',
        items: [
          'PWA instalável (ícone na tela inicial)',
          'Sistema de reservas com confirmação via WhatsApp',
          'Multi-cardápio por turno (almoço / jantar)',
          'Reembolsos e disputas no painel',
        ],
      },
    ],
  },
]

const STATUS_SUMMARY = [
  { label: 'Cliente — Fluxo principal',   pct: 95, color: C.green  },
  { label: 'Cliente — Pagamento',         pct: 75, color: C.amber  },
  { label: 'Dashboard — Operação',        pct: 90, color: C.green  },
  { label: 'Fechamento — Pagamentos Asaas', pct: 65, color: C.amber  },
  { label: 'Fechamento — NF-e / QR mesas', pct: 15, color: C.red    },
  { label: 'Fechamento — Fotos cardápio', pct: 10, color: C.red    },
  { label: 'Dashboard — Analytics',       pct: 10, color: C.red    },
  { label: 'Fidelidade',                  pct: 70, color: C.amber  },
  { label: 'WhatsApp',                    pct: 40, color: C.amber  },
  { label: 'Onboarding restaurante',      pct: 20, color: C.red    },
]

export default function RoadmapPage() {
  return (
    <div style={{ background: C.bg, color: C.text, ...font }} className="min-h-screen">

      {/* Navbar */}
      <nav className="fixed top-0 left-0 right-0 z-50 flex justify-between items-center px-6 md:px-12 h-16"
        style={{ background: 'rgba(11,19,38,0.9)', borderBottom: `1px solid ${C.border}`, backdropFilter: 'blur(16px)' }}>
        <Link href="/" className="flex items-center gap-2.5">
          <QomandaLogo size={28} />
          <span className="font-black text-base" style={{ letterSpacing: '-0.02em' }}>Qomanda</span>
        </Link>
        <div className="flex items-center gap-4">
          <Link href="/" className="text-sm transition-colors hover:opacity-80" style={{ ...mono, color: C.muted }}>← Voltar ao site</Link>
          <Link href="/login" className="hidden md:block text-sm transition-colors hover:opacity-80" style={{ ...mono, color: C.muted }}>Entrar</Link>
          <Link href="/cadastro"
            className="text-sm font-bold px-4 py-2 rounded-xl transition-all"
            style={{ background: C.primary, color: '#582200' }}>
            Cadastre-se
          </Link>
        </div>
      </nav>

      {/* Ambient */}
      <div className="pointer-events-none fixed top-0 left-1/2 -translate-x-1/2 w-[700px] h-[300px] rounded-full"
        style={{ background: 'rgba(249,115,22,0.06)', filter: 'blur(120px)' }} />

      <main className="max-w-5xl mx-auto px-6 md:px-12 pt-28 pb-20">

        {/* Header */}
        <div className="mb-16">
          <span className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-widest px-3 py-1 rounded-full mb-4"
            style={{ ...mono, background: `${C.primary}18`, color: C.primary, border: `1px solid ${C.primary}30` }}>
            <span className="material-symbols-outlined text-[14px]">map</span>
            Roadmap Público
          </span>
          <h1 className="text-5xl md:text-6xl font-black leading-[1.05] mb-4" style={{ letterSpacing: '-0.03em' }}>
            O que já existe<br />
            <span style={{ color: C.primary }}>e o que vem por aí.</span>
          </h1>
          <p className="text-lg max-w-xl" style={{ color: C.muted }}>
            Transparência total sobre o estado do produto. Veja o que está pronto, o que está em construção e o que planejamos para o futuro.
          </p>
        </div>

        {/* Progress overview */}
        <div className="rounded-2xl p-6 mb-16" style={{ background: C.bgCard, border: `1px solid ${C.borderBlu}` }}>
          <p className="text-xs font-bold uppercase tracking-widest mb-6" style={{ ...mono, color: C.muted }}>
            Status do produto · Maio 2026
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {STATUS_SUMMARY.map(s => (
              <div key={s.label}>
                <div className="flex justify-between items-center mb-1.5">
                  <span className="text-sm" style={{ color: C.text }}>{s.label}</span>
                  <span className="text-xs font-bold" style={{ ...mono, color: s.color }}>{s.pct}%</span>
                </div>
                <div className="h-1.5 rounded-full overflow-hidden" style={{ background: '#2d3449' }}>
                  <div className="h-full rounded-full transition-all" style={{ width: `${s.pct}%`, background: s.color }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Timeline */}
        <div className="space-y-16">
          {PHASES.map((phase, pi) => (
            <div key={phase.id}>
              {/* Phase header */}
              <div className="flex items-center gap-4 mb-8">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center font-black text-sm shrink-0"
                  style={{ ...mono, background: `${phase.color}20`, color: phase.color, border: `1px solid ${phase.color}35` }}>
                  {phase.label.replace('Fase ', '')}
                </div>
                <div className="flex-1 h-px" style={{ background: `${phase.color}30` }} />
                <div>
                  <div className="flex items-center gap-3">
                    <h2 className="text-2xl font-black" style={{ letterSpacing: '-0.02em' }}>{phase.title}</h2>
                    <span className="text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full"
                      style={{ ...mono, background: `${phase.color}15`, color: phase.color, border: `1px solid ${phase.color}25` }}>
                      {phase.period}
                    </span>
                  </div>
                </div>
              </div>

              {/* Groups */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {phase.groups.map(group => (
                  <div key={group.title} className="rounded-xl p-5"
                    style={{ background: C.bgCard2, border: `1px solid ${C.borderBlu}` }}>
                    <p className="text-xs font-bold uppercase tracking-wider mb-4" style={{ ...mono, color: phase.color }}>
                      {group.title}
                    </p>
                    <ul className="space-y-2.5">
                      {group.items.map(item => (
                        <li key={item} className="flex items-start gap-2.5 text-sm" style={{ color: phase.status === 'done' ? C.text : C.muted }}>
                          <span className="material-symbols-outlined text-[14px] shrink-0 mt-0.5"
                            style={{ color: phase.color, fontVariationSettings: phase.status === 'done' ? "'FILL' 1" : "'FILL' 0" }}>
                            {phase.status === 'done' ? 'check_circle' : phase.status === 'next' ? 'radio_button_unchecked' : 'circle'}
                          </span>
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* CTA */}
        <div className="mt-20 text-center rounded-2xl p-10"
          style={{ background: C.bgCard, border: `1px solid ${C.borderBlu}` }}>
          <p className="text-xs font-bold uppercase tracking-widest mb-4" style={{ ...mono, color: C.muted }}>
            Tem sugestões?
          </p>
          <h3 className="text-3xl font-black mb-3" style={{ letterSpacing: '-0.02em' }}>
            Ajude a definir o roadmap.
          </h3>
          <p className="text-base mb-8" style={{ color: C.muted }}>
            Somos movidos pelo feedback dos nossos clientes. Diga o que é mais importante para o seu negócio.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <a href="mailto:contato@qomanda.com.br"
              className="flex items-center gap-2 px-8 py-4 rounded-xl font-bold text-sm transition-all hover:opacity-90"
              style={{ background: C.primary, color: '#582200' }}>
              <span className="material-symbols-outlined text-[18px]">mail</span>
              Enviar feedback
            </a>
            <Link href="/cadastro"
              className="flex items-center gap-2 px-8 py-4 rounded-xl font-bold text-sm transition-all hover:opacity-80"
              style={{ background: 'transparent', border: `1px solid ${C.border}`, color: C.text }}>
              Começar grátis
            </Link>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="py-8 px-6 text-center" style={{ borderTop: `1px solid ${C.border}` }}>
        <p className="text-xs" style={{ ...mono, color: C.faint }}>
          © 2025 Qomanda · <a href="mailto:contato@qomanda.com.br" className="hover:opacity-80">contato@qomanda.com.br</a>
        </p>
      </footer>
    </div>
  )
}
