import { buildTableCheckInUrl } from '@/lib/table-checkin-url'

/** Mesa 1 — Tasca do Porto. Token fixo para testes (ver supabase/patch-test-table-token.sql). */
export const TEST_TABLE_SLUG = 'tasca-do-porto'
export const TEST_TABLE_NUMBER = '1'
export const TEST_TABLE_TOKEN = '00000001-0000-4000-8000-000000000001'

/** Ativo em dev local ou quando NEXT_PUBLIC_ENABLE_TEST_TABLE=true (ex.: Vercel de testes). */
export function isTestTableCheckInEnabled(): boolean {
  if (process.env.NEXT_PUBLIC_ENABLE_TEST_TABLE === 'true') return true
  return process.env.NODE_ENV === 'development'
}

export function getTestTableCheckInPath(): string {
  const params = new URLSearchParams({ mesa: TEST_TABLE_NUMBER, t: TEST_TABLE_TOKEN })
  return `/${TEST_TABLE_SLUG}?${params.toString()}`
}

export function getTestTableCheckInUrl(baseUrl?: string): string {
  const base =
    baseUrl ??
    (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000')
  return buildTableCheckInUrl(base, TEST_TABLE_SLUG, TEST_TABLE_NUMBER, TEST_TABLE_TOKEN)
}
