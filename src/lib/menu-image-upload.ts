import { createClient } from '@/lib/supabase/client'

const BUCKET = 'menu-images'
const IMAGE_EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp', 'gif'] as const

export async function uploadMenuItemImage(
  restaurantId: string,
  itemId: string,
  file: File,
): Promise<string> {
  const supabase = createClient()
  const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg'
  const safeExt = IMAGE_EXTENSIONS.includes(ext as (typeof IMAGE_EXTENSIONS)[number]) ? ext : 'jpg'
  const path = `${restaurantId}/${itemId}-${Date.now()}.${safeExt}`
  const mime =
    file.type && file.type.startsWith('image/')
      ? file.type
      : ext === 'png'
        ? 'image/png'
        : ext === 'webp'
          ? 'image/webp'
          : ext === 'gif'
            ? 'image/gif'
            : 'image/jpeg'

  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    upsert: true,
    contentType: mime,
  })

  if (error) {
    throw new Error(
      error.message.includes('Bucket not found')
        ? 'Storage de imagens não configurado. Rode migrate-menu-images-storage.sql no Supabase ou use URL da imagem.'
        : error.message,
    )
  }

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path)
  return data.publicUrl
}
