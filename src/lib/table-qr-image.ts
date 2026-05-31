type TableQrCardOptions = {
  restaurantName?: string
}

/** Gera PNG com QR + número da mesa visível (ideal para impressão). */
export async function buildTableQrCardDataUrl(
  qrDataUrl: string,
  tableNumber: string,
  options: TableQrCardOptions = {},
): Promise<string> {
  const qrSize = 320
  const padding = 28
  const labelBlock = options.restaurantName ? 108 : 72
  const width = qrSize + padding * 2
  const height = qrSize + padding * 2 + labelBlock

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas não disponível.')

  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, width, height)

  const img = new Image()
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve()
    img.onerror = () => reject(new Error('Falha ao carregar QR.'))
    img.src = qrDataUrl
  })
  ctx.drawImage(img, padding, padding, qrSize, qrSize)

  const centerX = width / 2
  let textY = qrSize + padding + 36

  ctx.fillStyle = '#0b1326'
  ctx.font = 'bold 44px Geist, system-ui, sans-serif'
  ctx.textAlign = 'center'
  ctx.fillText(`Mesa ${tableNumber}`, centerX, textY)

  textY += 30
  ctx.font = '600 22px ui-monospace, SFMono-Regular, Menlo, monospace'
  ctx.fillStyle = '#64748b'
  ctx.fillText(`T-${tableNumber.padStart(2, '0')}`, centerX, textY)

  if (options.restaurantName) {
    textY += 28
    ctx.font = '500 16px Geist, system-ui, sans-serif'
    ctx.fillStyle = '#94a3b8'
    ctx.fillText(options.restaurantName, centerX, textY)
  }

  return canvas.toDataURL('image/png')
}
