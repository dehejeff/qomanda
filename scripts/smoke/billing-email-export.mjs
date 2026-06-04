// Verificação E2E: e-mail de cobrança/lembrete + exportação CSV.
// Cria staff temp + fatura em atraso; valida o cron de lembretes (envia +
// throttle), o CSV (com staff) e o gating de auth.
import { chromium } from 'playwright'
import { createClient } from '@supabase/supabase-js'
import WebSocket from 'ws'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
if (!globalThis.WebSocket) globalThis.WebSocket = WebSocket

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const env = fs.readFileSync(path.join(ROOT, '.env.local'), 'utf8')
const get = (k) => { const m = env.match(new RegExp('^' + k + '=(.*)$', 'm')); return m ? m[1].trim().replace(/^["']|["']$/g, '') : null }
const admin = createClient(get('NEXT_PUBLIC_SUPABASE_URL'), get('SUPABASE_SERVICE_ROLE_KEY') || get('SUPABASE_SERVICE_ROLE') || get('SUPABASE_SECRET_KEY'), { auth: { persistSession: false } })

const BASE = 'http://localhost:3000'
const RID = 'dd8a40c6-6618-402a-af23-df0d17e24f7a'
const STAFF_EMAIL = `staff-bilmail-${Date.now()}@smoke.com`
const STAFF_PASS = 'StaffTest2026!'

const results = []
const check = (label, ok, extra = '') => { results.push([label, ok]); console.log(`${ok ? '✅' : '❌'} ${label}${extra ? ' — ' + extra : ''}`) }

let staffAuthId = null, invoiceId = null

function brToday() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
}
function dateOffset(days) {
  const [y, m, d] = brToday().split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10)
}

async function setup() {
  const { data, error } = await admin.auth.admin.createUser({ email: STAFF_EMAIL, password: STAFF_PASS, email_confirm: true })
  if (error) throw new Error('staff auth: ' + error.message)
  staffAuthId = data.user.id
  await admin.from('staff_users').insert({ user_id: staffAuthId, email: STAFF_EMAIL, role: 'ops', active: true })
  const { data: inv } = await admin.from('billing_invoices').insert({
    restaurant_id: RID, period_start: dateOffset(-34), period_end: dateOffset(-4),
    amount: 199, status: 'sent', due_date: dateOffset(-4), last_reminder_at: null,
  }).select('id').single()
  invoiceId = inv.id
  console.log('setup: staff', STAFF_EMAIL, '| invoice (atrasada)', invoiceId)
}

async function main() {
  await setup()
  const browser = await chromium.launch()
  const ctx = await browser.newContext()
  const page = await ctx.newPage()
  await page.goto(`${BASE}/internal/login`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(700)
  await page.locator('input[type="email"]').first().fill(STAFF_EMAIL)
  await page.locator('input[type="password"]').first().fill(STAFF_PASS)
  await page.locator('button[type="submit"]').first().click()
  await page.waitForTimeout(2500)

  // 1) CSV export (staff)
  const csvRes = await ctx.request.get(`${BASE}/api/internal/billing/export`)
  const csvText = await csvRes.text()
  const ct = csvRes.headers()['content-type'] ?? ''
  check('CSV export 200 + content-type csv', csvRes.status() === 200 && ct.includes('text/csv'), `ct=${ct}`)
  check('CSV tem cabeçalho esperado', csvText.includes('Cliente') && csvText.includes('Vencimento') && csvText.includes('Dias em atraso'))

  // 2) lembrete de atraso (cron, dev autorizado)
  const r1 = await (await fetch(`${BASE}/api/cron/billing-reminders`, { method: 'POST' })).json()
  console.log('   reminders run1:', JSON.stringify(r1))
  check('Cron envia lembrete (sent>=1)', r1.ok && r1.sent >= 1)
  const { data: inv1 } = await admin.from('billing_invoices').select('last_reminder_at, status').eq('id', invoiceId).single()
  check('Fatura marcada lembrada + overdue', Boolean(inv1?.last_reminder_at) && inv1?.status === 'overdue')

  // 3) throttle: 2ª execução no mesmo dia não reenvia para a nossa fatura
  const r2 = await (await fetch(`${BASE}/api/cron/billing-reminders`, { method: 'POST' })).json()
  console.log('   reminders run2:', JSON.stringify(r2))
  check('Throttle do mesmo dia (skipped>=1)', r2.ok && r2.skipped >= 1)

  // 4) auth: CSV exige staff
  const anon = await browser.newContext()
  const anonCsv = await anon.request.get(`${BASE}/api/internal/billing/export`)
  check('CSV exige staff (401 anônimo)', anonCsv.status() === 401, `status=${anonCsv.status()}`)
  await anon.close()

  await browser.close()
  const passed = results.filter(r => r[1]).length
  console.log(`\n--- RESULTADO: ${passed}/${results.length} ---`)
  if (passed !== results.length) process.exitCode = 1
}

main()
  .catch(e => { console.error('ERRO:', e); process.exitCode = 1 })
  .finally(async () => {
    if (invoiceId) await admin.from('billing_invoices').delete().eq('id', invoiceId)
    if (staffAuthId) {
      await admin.from('staff_users').delete().eq('user_id', staffAuthId)
      await admin.auth.admin.deleteUser(staffAuthId).catch(() => {})
    }
    console.log('cleanup: staff/fatura de teste removidos')
  })
