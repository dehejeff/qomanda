import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireOwnerAccess, RestaurantAuthError } from '@/lib/restaurant-auth'
import { emitNfeForPayment } from '@/lib/nfe/emit-nfe'

/**
 * POST /api/dashboard/nfe/emit  { paymentId }
 * Emissão manual de NF-e para um pagamento (retry / quando auto-emit está off).
 * Restrito ao dono; valida que o pagamento é do restaurante autenticado.
 */
export async function POST(req: NextRequest) {
  try {
    const access = await requireOwnerAccess()
    const { paymentId } = await req.json() as { paymentId?: string }
    if (!paymentId) return NextResponse.json({ error: 'paymentId obrigatório.' }, { status: 400 })

    const admin = createAdminClient()
    const { data: payment } = await admin
      .from('payments')
      .select('id, restaurant_id')
      .eq('id', paymentId)
      .maybeSingle()

    if (!payment || payment.restaurant_id !== access.restaurantId) {
      return NextResponse.json({ error: 'Pagamento não encontrado.' }, { status: 404 })
    }

    const outcome = await emitNfeForPayment(admin, paymentId, { manual: true })
    if (!outcome.emitted && outcome.reason && outcome.reason !== 'already_emitted') {
      const msg = MESSAGES[outcome.reason] ?? 'Não foi possível emitir a nota.'
      return NextResponse.json({ error: msg, reason: outcome.reason }, { status: 400 })
    }
    return NextResponse.json({ ok: true, ...outcome })
  } catch (err) {
    if (err instanceof RestaurantAuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    console.error('[NFe emit]', err)
    return NextResponse.json({ error: 'Erro ao emitir nota.' }, { status: 500 })
  }
}

const MESSAGES: Record<string, string> = {
  nfe_not_active: 'NF-e não está ativa. Configure o emissor em Settings.',
  note_type_not_set: 'Defina o tipo de nota (NFC-e ou NFS-e) na configuração de NF-e.',
  payment_not_paid: 'O pagamento ainda não foi confirmado.',
  payment_not_found: 'Pagamento não encontrado.',
  offer_no_invoice: 'Pagamentos via oferta não geram nota.',
  restaurant_not_found: 'Restaurante não encontrado.',
}
