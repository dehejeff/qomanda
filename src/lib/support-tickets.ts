import type { SupabaseClient } from '@supabase/supabase-js'

export const SUPPORT_BUCKET = 'support-attachments'
export const SUPPORT_MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024

export type SupportTicketCategory =
  | 'bug'
  | 'billing'
  | 'payments'
  | 'nfe'
  | 'account'
  | 'feature'
  | 'other'

export type SupportTicketStatus =
  | 'open'
  | 'in_progress'
  | 'waiting_customer'
  | 'resolved'
  | 'closed'

export type SupportTicketPriority = 'low' | 'normal' | 'high' | 'urgent'

export type SupportAuthorType = 'restaurant' | 'staff'

export const SUPPORT_CATEGORIES: { id: SupportTicketCategory; label: string }[] = [
  { id: 'bug', label: 'Problema / bug' },
  { id: 'payments', label: 'Pagamentos / Qomanda Pay' },
  { id: 'nfe', label: 'NF-e' },
  { id: 'billing', label: 'Mensalidade / cobrança' },
  { id: 'account', label: 'Conta e acesso' },
  { id: 'feature', label: 'Dúvida / funcionalidade' },
  { id: 'other', label: 'Outro' },
]

export const SUPPORT_STATUSES: { id: SupportTicketStatus; label: string }[] = [
  { id: 'open', label: 'Aberto' },
  { id: 'in_progress', label: 'Em atendimento' },
  { id: 'waiting_customer', label: 'Aguardando restaurante' },
  { id: 'resolved', label: 'Resolvido' },
  { id: 'closed', label: 'Encerrado' },
]

export const SUPPORT_PRIORITIES: { id: SupportTicketPriority; label: string }[] = [
  { id: 'low', label: 'Baixa' },
  { id: 'normal', label: 'Normal' },
  { id: 'high', label: 'Alta' },
  { id: 'urgent', label: 'Urgente' },
]

export type SupportTicketAttachment = {
  id: string
  ticket_id: string
  message_id: string | null
  file_name: string
  file_path: string
  file_size: number
  content_type: string
  created_at: string
  url?: string | null
}

export type SupportTicketMessage = {
  id: string
  ticket_id: string
  author_type: SupportAuthorType
  author_user_id: string | null
  author_name: string | null
  author_email: string | null
  body: string
  created_at: string
  attachments: SupportTicketAttachment[]
}

export type SupportTicketListItem = {
  id: string
  restaurant_id: string
  restaurant_name?: string
  subject: string
  category: SupportTicketCategory
  status: SupportTicketStatus
  priority: SupportTicketPriority
  created_by_email: string | null
  created_by_name: string | null
  last_message_at: string
  created_at: string
  message_count?: number
}

export type SupportTicketDetail = SupportTicketListItem & {
  assigned_staff_id: string | null
  closed_at: string | null
  updated_at: string
  messages: SupportTicketMessage[]
}

export function ticketRef(id: string) {
  return `#${id.replace(/-/g, '').slice(0, 8).toUpperCase()}`
}

export function isSupportCategory(v: string): v is SupportTicketCategory {
  return SUPPORT_CATEGORIES.some(c => c.id === v)
}

export function isSupportStatus(v: string): v is SupportTicketStatus {
  return SUPPORT_STATUSES.some(s => s.id === v)
}

export function isSupportPriority(v: string): v is SupportTicketPriority {
  return SUPPORT_PRIORITIES.some(p => p.id === v)
}

const ALLOWED_ATTACHMENT_EXTENSIONS = new Set([
  'jpg', 'jpeg', 'png', 'webp', 'gif', 'pdf', 'txt', 'doc', 'docx',
])

export function validateAttachmentFile(file: File): string | null {
  if (file.size > SUPPORT_MAX_ATTACHMENT_BYTES) {
    return 'Arquivo muito grande (máx. 10 MB).'
  }
  const ext = file.name.split('.').pop()?.toLowerCase() ?? ''
  const allowedMime =
    file.type.startsWith('image/')
    || file.type === 'application/pdf'
    || file.type === 'text/plain'
    || file.type.includes('word')
  if (!allowedMime && !ALLOWED_ATTACHMENT_EXTENSIONS.has(ext)) {
    return 'Formato não permitido. Use imagem, PDF, TXT ou DOC.'
  }
  return null
}

export async function signedAttachmentUrl(
  admin: SupabaseClient,
  filePath: string,
  expiresIn = 3600,
): Promise<string | null> {
  const { data, error } = await admin.storage
    .from(SUPPORT_BUCKET)
    .createSignedUrl(filePath, expiresIn)
  if (error) return null
  return data.signedUrl
}

