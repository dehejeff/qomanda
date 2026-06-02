'use client'

import { useState } from 'react'
import { toast } from 'sonner'

/** Painel do Overview para restaurantes de balcão: link público de divulgação. */
export function OverviewCounterPanel({ restaurantSlug }: { restaurantSlug: string }) {
  const [copied, setCopied] = useState(false)

  const base = typeof window !== 'undefined' ? window.location.origin : ''
  const balcaoUrl = `${base}/${restaurantSlug}/balcao`

  async function copy() {
    try {
      await navigator.clipboard.writeText(balcaoUrl)
      setCopied(true)
      toast.success('Link copiado!')
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error('Não foi possível copiar.')
    }
  }

  return (
    <div className="tonal-layer-1 ghost-border rounded-xl p-stack-lg flex flex-col gap-4">
      <div className="flex items-start gap-3">
        <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0 bg-primary/10 border border-primary/20">
          <span className="material-symbols-outlined text-[24px] text-primary" style={{ fontVariationSettings: "'FILL' 1" }}>storefront</span>
        </div>
        <div>
          <h3 className="text-lg font-semibold text-on-surface" style={{ fontFamily: 'Geist, sans-serif' }}>Balcão</h3>
          <p className="text-sm text-on-surface-variant mt-0.5">
            Divulgue este link (QR no balcão, redes, cardápio). O cliente pede pelo celular e recebe um número.
          </p>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-2">
        <div className="flex-1 h-11 px-3 rounded-lg flex items-center bg-surface-dim border border-outline-variant text-sm font-mono text-on-surface-variant overflow-x-auto whitespace-nowrap">
          {balcaoUrl}
        </div>
        <button
          type="button"
          onClick={copy}
          className="h-11 px-4 rounded-lg text-sm font-mono font-bold bg-primary-container text-on-primary-container hover:opacity-90 flex items-center justify-center gap-2 shrink-0"
        >
          <span className="material-symbols-outlined text-[18px]">{copied ? 'check' : 'content_copy'}</span>
          {copied ? 'Copiado' : 'Copiar'}
        </button>
        <a
          href={balcaoUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="h-11 px-4 rounded-lg text-sm font-mono border border-outline-variant text-on-surface-variant hover:bg-surface-container-highest flex items-center justify-center gap-2 shrink-0"
        >
          <span className="material-symbols-outlined text-[18px]">open_in_new</span>
          Abrir
        </a>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
        {[
          { icon: 'qr_code_2', title: 'Imprima o QR', desc: 'Aponte para o link do balcão na mesa/balcão.' },
          { icon: 'tag', title: 'Pedido por número', desc: 'Cada pedido recebe um #N sequencial.' },
          { icon: 'notifications_active', title: 'Avise "pronto"', desc: 'Atualize o status até "Pronto para retirar".' },
        ].map(s => (
          <div key={s.icon} className="rounded-lg border border-outline-variant bg-surface-dim/50 p-3">
            <span className="material-symbols-outlined text-[20px] text-primary">{s.icon}</span>
            <p className="text-sm font-semibold text-on-surface mt-1">{s.title}</p>
            <p className="text-xs text-on-surface-variant mt-0.5 leading-relaxed">{s.desc}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
