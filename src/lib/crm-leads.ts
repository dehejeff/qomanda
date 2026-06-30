export type RestaurantType = 'salao' | 'balcao' | 'salao_balcao' | 'food_hall'

export type LeadStatus =
  | 'novo'
  | 'contato_feito'
  | 'demo_agendada'
  | 'proposta_enviada'
  | 'negociacao'
  | 'fechado_ganho'
  | 'fechado_perdido'

export type Lead = {
  id: string
  name: string
  whatsapp: string
  email: string | null
  restaurantName: string
  restaurantType: RestaurantType
  status: LeadStatus
  notes: string | null
  source: string
  createdAt: string
  updatedAt: string
}

export const RESTAURANT_TYPE_LABELS: Record<RestaurantType, string> = {
  salao: 'Salão com mesas',
  balcao: 'Balcão / Fast food',
  salao_balcao: 'Salão + Balcão',
  food_hall: 'Food Hall / Praça',
}

export const LEAD_STATUSES: { value: LeadStatus; label: string; color: string }[] = [
  { value: 'novo',              label: 'Novo',               color: '#8B949E' },
  { value: 'contato_feito',     label: 'Contato feito',      color: '#3b82f6' },
  { value: 'demo_agendada',     label: 'Demo agendada',      color: '#8b5cf6' },
  { value: 'proposta_enviada',  label: 'Proposta enviada',   color: '#f59e0b' },
  { value: 'negociacao',        label: 'Negociação',         color: '#00E676' },
  { value: 'fechado_ganho',     label: 'Fechado — Ganho',    color: '#22c55e' },
  { value: 'fechado_perdido',   label: 'Fechado — Perdido',  color: '#ef4444' },
]

export function isLeadStatus(v: string): v is LeadStatus {
  return LEAD_STATUSES.some(s => s.value === v)
}

export function isRestaurantType(v: string): v is RestaurantType {
  return Object.keys(RESTAURANT_TYPE_LABELS).includes(v)
}

export function mapLeadRow(row: Record<string, unknown>): Lead {
  return {
    id:             String(row.id ?? ''),
    name:           String(row.name ?? ''),
    whatsapp:       String(row.whatsapp ?? ''),
    email:          row.email != null ? String(row.email) : null,
    restaurantName: String(row.restaurant_name ?? ''),
    restaurantType: (row.restaurant_type as RestaurantType) ?? 'salao',
    status:         (row.status as LeadStatus) ?? 'novo',
    notes:          row.notes != null ? String(row.notes) : null,
    source:         String(row.source ?? 'qr'),
    createdAt:      String(row.created_at ?? ''),
    updatedAt:      String(row.updated_at ?? ''),
  }
}

export function getStatusMeta(status: LeadStatus) {
  return LEAD_STATUSES.find(s => s.value === status) ?? LEAD_STATUSES[0]
}
