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
  { order: 4, name: 'Mercado Pago', methods: 'PIX, crédito, débito', connection: 'Access token da conta MP do restaurante', when: 'Disponível', status: 'done' as const },
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
    title: 'Go-live piloto — restante',
    status: 'next',
    color: C.red,
    period: 'Junho 2026',
    groups: [
      {
        title: 'Infra & validação',
        items: [
          'Smoke test E2E — salão, balcão, híbrido, food hall, garçom ✓',
          'Deploy contínuo na Vercel (qomanda-mu.vercel.app) ✓',
          'Rodar migrações Supabase pendentes em produção (se ainda não aplicadas)',
        ],
      },
      {
        title: 'P0 — Operação no salão',
        items: [
          'App garçom mobile (/garcom) — pedidos, pagamentos, mesas, benefícios ✓',
          'Garçom confirma PIX manual + dinheiro (/garcom/pagamentos) ✓',
          'Check-in por QR — scanner mobile, redirect e retomada de sessão ✓',
          'Modo operacional (salão/balcão/ambos) salvo e refletido no Overview ✓',
        ],
      },
      {
        title: 'P1 — Comercial & interno',
        items: [
          'Modelo operacional no portal interno (/internal/clients) ✓',
          'Landing e roadmap alinhados (modelos + comissão mensal) ✓',
          'Busca no header do dashboard (filtra pedidos) ✓',
          'Checklist piloto 5 restaurantes (/pilotos) ✓',
          'Plano interno 5 anos + motor comercial 8–10/mês (/plano-interno) ✓',
          'Materiais de vendas e entrega (/materiais-vendas · /materiais-entrega) ✓',
          'Flow A reserva de grupo no grid Mesas + smoke group-reserve ✓',
          'Teste de carga 10×20 (npm run load:10x20) ✓',
          'Migrações fila allocations + notify-contacts — rodar em prod',
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
          '5 · PagBank — conta PagSeguro (Q1 2027)',
          '6 · Stone — API e-commerce (2027)',
          '7 · Cielo — checkout crédito/débito (2027)',
          '8 · Getnet — backlog enterprise',
          'OAuth Mercado Pago (hoje: access token manual)',
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
          'Scanner QR (html5-qrcode) + redirect check-in (/api/checkin/redirect)',
          'Check-in + QR por mesa com token único anti-fraude',
          'Retomada de sessão e check-in rápido para clientes recorrentes',
          'PIN de 4 dígitos; setup para contas legadas',
          'Home com status de pedido em tempo real',
          'Cardápio com fotos, promoções e sugestão do chef',
          'Pedidos, checkout e divisão de conta',
          'Pagamento PIX (manual, Asaas, Mercado Pago), cartão e dinheiro',
          'Perfil — encerrar mesa e acesso ao Hub',
          'Hub do cliente: visitas, recibos, cartões, fidelidade',
        ],
      },
      {
        title: 'Painel Administrativo',
        items: [
          'Overview em tempo real — adaptado ao modo (salão / balcão / ambos)',
          'Modo operacional em Settings → Pagamentos (sincroniza restaurant_model)',
          'QR Code por mesa — download e impressão com número visível',
          'Cardápio — criar/editar, foto, promo, sugestão do chef',
          'Fila de pedidos em tempo real (kanban) + busca no header',
          'Confirmar pagamento em dinheiro (mesa e pedidos da mesa)',
          'Settings: Pagamentos, Mensalidade, Fidelidade, Integrações (WhatsApp)',
          'Checklist “Primeiros passos” no Overview',
          'Cadastro de conta bancária de repasse (Qomanda Pay)',
          'Suporte — tickets com mensagens e anexos',
          'Segurança: senha de cartão, sessão idle 15 min',
        ],
      },
      {
        title: 'App Garçom (/garcom)',
        items: [
          'Pedidos, pagamentos, mesas e benefícios de fidelidade',
          'Confirmar PIX manual e dinheiro na mesa',
          'Fechar mesa e alertas de pagamento pendente',
        ],
      },
      {
        title: 'Recebimento na conta do restaurante',
        items: [
          'PIX manual (chave do restaurante) — sem Asaas obrigatório',
          'Asaas na conta do restaurante (PIX e cartão automáticos)',
          'Mercado Pago — access token + PIX/cartão no checkout',
          'Dinheiro na mesa — 0% comissão Qomanda',
          'Comissão progressiva faturada mensalmente (dia 5)',
          'Cobrança automática da mensalidade SaaS (cron dia 5)',
          'Webhook de confirmação de pagamentos',
        ],
      },
      {
        title: 'Notas fiscais (v1)',
        items: [
          'Cadastro NF-e (Focus NFe) — portal interno + Settings',
          'Emissão automática após pagamento (adapter + modo simulado)',
          'Envio da NF-e ao cliente via WhatsApp (quando habilitado)',
          'Cliente baixa NF-e no Hub de recibos',
          'Aba Notas Fiscais no painel do restaurante',
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
          'PIX manual + Asaas + Mercado Pago (conta do restaurante) ✓',
          'Comissão mensal sobre GMV digital — fatura dia 5 ✓',
          'Modo balcão + pedido # ✓',
          'Garçom confirma PIX/dinheiro no app (/garcom) ✓',
          'Cobrança automática mensalidade SaaS (cron dia 5) ✓',
          'NF-e de serviço Qomanda → restaurante (junto com fatura)',
        ],
      },
      {
        title: '2 · Notas fiscais',
        items: [
          'Cadastro NF-e ao consumidor (Focus NFe) — configuração ✓',
          'WhatsApp para envio de NF-e — configuração pelo restaurante ✓',
          'Emissão automática após pagamento confirmado ✓ (simulado/homologação)',
          'Cliente visualiza e baixa NF-e no Hub ✓',
          'Emissão real Focus NFe em produção (token homologação/produção)',
          'Histórico pagamento ↔ nota fiscal no painel ✓',
        ],
      },
      {
        title: '3 · Operação',
        items: [
          'Suporte com tickets — restaurante e equipe Qomanda ✓',
          'Webhook de pagamentos robusto (retry, idempotência, logs)',
          'Botão "Chamar Garçom" — notificação no dashboard',
          'OAuth connect Mercado Pago (substituir token manual)',
        ],
      },
    ],
  },
  {
    id: 'infra',
    label: 'Infra',
    title: 'Infraestrutura & escala',
    status: 'next',
    color: C.amber,
    period: 'Piloto → 100+ restaurantes',
    groups: [
      {
        title: 'Decisão — manter Vercel + Supabase',
        items: [
          'App Next.js na Vercel Pro — escala HTTP/SSR automaticamente',
          'Supabase Pro (sa-east-1) — Postgres, Auth, Realtime, Storage',
          'Gargalo atual: NF-e + WhatsApp síncronos no confirm-payment, não a Vercel',
        ],
      },
      {
        title: 'Fase 0 — Agora (~20 restaurantes)',
        items: [
          'Supabase Pro + região sa-east-1 + connection pooler (Supavisor)',
          'Fila assíncrona — NF-e (Focus) e WhatsApp fora do request de pagamento',
          'Webhooks idempotentes — Asaas e Mercado Pago (event_id + fila)',
          'Sentry + alertas em erro 5xx (API routes e jobs)',
          'Runbook — pagamento OK mesmo se NF-e/WhatsApp atrasarem',
        ],
      },
      {
        title: 'Fase 1 — Crescimento (~100 restaurantes)',
        items: [
          'Upstash Redis — rate limit, cache de cardápio, locks',
          'WhatsApp em fila com throttle por restaurante (limites Meta)',
          'Teste de carga — 10 restaurantes × 20 mesas em paralelo',
          'Monitoramento Postgres — índices, CPU, conexões',
        ],
      },
      {
        title: 'Fase 2 — Escala (100+ restaurantes)',
        items: [
          'Workers dedicados (Railway/Fly) se fila + Vercel limitarem',
          'Postgres dedicado (Neon/RDS) se Supabase atingir teto',
          'Read replica / warehouse para analytics pesado',
        ],
      },
      {
        title: 'Fora do escopo imediato',
        items: [
          'Kubernetes ou VPS única “por segurança”',
          'Microserviços separados (pedidos, pagamentos, NF-e)',
          'Multi-cloud desde o dia 1',
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
          'Cadastro com escolha de modelo (salão / balcão / ambos / food hall) ✓',
          'Preset automático + checklist no dashboard ✓',
          'Modo operacional editável em Settings → Pagamentos ✓',
          'Upload de logo do restaurante ✓',
          'Modelo no portal interno para pilotos ✓',
        ],
      },
      {
        title: 'Fidelidade',
        items: [
          'Regras salvas no Supabase (loyalty_rules) ✓',
          'Benefícios visíveis ao garçom (/garcom/beneficios) ✓',
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
          'App Garçom mobile (/garcom) — pedidos, pagamentos, mesas ✓',
          'Confirmar PIX manual e dinheiro na mesa ✓',
          'Gestão de equipe — convite de garçons (Settings → Equipe) ✓',
          'Receber e responder alertas "Chamar Garçom"',
          'Controle de acesso refinado por perfil',
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
          'PWA instalável (manifest + service worker) — parcial',
          'Sistema de reservas com confirmação via WhatsApp',
          'Multi-cardápio por turno (almoço / jantar)',
          'Reembolsos e disputas no painel',
        ],
      },
    ],
  },
]

