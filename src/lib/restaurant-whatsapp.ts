export type WhatsAppConnectionStatus = 'disconnected' | 'connected' | 'auto_send'

export type RestaurantWhatsAppStatus = {
  connected: boolean
  phone_id: string | null
  has_token: boolean
  auto_send_nfe: boolean
  status: WhatsAppConnectionStatus
  status_label: string
}

export type WhatsAppIntegrationDto = {
  phoneNumberId: string | null
  hasToken: boolean
  tokenMasked: string | null
  nfeAutoSendEnabled: boolean
  status: WhatsAppConnectionStatus
  statusLabel: string
}

export function whatsAppStatusFromRow(row: {
  whatsapp_phone_id?: string | null
  whatsapp_access_token?: string | null
  whatsapp_nfe_enabled?: boolean | null
}): RestaurantWhatsAppStatus {
  const connected = Boolean(row.whatsapp_phone_id?.trim() && row.whatsapp_access_token?.trim())
  const auto_send_nfe = Boolean(row.whatsapp_nfe_enabled)
  const status: WhatsAppConnectionStatus = connected && auto_send_nfe
    ? 'auto_send'
    : connected
      ? 'connected'
      : 'disconnected'

  const status_label = status === 'auto_send'
    ? 'Envio automático ativo'
    : status === 'connected'
      ? 'Conectado'
      : 'Pendente'

  return {
    connected,
    phone_id: row.whatsapp_phone_id?.trim() || null,
    has_token: Boolean(row.whatsapp_access_token?.trim()),
    auto_send_nfe,
    status,
    status_label,
  }
}

export function whatsAppIntegrationDto(
  row: {
    whatsapp_phone_id?: string | null
    whatsapp_access_token?: string | null
    whatsapp_nfe_enabled?: boolean | null
  },
  tokenMasked: string | null,
): WhatsAppIntegrationDto {
  const status = whatsAppStatusFromRow(row)
  return {
    phoneNumberId: status.phone_id,
    hasToken: status.has_token,
    tokenMasked,
    nfeAutoSendEnabled: status.auto_send_nfe,
    status: status.status,
    statusLabel: status.status_label,
  }
}

export function validateWhatsAppIntegration(body: {
  phoneNumberId?: string
  accessToken?: string
  hasExistingToken?: boolean
}): string | null {
  const phoneNumberId = String(body.phoneNumberId ?? '').trim()
  const accessToken = String(body.accessToken ?? '').trim()

  if (!phoneNumberId) return 'Informe o Phone Number ID do WhatsApp Business.'
  if (!/^\d+$/.test(phoneNumberId)) return 'Phone Number ID deve conter apenas dígitos.'
  if (!accessToken && !body.hasExistingToken) return 'Informe o Access Token permanente da Meta.'

  return null
}

export const WHATSAPP_STATUS_LABEL: Record<WhatsAppConnectionStatus, string> = {
  disconnected: 'Pendente',
  connected: 'Conectado',
  auto_send: 'Envio automático',
}
