/**
 * @deprecated Esta rota foi substituída por /api/asaas/payments
 * Retorna 410 Gone para qualquer chamada.
 */
import { NextRequest, NextResponse } from 'next/server'

export async function POST(_req: NextRequest) {
  return NextResponse.json(
    { error: 'Esta rota foi descontinuada. Use POST /api/asaas/payments.' },
    { status: 410 }
  )
}