export async function attachSignedUrls(
  admin: SupabaseClient,
  attachments: SupportTicketAttachment[],
): Promise<SupportTicketAttachment[]> {
  return Promise.all(
    attachments.map(async att => ({
      ...att,
      url: await signedAttachmentUrl(admin, att.file_path),
    })),
  )
}

export function mapTicketRow(row: Record<string, unknown>, restaurantName?: string): SupportTicketListItem {
  return {
    id: String(row.id),
    restaurant_id: String(row.restaurant_id),
    restaurant_name: restaurantName ?? (row.restaurant as { name?: string } | null)?.name,
    subject: String(row.subject),
    category: row.category as SupportTicketCategory,
    status: row.status as SupportTicketStatus,
    priority: row.priority as SupportTicketPriority,
    created_by_email: (row.created_by_email as string | null) ?? null,
    created_by_name: (row.created_by_name as string | null) ?? null,
    last_message_at: String(row.last_message_at),
    created_at: String(row.created_at),
    message_count: row.message_count != null ? Number(row.message_count) : undefined,
  }
}

export async function fetchTicketDetail(
  admin: SupabaseClient,
  ticketId: string,
  restaurantId?: string,
): Promise<SupportTicketDetail | null> {
  let query = admin
    .from('support_tickets')
    .select(`
      *,
      restaurant:restaurants ( id, name )
    `)
    .eq('id', ticketId)

  if (restaurantId) query = query.eq('restaurant_id', restaurantId)

  const { data: ticket, error } = await query.maybeSingle()
  if (error) throw error
  if (!ticket) return null

  const { data: messages } = await admin
    .from('support_ticket_messages')
    .select('*')
    .eq('ticket_id', ticketId)
    .order('created_at', { ascending: true })

  const { data: attachments } = await admin
    .from('support_ticket_attachments')
    .select('*')
    .eq('ticket_id', ticketId)
    .order('created_at', { ascending: true })

  const attachmentsWithUrls = await attachSignedUrls(
    admin,
    (attachments ?? []) as SupportTicketAttachment[],
  )

  const attachmentsByMessage = new Map<string, SupportTicketAttachment[]>()
  for (const att of attachmentsWithUrls) {
    const key = att.message_id ?? 'orphan'
    if (!attachmentsByMessage.has(key)) attachmentsByMessage.set(key, [])
    attachmentsByMessage.get(key)!.push(att)
  }

  const mappedMessages: SupportTicketMessage[] = (messages ?? []).map(m => ({
    ...(m as Omit<SupportTicketMessage, 'attachments'>),
    attachments: attachmentsByMessage.get(m.id) ?? [],
  }))

  const restaurant = ticket.restaurant as { name?: string } | null
  const base = mapTicketRow(ticket as Record<string, unknown>, restaurant?.name)

  return {
    ...base,
    assigned_staff_id: (ticket.assigned_staff_id as string | null) ?? null,
    closed_at: (ticket.closed_at as string | null) ?? null,
    updated_at: String(ticket.updated_at),
    messages: mappedMessages,
  }
}

export async function uploadSupportAttachment(
  admin: SupabaseClient,
  params: {
    restaurantId: string
    ticketId: string
    file: File
    uploadedBy: string
    messageId?: string
  },
): Promise<SupportTicketAttachment> {
  const validationError = validateAttachmentFile(params.file)
  if (validationError) throw new Error(validationError)

  const ext = params.file.name.split('.').pop()?.toLowerCase() ?? 'bin'
  const safeName = params.file.name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 80)
  const path = `${params.restaurantId}/${params.ticketId}/${Date.now()}-${safeName || `file.${ext}`}`
  const buffer = Buffer.from(await params.file.arrayBuffer())

  const { error: uploadErr } = await admin.storage.from(SUPPORT_BUCKET).upload(path, buffer, {
    upsert: false,
    contentType: params.file.type || 'application/octet-stream',
  })
  if (uploadErr) {
    if (uploadErr.message.includes('Bucket not found')) {
      throw new Error('Storage de suporte não configurado. Rode migrate-support-tickets.sql no Supabase.')
    }
    throw uploadErr
  }

  const { data, error } = await admin
    .from('support_ticket_attachments')
    .insert({
      ticket_id: params.ticketId,
      message_id: params.messageId ?? null,
      file_name: params.file.name,
      file_path: path,
      file_size: params.file.size,
      content_type: params.file.type || 'application/octet-stream',
      uploaded_by: params.uploadedBy,
    })
    .select('*')
    .single()

  if (error) throw error

  const url = await signedAttachmentUrl(admin, path)
  return { ...(data as SupportTicketAttachment), url }
}
