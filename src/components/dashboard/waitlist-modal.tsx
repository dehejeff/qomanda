'use client'

import { X } from 'lucide-react'
import { WaitlistManager } from '@/components/waiter/waitlist-manager'

/**
 * Abre a gestão da fila de espera num modal (a partir da página Mesas do painel).
 * Reaproveita o mesmo componente do app da recepção/garçom.
 */
export function WaitlistModal({ onClose }: { onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center sm:p-4 bg-black/70 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full sm:max-w-lg max-h-[90vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl shadow-2xl"
        style={{ background: '#0D1117', color: '#FFFFFF', fontFamily: 'Geist, sans-serif' }}
        onClick={e => e.stopPropagation()}
      >
        <div
          className="sticky top-0 z-10 flex items-center justify-between px-5 py-4 border-b"
          style={{ background: 'rgba(13,17,23,0.95)', borderColor: 'rgba(88,66,55,0.4)', backdropFilter: 'blur(8px)' }}
        >
          <div>
            <h2 className="text-lg font-black" style={{ letterSpacing: '-0.02em' }}>Fila de espera</h2>
            <p className="text-[11px] font-mono" style={{ color: '#8B949E' }}>Aloque clientes e chame o próximo quando uma mesa liberar.</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl active:scale-95 transition-transform" style={{ color: '#8B949E' }} aria-label="Fechar">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="px-5 py-4">
          <WaitlistManager embedded />
        </div>
      </div>
    </div>
  )
}
