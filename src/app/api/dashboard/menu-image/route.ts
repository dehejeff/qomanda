import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

const BUCKET = 'menu-images'
const IMAGE_EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp', 'gif'] as const
const MAX_BYTES = 5 * 1024 * 1024

function mimeForFile(file: File, ext: string): string {
  if (file.type && file.type.startsWith('image/')) return file.type
  if (ext === 'png') return 'image/png'
  if (ext === 'webp') return 'image/webp'
  if (ext === 'gif') return 'image/gif'
  return 'image/jpeg'
}

/**
 * POST /api/dashboard/menu-image
 * Upload de foto do cardápio (service role após validar dono do restaurante).
 */
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Faça login no painel para enviar imagens.' }, { status: 401 })
    }

    const formData = await req.formData()
    const file = formData.get('file')
    const restaurantId = String(formData.get('restaurantId') ?? '')
    const itemId = String(formData.get('itemId') ?? 'new')

    if (!(file instanceof File) || !restaurantId) {
      return NextResponse.json({ error: 'Arquivo ou restaurante inválido.' }, { status: 400 })
    }

    const ext = file.name.split('.').pop()?.toLowerCase() ?? ''
    const allowedByMime = file.type.startsWith('image/')
    const allowedByExt = IMAGE_EXTENSIONS.includes(ext as (typeof IMAGE_EXTENSIONS)[number])
    if (!allowedByMime && !allowedByExt) {
      return NextResponse.json({ error: 'Use JPG, PNG, WebP ou GIF.' }, { status: 400 })
    }

    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: 'Imagem muito grande (máx. 5 MB).' }, { status: 400 })
    }

    const admin = createAdminClient()
    const { data: restaurant } = await admin
      .from('restaurants')
      .select('id')
      .eq('id', restaurantId)
      .eq('owner_id', user.id)
      .maybeSingle()

    if (!restaurant) {
      return NextResponse.json({ error: 'Sem permissão para este restaurante.' }, { status: 403 })
    }

    const safeExt = allowedByExt ? ext : 'jpg'
    const path = `${restaurantId}/${itemId}-${Date.now()}.${safeExt}`
    const buffer = Buffer.from(await file.arrayBuffer())

    const { error } = await admin.storage.from(BUCKET).upload(path, buffer, {
      upsert: true,
      contentType: mimeForFile(file, safeExt),
    })

    if (error) {
      console.error('[Menu Image Upload]', error)
      return NextResponse.json({
        error: error.message.includes('Bucket not found')
          ? 'Storage de imagens não configurado. Rode migrate-menu-images-storage.sql no Supabase.'
          : 'Erro ao enviar imagem.',
      }, { status: 500 })
    }

    const { data } = admin.storage.from(BUCKET).getPublicUrl(path)
    return NextResponse.json({ url: data.publicUrl })
  } catch (err) {
    console.error('[Menu Image Upload Error]', err)
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 })
  }
}
