'use client'

import type { RestaurantWhatsAppStatus } from '@/lib/restaurant-whatsapp'
import { WHATSAPP_STATUS_LABEL } from '@/lib/restaurant-whatsapp'

type Props = {
  whatsapp: RestaurantWhatsAppStatus
  embedded?: boolean
}

export function RestaurantWhatsAppStatusPanel({ whatsapp, embedded }: Props) {
  const badgeClass = whatsapp.status === 'auto_send'
    ? 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10'
    : whatsapp.status === 'connected'
      ? 'text-blue-400 border-blue-500/30 bg-blue-500/10'
      : 'text-on-surface-variant border-outline-variant'

  return (
    <div className={embedded ? 'space-y-3' : 'pt-4 border-t border-outline-variant space-y-3'}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-mono uppercase tracking-widest text-on-surface-variant">WhatsApp (restaurante)</p>
          <h4 className="text-sm font-semibold text-on-surface mt-1">Envio da NF-e ao cliente final</h4>
          <p className="text-xs text-on-surface-variant mt-1 leading-relaxed">
            Credenciais e toggle de envio automático são configurados pelo restaurante em{' '}
            <span className="font-mono text-on-surface">Configurações → Integrações</span>.
          </p>
        </div>
        <span className={`text-[10px] font-mono uppercase px-2 py-1 rounded border shrink-0 ${badgeClass}`}>
          {WHATSAPP_STATUS_LABEL[whatsapp.status]}
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <StatusItem label="Phone Number ID" value={whatsapp.phone_id ?? '—'} mono />
        <StatusItem label="Access Token" value={whatsapp.has_token ? 'Cadastrado' : 'Pendente'} />
        <StatusItem label="Envio automático NF-e" value={whatsapp.auto_send_nfe ? 'Ativo' : 'Desativado'} />
      </div>

      {!whatsapp.connected && (
        <p className="text-xs text-amber-400/90 leading-relaxed">
          Restaurante ainda não conectou o WhatsApp Business. A NF-e emitida não será enviada ao cliente até concluir a integração no painel dele.
        </p>
      )}
    </div>
  )
}

function StatusItem({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="rounded-lg border border-outline-variant bg-surface-dim px-3 py-2.5">
      <p className="text-[10px] font-mono uppercase tracking-wider text-on-surface-variant">{label}</p>
      <p className={`text-sm text-on-surface mt-1 ${mono ? 'font-mono' : ''}`}>{value}</p>
    </div>
  )
}
