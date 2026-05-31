import { createClient } from '@/lib/supabase/client'

const BUCKET = 'menu-images'

export async function uploadMenuItemImage(
  restaurantId: string,
  itemId: string,
  file: File,
): Promise<string> {
  const supabase = createClient()
  const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg'
  const safeExt = ['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(ext) ? ext : 'jpg'
  const path = `${restaurantId}/${itemId}-${Date.now()}.${safeExt}`

  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    upsert: true,
    contentType: file.type || undefined,
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
