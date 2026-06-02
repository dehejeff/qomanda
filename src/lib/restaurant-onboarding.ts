import type { SupabaseClient } from '@supabase/supabase-js'
import { getRestaurantModel, type RestaurantModelId } from '@/lib/restaurant-models'
import { loadRestaurantGateway } from '@/lib/restaurant-gateway'

export type OnboardingCheckItem = {
  id: string
  label: string
  done: boolean
  href?: string
  optional?: boolean
}

export type OnboardingState = {
  modelId: RestaurantModelId | null
  modelName: string | null
  progressPercent: number
  items: OnboardingCheckItem[]
  completed: boolean
  primaryLinks: { label: string; href: string }[]
}

export async function computeRestaurantOnboarding(
  admin: SupabaseClient,
  restaurantId: string,
): Promise<OnboardingState> {
  const { data: restaurant } = await admin
    .from('restaurants')
    .select('restaurant_model, operational_mode, slug, onboarding_completed_at')
    .eq('id', restaurantId)
    .single()

  const modelId = (restaurant?.restaurant_model as RestaurantModelId | null) ?? null
  const model = getRestaurantModel(modelId)
  const slug = restaurant?.slug ?? ''

  const [gateway, menuRes, tablesRes, membersRes] = await Promise.all([
    loadRestaurantGateway(admin, restaurantId),
    admin.from('menu_items').select('id', { count: 'exact', head: true }).eq('restaurant_id', restaurantId),
    admin.from('tables').select('id', { count: 'exact', head: true }).eq('restaurant_id', restaurantId),
    admin.from('restaurant_members').select('id', { count: 'exact', head: true }).eq('restaurant_id', restaurantId).eq('active', true),
  ])

  const gatewayReady =
    (gateway.provider === 'manual' && gateway.manualConfigured)
    || (gateway.provider === 'asaas' && gateway.connected)

  const menuCount = menuRes.count ?? 0
  const tableCount = tablesRes.count ?? 0
  const needsTables = (model?.preset.seedTableCount ?? 0) > 0 || model?.preset.primaryEntry !== 'balcao'

  const items: OnboardingCheckItem[] = [
    {
      id: 'model',
      label: model ? `Modelo: ${model.name}` : 'Escolher modelo operacional',
      done: Boolean(modelId),
      href: modelId ? undefined : '/dashboard/settings',
    },
    {
      id: 'gateway',
      label: 'Configurar recebimento (PIX manual ou Asaas)',
      done: gatewayReady,
      href: '/dashboard/settings?tab=pagamentos',
    },
    {
      id: 'menu',
      label: 'Publicar cardápio (pelo menos 1 item)',
      done: menuCount > 0,
      href: '/dashboard/menu',
    },
  ]

  if (needsTables && restaurant?.operational_mode !== 'counter') {
    items.push({
      id: 'tables',
      label: 'Mesas cadastradas (QR Code)',
      done: tableCount > 0,
      href: '/dashboard/tables',
    })
  }

  if (model?.preset.primaryEntry === 'balcao') {
    items.push({
      id: 'balcao_link',
      label: 'Link do balcão testado',
      done: Boolean(slug),
      href: slug ? `/${slug}/balcao` : undefined,
    })
  } else if (model?.preset.primaryEntry === 'both') {
    items.push({
      id: 'balcao_link',
      label: 'Link do balcão testado',
      done: Boolean(slug),
      href: slug ? `/${slug}/balcao` : undefined,
    })
  }

  items.push({
    id: 'team',
    label: 'Convidar garçom (opcional)',
    done: (membersRes.count ?? 0) > 0,
    href: '/dashboard/settings?tab=equipe',
    optional: true,
  })

  const required = items.filter(i => !i.optional)
  const doneRequired = required.filter(i => i.done).length
  const progressPercent = required.length
    ? Math.round((doneRequired / required.length) * 100)
    : 0

  const completed = progressPercent >= 100 || Boolean(restaurant?.onboarding_completed_at)

  const primaryLinks: { label: string; href: string }[] = []
  if (slug) {
    if (model?.preset.primaryEntry === 'balcao') {
      primaryLinks.push({ label: 'Abrir balcão', href: `/${slug}/balcao` })
    } else if (model?.preset.primaryEntry === 'mesa_qr') {
      primaryLinks.push({ label: 'Ver mesas', href: '/dashboard/tables' })
    } else {
      primaryLinks.push({ label: 'Mesas', href: '/dashboard/tables' })
      primaryLinks.push({ label: 'Balcão', href: `/${slug}/balcao` })
    }
  }

  return {
    modelId,
    modelName: model?.name ?? null,
    progressPercent,
    items,
    completed,
    primaryLinks,
  }
}
