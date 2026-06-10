'use client'

import { useEffect, useState } from 'react'
import type { RestaurantTable } from '@/types'
import { toast } from 'sonner'
import { X, Download, Copy, Loader2, Printer } from 'lucide-react'
import QRCode from 'qrcode'
import { buildTableQrCardDataUrl } from '@/lib/table-qr-image'
import { TableFeaturesField } from '@/components/dashboard/table-features-field'
import { TableCapacityField } from '@/components/dashboard/table-capacity-field'

interface Props {
  table: RestaurantTable
  url: string
  restaurantName?: string
  onClose: () => void
}

export function TableQrModal({ table, url, restaurantName, onClose }: Props) {
  const [cardDataUrl, setCardDataUrl] = useState('')

  useEffect(() => {
    let cancelled = false

    async function render() {
      const qrDataUrl = await QRCode.toDataURL(url, {
        width: 320,
        margin: 3,
        color: { dark: '#0b1326', light: '#ffffff' },
        errorCorrectionLevel: 'H',
      })

      const card = await buildTableQrCardDataUrl(qrDataUrl, table.number, { restaurantName })
      if (!cancelled) setCardDataUrl(card)
    }

    render().catch(() => {
      if (!cancelled) toast.error('Erro ao gerar QR Code.')
    })

    return () => { cancelled = true }
  }, [url, table.number, restaurantName])

  function copyLink() {
    navigator.clipboard.writeText(url)
    toast.success('Link copiado!')
  }

  function download() {
    if (!cardDataUrl) return
    const a = document.createElement('a')
    a.href = cardDataUrl
    a.download = `qr-mesa-${table.number}.png`
    a.click()
  }

  function printCard() {
    if (!cardDataUrl) return
    const win = window.open('', '_blank', 'noopener,noreferrer')
    if (!win) {
      toast.error('Permita pop-ups para imprimir.')
      return
    }
    win.document.write(`
      <!DOCTYPE html>
      <html><head><title>Mesa ${table.number}</title>
      <style>
        body { margin: 0; display: flex; justify-content: center; align-items: center; min-height: 100vh; }
        img { max-width: 100%; height: auto; }
        @media print { body { margin: 0; } }
      </style></head>
      <body><img src="${cardDataUrl}" alt="Mesa ${table.number}" onload="window.print()" /></body></html>
    `)
    win.document.close()
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 bg-background/80 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-surface-container border border-outline-variant rounded-t-2xl sm:rounded-xl w-full sm:max-w-sm shadow-2xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-outline-variant">
          <div>
            <h2 className="text-lg font-semibold text-on-surface" style={{ fontFamily: 'Geist, sans-serif' }}>
              Mesa {table.number}
            </h2>
            <p className="text-xs font-mono text-on-surface-variant mt-0.5">QR Code de acesso · T-{table.number.padStart(2, '0')}</p>
          </div>
          <button onClick={onClose} className="text-on-surface-variant hover:text-on-surface transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex flex-col items-center px-6 py-6 gap-5">
          <div className="bg-white rounded-xl p-3 shadow-lg">
            {cardDataUrl ? (
              <img src={cardDataUrl} alt={`QR Code Mesa ${table.number}`} className="w-full max-w-[320px]" />
            ) : (
              <div className="w-56 h-72 flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-on-surface-variant/30" />
              </div>
            )}
          </div>

          <p className="text-xs text-center font-mono text-on-surface-variant -mt-2">
            O número da mesa aparece no cartão para facilitar a impressão e identificação.
          </p>

          <div className="w-full bg-surface-container-low border border-outline-variant rounded-lg px-3 py-2">
            <p className="text-xs font-mono text-on-surface-variant truncate">{url}</p>
          </div>

          <div className="flex gap-3 w-full">
            <button
              onClick={copyLink}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-surface-container-high border border-outline-variant text-on-surface font-mono text-sm rounded-lg hover:bg-surface-variant transition-colors"
            >
              <Copy className="h-4 w-4" />
              Copiar link
            </button>
            <button
              onClick={download}
              disabled={!cardDataUrl}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-primary-container text-on-primary-container font-bold font-mono text-sm rounded-lg hover:opacity-90 transition-opacity disabled:opacity-40"
            >
              <Download className="h-4 w-4" />
              Baixar QR
            </button>
          </div>

          <button
            onClick={printCard}
            disabled={!cardDataUrl}
            className="w-full flex items-center justify-center gap-2 py-2.5 bg-surface-container-high border border-outline-variant text-on-surface font-mono text-sm rounded-lg hover:bg-surface-variant transition-opacity disabled:opacity-40"
          >
            <Printer className="h-4 w-4" />
            Imprimir cartão
          </button>

          {/* Seção da mesa (fila de espera) */}
          <div className="w-full pt-2 border-t border-outline-variant space-y-4">
            <TableCapacityField tableId={table.id} initial={table.capacity} />
            <TableFeaturesField mode="persist" tableId={table.id} />
          </div>
        </div>
      </div>
    </div>
  )
}
