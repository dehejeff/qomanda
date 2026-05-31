export async function uploadMenuItemImage(
  restaurantId: string,
  itemId: string,
  file: File,
): Promise<string> {
  const formData = new FormData()
  formData.append('file', file)
  formData.append('restaurantId', restaurantId)
  formData.append('itemId', itemId)

  const res = await fetch('/api/dashboard/menu-image', {
    method: 'POST',
    body: formData,
  })

  const data = await res.json() as { url?: string; error?: string }
  if (!res.ok) {
    throw new Error(data.error ?? 'Erro ao enviar imagem.')
  }

  if (!data.url) {
    throw new Error('Resposta inválida do servidor.')
  }

  return data.url
}
