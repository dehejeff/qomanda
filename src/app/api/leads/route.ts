import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isRestaurantType } from '@/lib/crm-leads'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as Record<string, unknown>

    const name           = typeof body.name           === 'string' ? body.name.trim()           : ''
    const whatsapp       = typeof body.whatsapp       === 'string' ? body.whatsapp.trim()       : ''
    const email          = typeof body.email          === 'string' ? body.email.trim()          : null
    const restaurantName = typeof body.restaurantName === 'string' ? body.restaurantName.trim() : ''
    const restaurantType = typeof body.restaurantType === 'string' ? body.restaurantType        : ''

    if (!name || !whatsapp || !restaurantName || !isRestaurantType(restaurantType)) {
      return NextResponse.json({ error: 'Dados obrigatórios ausentes.' }, { status: 400 })
    }

    if (whatsapp.replace(/\D/g, '').length < 10) {
      return NextResponse.json({ error: 'WhatsApp inválido.' }, { status: 400 })
    }

    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: 'E-mail inválido.' }, { status: 400 })
    }

    const admin = createAdminClient()
    const { error } = await admin.from('leads').insert({
      name,
      whatsapp: whatsapp.replace(/\D/g, ''),
      email:    email || null,
      restaurant_name: restaurantName,
      restaurant_type: restaurantType,
      source: 'qr',
    })

    if (error) throw error

    return NextResponse.json({ success: true }, { status: 201 })
  } catch (err) {
    console.error('[Leads POST]', err)
    return NextResponse.json({ error: 'Erro ao registrar interesse.' }, { status: 500 })
  }
}