const STATUS_SUMMARY = [
  { label: 'Cliente — Fluxo principal',     pct: 99, color: C.green  },
  { label: 'Cliente — Pagamento',           pct: 92, color: C.green  },
  { label: 'Cliente — Hub & segurança',     pct: 90, color: C.green  },
  { label: 'Dashboard — Operação',          pct: 96, color: C.green  },
  { label: 'Dashboard — Cardápio & QR',     pct: 94, color: C.green  },
  { label: 'App Garçom (/garcom)',          pct: 95, color: C.green  },
  { label: 'Dashboard — Suporte',           pct: 85, color: C.green  },
  { label: 'Gateways (#1–4 disponíveis)',   pct: 85, color: C.green  },
  { label: 'Gateways (#5–8 planejados)',    pct: 0, color: C.red    },
  { label: 'NF-e (emissão automática)',     pct: 65, color: C.amber  },
  { label: 'Fidelidade',                    pct: 90, color: C.green  },
  { label: 'WhatsApp (config + envio NF-e)', pct: 60, color: C.amber  },
  { label: 'Onboarding restaurante',        pct: 92, color: C.green  },
  { label: 'Infraestrutura & escala',       pct: 20, color: C.amber  },
  { label: 'Observabilidade (Sentry)',      pct: 10, color: C.red    },
  { label: 'Legal (Termos + Privacidade)',  pct: 100, color: C.green  },
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
                Sequência oficial #1–#8. Itens 1–4 operacionais (PIX manual, dinheiro, Asaas, Mercado Pago); 5–8 entram nesta ordem. Sempre na conta do restaurante — comissão Qomanda no dia 5.
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
            Status do produto · Junho 2026 (atualizado 03/06)
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
          <Link href="/pilotos" className="hover:opacity-80">Piloto (5 restaurantes)</Link>
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
