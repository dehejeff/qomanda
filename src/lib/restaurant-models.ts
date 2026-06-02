/**
 * Modelos operacionais Qomanda — preset no cadastro deixa ~90% configurado.
 * Só falta gateway de pagamento (+ cardápio/mesas conforme o modelo).
 */

import type { SupabaseClient } from '@supabase/supabase-js'

export type RestaurantModelId =
  | 'salao'
  | 'balcao'
  | 'salao_balcao'
  | 'rodizio'
  | 'buffet_peso'
  | 'food_hall'

export type OperationalMode = 'dine_in' | 'counter' | 'both'

export type RestaurantModelStatus = 'available' | 'coming_soon'

export type RestaurantModelPreset = {
  operational_mode: OperationalMode
  payment_gateway_provider: 'manual' | 'asaas' | null
  marketplace_split_enabled: boolean
  /** Mesas criadas automaticamente no onboarding (salão) */
  seedTableCount: number
  /** URL principal que o cliente usa */
  primaryEntry: 'mesa_qr' | 'balcao' | 'both'
  features: string[]
}

export type RestaurantModelDef = {
  id: RestaurantModelId
  name: string
  tagline: string
  examples: string
  icon: string
  status: RestaurantModelStatus
  preset: RestaurantModelPreset
  /** Passos que o dono ainda precisa fazer após o cadastro */
  setupSteps: string[]
}

export const RESTAURANT_MODELS: RestaurantModelDef[] = [
  {
    id: 'salao',
    name: 'Salão com mesas',
    tagline: 'QR na mesa · garçom · conta dividida',
    examples: 'Restaurante, bistrô, pizzaria à la carte',
    icon: 'table_restaurant',
    status: 'available',
    preset: {
      operational_mode: 'dine_in',
      payment_gateway_provider: 'manual',
      marketplace_split_enabled: false,
      seedTableCount: 10,
      primaryEntry: 'mesa_qr',
      features: ['checkin_mesa', 'garcom', 'checkout_mesa', 'split_conta', 'dinheiro_manual'],
    },
    setupSteps: [
      'Cadastrar chave PIX (ou conectar Asaas)',
      'Publicar cardápio',
      'Imprimir QR das mesas',
      'Convidar garçons (opcional)',
    ],
  },
  {
    id: 'balcao',
    name: 'Balcão / fast food',
    tagline: 'Pedido # · retirada · paga na hora',
    examples: 'Hamburgueria, poke, café, lanchonete',
    icon: 'storefront',
    status: 'available',
    preset: {
      operational_mode: 'counter',
      payment_gateway_provider: 'manual',
      marketplace_split_enabled: false,
      seedTableCount: 0,
      primaryEntry: 'balcao',
      features: ['checkin_balcao', 'pedido_numero', 'status_pronto', 'pix_manual', 'dinheiro'],
    },
    setupSteps: [
      'Cadastrar chave PIX (ou conectar Asaas)',
      'Publicar cardápio',
      'Divulgar link do balcão (qomanda.app/seu-slug/balcao)',
    ],
  },
  {
    id: 'salao_balcao',
    name: 'Salão + balcão',
    tagline: 'Mesas no salão e fila no balcão',
    examples: 'Bar com mesas + balcão, restaurante com delivery no local',
    icon: 'layers',
    status: 'available',
    preset: {
      operational_mode: 'both',
      payment_gateway_provider: 'manual',
      marketplace_split_enabled: false,
      seedTableCount: 8,
      primaryEntry: 'both',
      features: ['checkin_mesa', 'checkin_balcao', 'garcom', 'pedido_numero', 'checkout_mesa'],
    },
    setupSteps: [
      'Cadastrar chave PIX (ou conectar Asaas)',
      'Publicar cardápio',
      'QR das mesas + link do balcão',
    ],
  },
  {
    id: 'rodizio',
    name: 'Rodízio / taxa fixa',
    tagline: 'Taxa por pessoa · bebidas à parte',
    examples: 'Churrascaria, japonês rodízio',
    icon: 'restaurant',
    status: 'coming_soon',
    preset: {
      operational_mode: 'dine_in',
      payment_gateway_provider: 'manual',
      marketplace_split_enabled: false,
      seedTableCount: 12,
      primaryEntry: 'mesa_qr',
      features: ['checkin_mesa', 'taxa_fixa_pessoa'],
    },
    setupSteps: ['Em desenvolvimento — use Salão com mesas por enquanto'],
  },
  {
    id: 'buffet_peso',
    name: 'Buffet por peso',
    tagline: 'Pesa no caixa · R$/kg',
    examples: 'Restaurante por quilo, self-service',
    icon: 'scale',
    status: 'coming_soon',
    preset: {
      operational_mode: 'counter',
      payment_gateway_provider: 'manual',
      marketplace_split_enabled: false,
      seedTableCount: 0,
      primaryEntry: 'balcao',
      features: ['balanca', 'preco_kg'],
    },
    setupSteps: ['Em desenvolvimento — use Balcão por enquanto'],
  },
  {
    id: 'food_hall',
    name: 'Food hall / praça',
    tagline: 'Praça de alimentação · pedido # · retirada',
    examples: 'Shopping, mercado gastronômico, praça de alimentação',
    icon: 'domain',
    status: 'available',
    preset: {
      operational_mode: 'counter',
      payment_gateway_provider: 'manual',
      marketplace_split_enabled: false,
      seedTableCount: 0,
      primaryEntry: 'balcao',
      features: ['checkin_balcao', 'pedido_numero', 'status_pronto', 'pix_manual', 'dinheiro', 'cardapio_unificado'],
    },
    setupSteps: [
      'Cadastrar chave PIX (ou conectar Asaas)',
      'Publicar cardápio (todas as cozinhas/estações)',
      'Divulgar link do balcão (qomanda.app/seu-slug/balcao)',
    ],
  },
]

export function getRestaurantModel(id: RestaurantModelId | string | null | undefined): RestaurantModelDef | null {
  if (!id) return null
  return RESTAURANT_MODELS.find(m => m.id === id) ?? null
}

export function getAvailableRestaurantModels(): RestaurantModelDef[] {
  return RESTAURANT_MODELS.filter(m => m.status === 'available')
}

/** Campos aplicados na criação do restaurante a partir do modelo escolhido. */
export function restaurantModelPresetToDb(modelId: RestaurantModelId): Record<string, unknown> {
  const model = getRestaurantModel(modelId)
  if (!model) throw new Error(`Modelo inválido: ${modelId}`)

  return {
    restaurant_model: modelId,
    operational_mode: model.preset.operational_mode,
    payment_gateway_provider: model.preset.payment_gateway_provider,
    marketplace_split_enabled: model.preset.marketplace_split_enabled,
  }
}

export async function seedDefaultTablesForModel(
  admin: SupabaseClient,
  restaurantId: string,
  modelId: RestaurantModelId,
): Promise<void> {
  const model = getRestaurantModel(modelId)
  const count = model?.preset.seedTableCount ?? 0
  if (count <= 0) return

  const rows = Array.from({ length: count }, (_, i) => ({
    restaurant_id: restaurantId,
    number: String(i + 1),
    status: 'free',
  }))

  const { error } = await admin.from('tables').insert(rows)
  if (error) {
    console.error('[Seed tables]', error)
  }
}
