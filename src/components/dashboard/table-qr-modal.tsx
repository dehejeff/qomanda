'use client'

import { useEffect, useState } from 'react'
import type { RestaurantTable } from '@/types'
import { toast } from 'sonner'
import { X, Download, Copy, Loader2 } from 'lucide-react'
import QRCode from 'qrcode'

interface Props {
  table: RestaurantTable
  url: string
  onClose: () => void
}

export function TableQrModal({ table, url, onClose }: Props) {
  const [qrDataUrl, setQrDataUrl] = useState('')

  useEffect(() => {
    QRCode.toDataURL(url, {
      width: 320,
      margin: 3,
      color: { dark: '#0b1326', light: '#ffffff' },
      errorCorrectionLevel: 'H',
    }).then(setQrDataUrl)
  }, [url])

  function copyLink() {
    navigator.clipboard.writeText(url)
    toast.success('Link copiado!')
  }

  function download() {
    const a = document.createElement('a')
    a.href = qrDataUrl
    a.download = `qr-mesa-${table.number}.png`
    a.click()
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
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-outline-variant">
          <div>
            <h2 className="text-lg font-semibold text-on-surface" style={{ fontFamily: 'Geist, sans-serif' }}>
              Mesa {table.number}
            </h2>
            <p className="text-xs font-mono text-on-surface-variant mt-0.5">QR Code de acesso</p>
          </div>
          <button onClick={onClose} className="text-on-surface-variant hover:text-on-surface transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* QR Code */}
        <div className="flex flex-col items-center px-6 py-6 gap-5">
          <div className="bg-white rounded-xl p-4 shadow-lg">
            {qrDataUrl ? (
              <img src={qrDataUrl} alt={`QR Code Mesa ${table.number}`} className="w-56 h-56" />
            ) : (
              <div className="w-56 h-56 flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-on-surface-variant/30" />
              </div>
            )}
          </div>

          {/* URL */}
          <div className="w-full bg-surface-container-low border border-outline-variant rounded-lg px-3 py-2">
            <p className="text-xs font-mono text-on-surface-variant truncate">{url}</p>
          </div>

          {/* Actions */}
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
              disabled={!qrDataUrl}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-primary-container text-on-primary-container font-bold font-mono text-sm rounded-lg hover:opacity-90 transition-opacity disabled:opacity-40"
            >
              <Download className="h-4 w-4" />
              Baixar QR
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
