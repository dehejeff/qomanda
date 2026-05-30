/** @deprecated Substituído por /api/asaas/webhook */
import { NextRequest, NextResponse } from 'next/server'

export async function POST(_req: NextRequest) {
  return NextResponse.json(
    { error: 'Stripe webhook descontinuado. Use /api/asaas/webhook.' },
    { status: 410 }
  )
}
