import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireOwnerAccess, RestaurantAuthError } from '@/lib/restaurant-auth'
import {
  NFE_PROFILE_SELECT,
  nfeFieldsToDb,
  nfeProfileFromRow,
  validateRestaurantNfe,
  NFE_STATUS_LABEL,
  type RestaurantNfeInput,
  type RestaurantNfeProfile,
} from '@/lib/restaurant-nfe'

export type NfeIntegrationDto = RestaurantNfeProfile & {
  documentType: 'cpf' | 'cnpj' | null
  documentNumber: string | null
  statusLabel: string
}

function nfeIntegrationDto(
  row: Record<string, unknown>,
  documentType: 'cpf' | 'cnpj' | null,
  documentNumber: string | null,
): NfeIntegrationDto {
  const profile = nfeProfileFromRow(row)
  return {
    ...profile,
    documentType,
    documentNumber,
    statusLabel: NFE_STATUS_LABEL[profile.nfe_status],
  }
}

/**
 * GET /api/dashboard/integrations/nfe
 */
export async function GET() {
  try {
    const access = await requireOwnerAccess()
    const admin = createAdminClient()

    const { data: restaurant } = await admin
      .from('restaurants')
      .select(`${NFE_PROFILE_SELECT}, document_type, document_number`)
      .eq('id', access.restaurantId)
      .single()

    if (!restaurant) {
      return NextResponse.json({ error: 'Restaurante não encontrado.' }, { status: 404 })
    }

    const nfe = nfeIntegrationDto(
      restaurant as Record<string, unknown>,
      (restaurant.document_type as 'cpf' | 'cnpj' | null) ?? null,
      restaurant.document_number ?? null,
    )

    return NextResponse.json({ nfe })
  } catch (err) {
    if (err instanceof RestaurantAuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    console.error('[NFe integration GET]', err)
    return NextResponse.json({ error: 'Erro ao carregar NF-e.' }, { status: 500 })
  }
}

/**
 * POST /api/dashboard/integrations/nfe
 */
export async function POST(req: NextRequest) {
  try {
    const access = await requireOwnerAccess()
    const body = (await req.json()) as RestaurantNfeInput
    const admin = createAdminClient()

    const { data: existing } = await admin
      .from('restaurants')
      .select('id, document_type, nfe_provider_token_encrypted')
      .eq('id', access.restaurantId)
      .single()

    if (!existing) {
      return NextResponse.json({ error: 'Restaurante não encontrado.' }, { status: 404 })
    }

    const nfeError = validateRestaurantNfe(body, existing.document_type)
    if (nfeError) {
      return NextResponse.json({ error: nfeError }, { status: 400 })
    }

    // Token só obrigatório com status Ativo (em Pendente o fluxo simulado funciona sem token).
    if (body.nfeStatus === 'active' && !body.nfeProviderToken?.trim() && !existing.nfe_provider_token_encrypted) {
      return NextResponse.json(
        { error: 'Informe o token do provedor (Focus NFe, NFe.io, etc.) para ativar a emissão.' },
        { status: 400 },
      )
    }

    const patch = nfeFieldsToDb(body, existing.nfe_provider_token_encrypted, existing.document_type)

    const { error: updateErr } = await admin
      .from('restaurants')
      .update(patch)
      .eq('id', access.restaurantId)

    if (updateErr) {
      console.error('[NFe integration POST]', updateErr)
      return NextResponse.json({ error: 'Erro ao salvar NF-e.' }, { status: 500 })
    }

    const { data: refreshed } = await admin
      .from('restaurants')
      .select(`${NFE_PROFILE_SELECT}, document_type, document_number`)
      .eq('id', access.restaurantId)
      .single()

    const nfe = nfeIntegrationDto(
      (refreshed ?? {}) as Record<string, unknown>,
      (refreshed?.document_type as 'cpf' | 'cnpj' | null) ?? null,
      refreshed?.document_number ?? null,
    )

    const message = nfe.nfe_status === 'active'
      ? 'NF-e ativa! As notas serão emitidas após cada pagamento confirmado.'
      : nfe.nfe_enabled
        ? 'Configuração de NF-e salva.'
        : 'NF-e desativada.'

    return NextResponse.json({ ok: true, message, nfe })
  } catch (err) {
    if (err instanceof RestaurantAuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    console.error('[NFe integration POST]', err)
    return NextResponse.json({ error: 'Erro ao salvar NF-e.' }, { status: 500 })
  }
}
