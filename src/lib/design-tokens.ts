/**
 * Qomanda Design System — fonte única de verdade para tokens visuais.
 * Importe estas constantes em todos os componentes em vez de escrever
 * classes Tailwind diretamente para garantir consistência.
 */

// ─────────────────────────────────────────────────────────────────────────────
// SUPERFÍCIES
// ─────────────────────────────────────────────────────────────────────────────
export const surface = {
  page:     'bg-background',               // #0b1326 — fundo de toda página
  base:     'bg-surface-container',        // #171f33 — cards, sidebar
  raised:   'bg-surface-container-high',   // #222a3d — table header, hover
  overlay:  'bg-surface-container-highest',// #2d3449 — tooltips, dropdowns
  inset:    'bg-surface-container-low',    // #131b2e — inputs, campos
} as const

// ─────────────────────────────────────────────────────────────────────────────
// BORDAS
// ─────────────────────────────────────────────────────────────────────────────
export const border = {
  default:  'border border-outline-variant',  // #584237 — borda padrão de card
  subtle:   'border border-outline-variant/50',
  active:   'border border-primary/30',       // laranja suave — item ativo/ocupado
} as const

// ─────────────────────────────────────────────────────────────────────────────
// TIPOGRAFIA
// ─────────────────────────────────────────────────────────────────────────────
export const text = {
  primary:   'text-on-surface',          // #dae2fd — texto principal
  secondary: 'text-on-surface-variant',  // #e0c0b1 — texto secundário/labels
  accent:    'text-primary',             // #ffb690 — laranja claro (links, valores)
  brand:     'text-primary-container',   // #f97316 — laranja sólido (CTAs)
  muted:     'text-on-surface-variant/60',
} as const

// ─────────────────────────────────────────────────────────────────────────────
// FONTES
// ─────────────────────────────────────────────────────────────────────────────
export const font = {
  heading: { fontFamily: 'Geist, sans-serif', letterSpacing: '-0.02em' },
  mono:    'font-mono',   // JetBrains Mono — labels, IDs, stats, badges
} as const

// ─────────────────────────────────────────────────────────────────────────────
// STATUS DE MESA  (usar em TODAS as páginas que exibem mesas)
// ─────────────────────────────────────────────────────────────────────────────
export const tableStatus = {
  free: {
    card:  'border border-outline-variant hover:border-primary cursor-pointer group',
    label: 'text-on-surface-variant group-hover:text-primary',
    dot:   'border border-outline-variant bg-transparent',
    legend: 'Livre',
    icon:  '',
  },
  occupied: {
    card:  'bg-primary-container border border-primary/30',
    label: 'text-on-primary-container',
    dot:   'bg-primary-container',
    legend: 'Ocupada',
    icon:  'person',
  },
  reserved: {
    card:  'bg-surface-container-highest/50 border border-outline-variant opacity-60',
    label: 'text-on-surface-variant',
    dot:   'bg-surface-container-highest',
    legend: 'Reservada',
    icon:  'event_busy',
  },
} as const

// ─────────────────────────────────────────────────────────────────────────────
// STATUS DE PEDIDO  (usar em TODAS as páginas que exibem pedidos)
// ─────────────────────────────────────────────────────────────────────────────
export const orderStatus = {
  pending: {
    label:  'Aguardando',
    next:   'Confirmar',
    badge:  'bg-amber-500/10 text-amber-400 border border-amber-500/20',
  },
  confirmed: {
    label:  'Confirmado',
    next:   'Preparar',
    badge:  'bg-blue-500/10 text-blue-400 border border-blue-500/20',
  },
  preparing: {
    label:  'Preparando',
    next:   'Pronto',
    badge:  'bg-amber-500/10 text-amber-400 border border-amber-500/20',
  },
  ready: {
    label:  'Pronto',
    next:   'Entregar',
    badge:  'bg-primary-container/20 text-primary border border-primary/30',
  },
  delivered: {
    label:  'Entregue',
    next:   '',
    badge:  'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20',
  },
  cancelled: {
    label:  'Cancelado',
    next:   '',
    badge:  'bg-error/10 text-error border border-error/20',
  },
} as const

// ─────────────────────────────────────────────────────────────────────────────
// STATUS DE SESSÃO  (app do cliente / garçom)
// ─────────────────────────────────────────────────────────────────────────────
export const sessionStatus = {
  open:    { label: 'Aberta',    badge: 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' },
  closing: { label: 'Fechando',  badge: 'bg-amber-500/10 text-amber-400 border border-amber-500/20' },
  closed:  { label: 'Encerrada', badge: 'bg-surface-container-highest text-on-surface-variant' },
} as const

// ─────────────────────────────────────────────────────────────────────────────
// STATUS DE PAGAMENTO
// ─────────────────────────────────────────────────────────────────────────────
export const paymentStatus = {
  pending:    { label: 'Pendente',    badge: 'bg-amber-500/10 text-amber-400 border border-amber-500/20' },
  processing: { label: 'Processando', badge: 'bg-blue-500/10 text-blue-400 border border-blue-500/20' },
  paid:       { label: 'Pago',        badge: 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' },
  failed:     { label: 'Falhou',      badge: 'bg-error/10 text-error border border-error/20' },
  refunded:   { label: 'Estornado',   badge: 'bg-surface-container-highest text-on-surface-variant' },
} as const

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENTES REUTILIZÁVEIS
// ─────────────────────────────────────────────────────────────────────────────

/** Card padrão do dashboard */
export const card = {
  base:    `${surface.base} ${border.default} rounded-xl`,
  tonal:   `tonal-layer-1 ghost-border rounded-xl`,  // cards de stats
} as const

/** Botões */
export const btn = {
  primary:   'bg-primary-container text-on-primary-container font-bold font-mono rounded-lg hover:opacity-90 transition-opacity',
  secondary: `${surface.raised} ${border.default} text-on-surface font-mono rounded-lg hover:bg-surface-variant transition-colors`,
  ghost:     'text-on-surface-variant hover:text-on-surface hover:bg-surface-container-highest rounded-lg transition-colors',
} as const

/** Inputs */
export const input = {
  base: `${surface.inset} ${border.default} text-on-surface placeholder:text-on-surface-variant font-mono rounded-lg focus:outline-none focus:ring-1 focus:ring-primary-container transition-all`,
} as const

/** Badge genérico — combine com os objetos de status acima */
export const badge = {
  base: 'text-[10px] font-bold font-mono uppercase px-2 py-0.5 rounded',
} as const

// ─────────────────────────────────────────────────────────────────────────────
// LAYOUT
// ─────────────────────────────────────────────────────────────────────────────
export const layout = {
  sidebarWidth:    '260px',
  headerHeight:    '64px',   // h-16
  contentPadding:  'pt-24 px-4 md:px-8 pb-24 md:pb-8',
  pageMaxWidth:    'max-w-6xl',
} as const
