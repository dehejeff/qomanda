/** TTL absoluto da sessão de cartão (PCI-DSS 8.2.8 — máximo recomendado 24h). */
export const CUSTOMER_SESSION_ABSOLUTE_TTL_MS = 24 * 60 * 60 * 1000

/** Expira após 15 min sem uso autenticado (PCI-DSS 8.2.8). */
export const CUSTOMER_SESSION_INACTIVITY_MS = 15 * 60 * 1000

export const CUSTOMER_SESSION_RENEWAL_HEADER = 'x-customer-session-renewed'
