/** Chaves de persistência no browser — prefixo kicomanda_ (legado qomanda_ migrado automaticamente). */

const LEGACY_BY_KEY: Record<string, string> = {
  kicomanda_customer_id: 'kicomanda_customer_id',
  kicomanda_customer_name: 'kicomanda_customer_name',
  kicomanda_session_id: 'kicomanda_session_id',
  kicomanda_service_mode: 'kicomanda_service_mode',
  kicomanda_customer_session_token: 'kicomanda_customer_session_token',
  kicomanda_customer_session_last_activity: 'kicomanda_customer_session_last_activity',
  kicomanda_pending_table_checkin: 'kicomanda_pending_table_checkin',
  kicomanda_kds_autoprint: 'kicomanda_kds_autoprint',
  kicomanda_pilotos_checklist_v2: 'kicomanda_pilotos_checklist_v2',
  kicomanda_playbook_checks: 'kicomanda_playbook_checks',
  kicomanda_mock_table_history: 'kicomanda_mock_table_history',
  kicomanda_mock_started_at: 'kicomanda_mock_started_at',
}

export const CLIENT_STORAGE = {
  customerId: 'kicomanda_customer_id',
  customerName: 'kicomanda_customer_name',
  sessionId: 'kicomanda_session_id',
  serviceMode: 'kicomanda_service_mode',
  customerSessionToken: 'kicomanda_customer_session_token',
  customerSessionLastActivity: 'kicomanda_customer_session_last_activity',
  pendingTableCheckin: 'kicomanda_pending_table_checkin',
  kdsAutoprint: 'kicomanda_kds_autoprint',
  pilotosChecklist: 'kicomanda_pilotos_checklist_v2',
  playbookChecks: 'kicomanda_playbook_checks',
  mockTableHistory: 'kicomanda_mock_table_history',
  mockStartedAt: 'kicomanda_mock_started_at',
  waitlist: (slug: string) => `kicomanda_waitlist_${slug}`,
  waitlistLegacy: (slug: string) => `kicomanda_waitlist_${slug}`,
  splitAlcohol: (sessionId: string) => `kicomanda_split_alcohol_${sessionId}`,
  splitAlcoholLegacy: (sessionId: string) => `kicomanda_split_alcohol_${sessionId}`,
} as const

let migrated = false

function migrateKey(key: string, legacyKey?: string) {
  if (!legacyKey || typeof window === 'undefined') return
  const current = localStorage.getItem(key)
  const legacy = localStorage.getItem(legacyKey)
  if (current == null && legacy != null) localStorage.setItem(key, legacy)
  if (legacy != null) localStorage.removeItem(legacyKey)
}

/** Copia valores qomanda_* → kicomanda_* uma vez por aba. */
export function migrateClientStorage() {
  if (typeof window === 'undefined' || migrated) return
  migrated = true
  for (const [key, legacy] of Object.entries(LEGACY_BY_KEY)) {
    migrateKey(key, legacy)
  }
}

export function readLocal(key: string, legacyKey?: string): string | null {
  migrateClientStorage()
  if (legacyKey) migrateKey(key, legacyKey)
  return localStorage.getItem(key)
}

export function writeLocal(key: string, value: string) {
  migrateClientStorage()
  localStorage.setItem(key, value)
}

export function removeLocal(key: string, legacyKey?: string) {
  migrateClientStorage()
  localStorage.removeItem(key)
  if (legacyKey) localStorage.removeItem(legacyKey)
}

export function readSession(key: string, legacyKey?: string): string | null {
  migrateClientStorage()
  if (legacyKey) {
    const current = sessionStorage.getItem(key)
    const legacy = sessionStorage.getItem(legacyKey)
    if (current == null && legacy != null) sessionStorage.setItem(key, legacy)
    if (legacy != null) sessionStorage.removeItem(legacyKey)
  }
  return sessionStorage.getItem(key)
}

export function writeSession(key: string, value: string) {
  sessionStorage.setItem(key, value)
}

export function removeSession(key: string, legacyKey?: string) {
  sessionStorage.removeItem(key)
  if (legacyKey) sessionStorage.removeItem(legacyKey)
}
