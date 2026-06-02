import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

const BUCKET = 'restaurant-logos'
const MAX_BYTES = 2 * 1024 * 1024 // 2 MB

/**
 * POST /api/dashboard/profile/logo
 * Upload da logo do restaurante para o Supabase Storage.
 */
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })

    const formData = await req.formData()
    const file = formData.get('file')
    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'Arquivo inválido.' }, { status: 400 })
    }

    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: 'Logo muito grande (máx. 2 MB).' }, { status: 400 })
    }

    const ext = file.name.split('.').pop()?.toLowerCase() ?? 'jpg'
    const allowedExts = ['jpg', 'jpeg', 'png', 'webp']
    if (!allowedExts.includes(ext) && !file.type.startsWith('image/')) {
      return NextResponse.json({ error: 'Use JPG, PNG ou WebP.' }, { status: 400 })
    }

    const admin = createAdminClient()
    const { data: restaurant } = await admin
      .from('restaurants').select('id').eq('owner_id', user.id).single()
    if (!restaurant) return NextResponse.json({ error: 'Restaurante não encontrado.' }, { status: 403 })

    const safeExt = allowedExts.includes(ext) ? ext : 'jpg'
    const path = `${restaurant.id}/logo.${safeExt}`
    const buffer = Buffer.from(await file.arrayBuffer())

    const contentType = file.type.startsWith('image/') ? file.type
      : safeExt === 'png' ? 'image/png'
      : safeExt === 'webp' ? 'image/webp'
      : 'image/jpeg'

    const { error: uploadErr } = await admin.storage.from(BUCKET).upload(path, buffer, {
      upsert: true,
      contentType,
    })

    if (uploadErr) {
      console.error('[Logo Upload]', uploadErr)
      return NextResponse.json({
        error: uploadErr.message.includes('Bucket not found')
          ? 'Storage não configurado. Rode migrate-restaurant-logo-storage.sql no Supabase.'
          : 'Erro ao enviar logo.',
      }, { status: 500 })
    }

    const { data: urlData } = admin.storage.from(BUCKET).getPublicUrl(path)
    const logoUrl = `${urlData.publicUrl}?t=${Date.now()}`

    await admin.from('restaurants').update({ logo_url: logoUrl }).eq('id', restaurant.id)

    return NextResponse.json({ logoUrl })
  } catch (err) {
    console.error('[Logo Upload Error]', err)
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 })
  }
}
