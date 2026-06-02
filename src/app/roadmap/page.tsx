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

/** Ordem planejada de integração — mesma sequência do ROADMAP.md */
const GATEWAY_ORDER = [
  { order: 1, name: 'PIX manual', methods: 'PIX', connection: 'Chave PIX do restaurante + confirmação no painel', when: 'Disponível', status: 'done' as const },
  { order: 2, name: 'Dinheiro', methods: 'Cash', connection: 'Cliente informa · garçom/caixa confirma', when: 'Disponível', status: 'done' as const },
  { order: 3, name: 'Asaas', methods: 'PIX, crédito, débito', connection: 'API key da conta Asaas do restaurante', when: 'Disponível', status: 'done' as const },
  { order: 4, name: 'Mercado Pago', methods: 'PIX, crédito, débito', connection: 'OAuth / credenciais do vendedor (conta MP)', when: 'Q4 2026', status: 'planned' as const },
  { order: 5, name: 'PagBank', methods: 'PIX, crédito', connection: 'Conta PagSeguro / PagBank do restaurante', when: 'Q1 2027', status: 'planned' as const },
  { order: 6, name: 'Stone', methods: 'PIX, crédito', connection: 'API e-commerce / link Stone', when: '2027', status: 'planned' as const },
  { order: 7, name: 'Cielo', methods: 'Crédito, débito', connection: 'Checkout Cielo / API', when: '2027', status: 'planned' as const },
  { order: 8, name: 'Getnet', methods: 'PIX, crédito', connection: 'Sob demanda (enterprise)', when: 'Backlog', status: 'backlog' as const },
]

const RESTAURANT_MODELS_ROADMAP = [
  { name: 'Salão com mesas', status: 'done' as const, note: 'QR mesa · garçom · checkout' },
  { name: 'Balcão / fast food', status: 'done' as const, note: 'Pedido # · link /balcao' },
  { name: 'Salão + balcão', status: 'done' as const, note: 'Ambos fluxos' },
  { name: 'Food hall / praça', status: 'done' as const, note: 'Igual balcão — pedido # · link /balcao' },
  { name: 'Rodízio / taxa fixa', status: 'planned' as const, note: 'Em breve' },
  { name: 'Buffet por peso', status: 'planned' as const, note: 'Em breve' },
]

const PHASES = [
  {
    id: 'proximas',
    label: 'Agora',
    title: 'Próximas etapas — Go-live piloto',
    status: 'next',
    color: C.red,
    period: 'Imediato',
    groups: [
      {
        title: 'Infra & validação',
        items: [
          'Rodar migrações Supabase (portal, conta restaurante, PIX manual, modelos)',
          'Smoke test: cadastro com modelo → PIX manual → pedido → confirmação',
          'Deploy do build (PIX manual, balcão, presets, onboarding)',
        ],
      },
      {
        title: 'P0 — Operação no salão',
        items: [
          'App garçom mobile (/garcom) — pedidos, pagamentos, mesas, benefícios, fechar mesa ✓',
          'Garçom confirma PIX manual + dinheiro (/garcom/pagamentos) ✓',
          'Alerta de pagamento pendente na fila de pedidos ✓',
          'Aba Mensalidade no dashboard (histórico + fatura aberta) ✓',
        ],
      },
      {
        title: 'P1 — Comercial & interno',
        items: [
          'Modelo operacional no portal interno (/internal/clients/new)',
          'Landing e roadmap alinhados (modelos + comissão mensal) ✓',
        ],
      },
    ],
  },
  {
    id: 'gateways',
    label: 'Pagamentos',
    title: 'Gateways — ordem de integração',
    status: 'planned',
    color: C.amber,
    period: 'v1 disponível · v2 em diante',
    groups: [
      {
        title: 'Regra em todos',
        items: [
          '100% do valor na conta do restaurante',
          'Comissão Qomanda faturada todo dia 5 (sem split na hora)',
          'Um gateway ativo por restaurante no Settings',
        ],
      },
      {
        title: 'Próximo na fila',
        items: [
          '4 · Mercado Pago — OAuth, PIX + cartão (Q4 2026)',
          '5 · PagBank — conta PagSeguro (Q1 2027)',
          '6 · Stone — API e-commerce (2027)',
          '7 · Cielo — checkout crédito/débito (2027)',
          '8 · Getnet — backlog enterprise',
        ],
      },
      {
        title: 'Arquitetura',
        items: [
          'Interface PaymentProvider unificada',
          'Webhooks → confirmPaymentRecord + comissão',
          'Credenciais criptografadas por restaurante',
        ],
      },
    ],
  },
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
          'Check-in + QR por mesa com token único anti-fraude',
          'PIN de 4 dígitos; setup para contas legadas',
          'Home com status de pedido em tempo real',
          'Cardápio com fotos, promoções e sugestão do chef',
          'Pedidos, checkout e divisão de conta',
          'Pagamento PIX, débito, crédito e dinheiro (confirmação pelo restaurante)',
          'Perfil — encerrar mesa e acesso ao Hub',
          'Hub do cliente: visitas, recibos, cartões, fidelidade',
        ],
      },
      {
        title: 'Painel Administrativo',
        items: [
          'Overview em tempo real (mesas, pedidos, receita)',
          'QR Code por mesa — download e impressão com número visível',
          'Cardápio — criar/editar, foto, promo, sugestão do chef',
          'Fila de pedidos em tempo real (kanban)',
          'Confirmar pagamento em dinheiro (mesa e pedidos da mesa)',
          'Settings: Pagamentos, Fidelidade e Integrações (WhatsApp)',
          'Cadastro de conta bancária de repasse (Qomanda Pay)',
          'Suporte — tickets com mensagens e anexos',
          'Segurança: senha de cartão, sessão idle 15 min',
        ],
      },
      {
        title: 'Recebimento na conta do restaurante',
        items: [
          'PIX manual (chave do restaurante) — sem Asaas obrigatório',
          'Asaas na conta do restaurante (PIX e cartão automáticos)',
          'Dinheiro na mesa — 0% comissão Qomanda',
          'Comissão progressiva faturada mensalmente (dia 5)',
          'Webhook de confirmação de pagamentos',
        ],
      },
      {
        title: 'Institucional',
        items: [
          'Landing page e roadmap público',
          'Termos de Uso e Política de Privacidade (LGPD)',
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
    period: 'Próximo · Junho 2026',
    groups: [
      {
        title: '1 · Recebimento & comissão',
        items: [
          'PIX manual + Asaas (conta do restaurante) ✓',
          'Comissão mensal sobre GMV digital — fatura dia 5 ✓',
          'Modo balcão + pedido # ✓',
          'Garçom confirma PIX/dinheiro no painel (P0)',
          'Fatura automática dia 5 (boleto/PIX Qomanda)',
        ],
      },
      {
        title: '2 · Notas fiscais',
        items: [
          'Cadastro NF-e ao consumidor (Focus NFe) — configuração ✓',
          'WhatsApp para envio de NF-e — configuração pelo restaurante ✓',
          'Emissão automática após pagamento confirmado',
          'NF-e de serviço Qomanda → restaurante (mensalidade + comissão)',
          'Histórico pagamento ↔ nota fiscal',
        ],
      },
      {
        title: '3 · Operação',
        items: [
          'Suporte com tickets — restaurante e equipe Qomanda ✓',
          'Webhook de pagamentos robusto (retry, idempotência, logs)',
          'Botão "Chamar Garçom" — notificação no dashboard',
          'Cobrança automática de mensalidade SaaS',
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
        title: 'Onboarding do Restaurante',
        items: [
          'Cadastro com escolha de modelo (salão / balcão / ambos) ✓',
          'Preset automático + checklist no dashboard ✓',
          'Upload de logo do restaurante ✓',
          'Modelo no portal interno para pilotos (P1)',
        ],
      },
      {
        title: 'Fidelidade',
        items: [
          'Salvar regras no Supabase (atualmente UI only)',
          'Alerta no dashboard quando cliente atinge meta',
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
          'App Garçom — painel mobile para garçons e caixa',
          'Confirmar pagamentos em dinheiro na mesa (notificação + um toque)',
          'Ver pedidos das mesas e responder "Chamar Garçom"',
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
  { label: 'Cliente — Fluxo principal',     pct: 98, color: C.green  },
  { label: 'Cliente — Pagamento',           pct: 88, color: C.amber  },
  { label: 'Cliente — Hub & segurança',     pct: 90, color: C.green  },
  { label: 'Dashboard — Operação',          pct: 95, color: C.green  },
  { label: 'Dashboard — Cardápio & QR',     pct: 92, color: C.green  },
  { label: 'Dashboard — Suporte',           pct: 85, color: C.green  },
  { label: 'Gateways (manual + Asaas)', pct: 70, color: C.amber  },
  { label: 'Gateways (MP, PagBank, Stone…)', pct: 0, color: C.red    },
  { label: 'NF-e (emissão automática)',     pct: 25, color: C.red    },
  { label: 'Fidelidade',                    pct: 75, color: C.amber  },
  { label: 'WhatsApp (config + envio NF-e)', pct: 55, color: C.amber  },
  { label: 'Legal (Termos + Privacidade)',  pct: 100, color: C.green  },
  { label: 'Onboarding restaurante',        pct: 75, color: C.amber  },
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
          <Link href="/login?perfil=admin" className="hidden md:block text-sm transition-colors hover:opacity-80" style={{ ...mono, color: C.muted }}>Entrar</Link>
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

        {/* Ordem planejada — gateways #1–#8 (tabela completa) */}
        <div className="rounded-2xl p-6 mb-10 overflow-hidden" style={{ background: C.bgCard, border: `2px solid ${C.amber}40` }}>
          <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
            <div>
              <p className="text-xs font-bold uppercase tracking-widest mb-2" style={{ ...mono, color: C.amber }}>
                Pagamentos · Ordem planejada #1–#8
              </p>
              <h2 className="text-2xl font-black" style={{ letterSpacing: '-0.02em' }}>
                Esteira de gateways de integração
              </h2>
              <p className="text-sm mt-2 max-w-xl" style={{ color: C.muted }}>
                Sequência oficial #1–#8. Itens 1–3 já operacionais; 4–8 entram nesta ordem. Sempre na conta do restaurante — comissão Qomanda no dia 5.
              </p>
            </div>
          </div>
          <div className="overflow-x-auto rounded-xl" style={{ border: `1px solid ${C.borderBlu}` }}>
            <table className="w-full text-sm" style={{ minWidth: 640 }}>
              <thead>
                <tr style={{ background: C.bgCard2 }}>
                  <th className="text-left px-4 py-3 font-mono text-[10px] uppercase tracking-wider" style={{ color: C.muted }}>#</th>
                  <th className="text-left px-4 py-3 font-mono text-[10px] uppercase tracking-wider" style={{ color: C.muted }}>Gateway</th>
                  <th className="text-left px-4 py-3 font-mono text-[10px] uppercase tracking-wider hidden sm:table-cell" style={{ color: C.muted }}>Métodos</th>
                  <th className="text-left px-4 py-3 font-mono text-[10px] uppercase tracking-wider hidden md:table-cell" style={{ color: C.muted }}>Conexão</th>
                  <th className="text-left px-4 py-3 font-mono text-[10px] uppercase tracking-wider" style={{ color: C.muted }}>Previsão</th>
                </tr>
              </thead>
              <tbody>
                {GATEWAY_ORDER.map(row => (
                  <tr key={row.order} style={{ borderTop: `1px solid ${C.borderBlu}` }}>
                    <td className="px-4 py-3 font-mono font-bold" style={{ color: C.amber }}>{row.order}</td>
                    <td className="px-4 py-3 font-semibold" style={{ color: C.text }}>
                      {row.name}
                      {row.status === 'done' && (
                        <span className="ml-2 text-[10px] font-mono px-1.5 py-0.5 rounded" style={{ background: `${C.green}20`, color: C.green }}>ativo</span>
                      )}
                    </td>
                    <td className="px-4 py-3 hidden sm:table-cell" style={{ color: C.muted }}>{row.methods}</td>
                    <td className="px-4 py-3 hidden md:table-cell text-xs" style={{ color: C.muted }}>{row.connection}</td>
                    <td className="px-4 py-3 font-mono text-xs" style={{ color: row.status === 'done' ? C.green : C.amber }}>{row.when}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Modelos operacionais */}
        <div className="rounded-2xl p-6 mb-16" style={{ background: C.bgCard, border: `1px solid ${C.borderBlu}` }}>
          <p className="text-xs font-bold uppercase tracking-widest mb-2" style={{ ...mono, color: C.primary }}>
            Modelos operacionais
          </p>
          <h2 className="text-xl font-black mb-4">Tipos de restaurante no cadastro</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {RESTAURANT_MODELS_ROADMAP.map(m => (
              <div key={m.name} className="flex items-start gap-3 rounded-lg px-4 py-3"
                style={{ background: C.bgCard2, border: `1px solid ${C.borderBlu}` }}>
                <span className="material-symbols-outlined text-[18px] shrink-0 mt-0.5"
                  style={{ color: m.status === 'done' ? C.green : C.faint }}>
                  {m.status === 'done' ? 'check_circle' : 'schedule'}
                </span>
                <div>
                  <p className="text-sm font-semibold" style={{ color: C.text }}>{m.name}</p>
                  <p className="text-xs mt-0.5" style={{ color: C.muted }}>{m.note}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Progress overview */}
        <div className="rounded-2xl p-6 mb-16" style={{ background: C.bgCard, border: `1px solid ${C.borderBlu}` }}>
          <p className="text-xs font-bold uppercase tracking-widest mb-6" style={{ ...mono, color: C.muted }}>
            Status do produto · Junho 2026
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
        <div className="flex flex-wrap items-center justify-center gap-4 text-xs mb-3" style={{ ...mono, color: C.faint }}>
          <Link href="/termos" className="hover:opacity-80">Termos de uso</Link>
          <Link href="/privacidade" className="hover:opacity-80">Privacidade</Link>
          <a href="mailto:contato@qomanda.com.br" className="hover:opacity-80">contato@qomanda.com.br</a>
        </div>
        <p className="text-xs" style={{ ...mono, color: C.faint }}>
          © 2026 Qomanda · <a href="mailto:contato@qomanda.com.br" className="hover:opacity-80">contato@qomanda.com.br</a>
        </p>
      </footer>
    </div>
  )
}
