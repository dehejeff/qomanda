// Verificação E2E: painel de Cobrança interno. Cria staff temporário, semeia
// faturas com vencimentos controlados e confere status derivado (em atraso /
// a vencer / paga), KPIs, ação "marcar paga" e o gating de auth.
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
const STAFF_EMAIL = `staff-billing-${Date.now()}@smoke.com`
const STAFF_PASS = 'StaffTest2026!'

const results = []
const check = (label, ok, extra = '') => { results.push([label, ok]); console.log(`${ok ? '✅' : '❌'} ${label}${extra ? ' — ' + extra : ''}`) }

let staffAuthId = null, invoiceId = null

function brToday() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
}
function dateOffset(days) {
  const [y, m, d] = brToday().split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d + days))
  return dt.toISOString().slice(0, 10)
}

async function setup() {
  const { data, error } = await admin.auth.admin.createUser({ email: STAFF_EMAIL, password: STAFF_PASS, email_confirm: true })
  if (error) throw new Error('staff auth: ' + error.message)
  staffAuthId = data.user.id
  await admin.from('staff_users').insert({ user_id: staffAuthId, email: STAFF_EMAIL, role: 'ops', active: true })

  // fatura em atraso (venceu há 3 dias), sem cobrança Asaas
  const { data: inv, error: invErr } = await admin.from('billing_invoices').insert({
    restaurant_id: RID, period_start: dateOffset(-33), period_end: dateOffset(-3),
    amount: 149.9, status: 'sent', due_date: dateOffset(-3),
  }).select('id').single()
  if (invErr) throw new Error('invoice: ' + invErr.message)
  invoiceId = inv.id
  console.log('setup: staff', STAFF_EMAIL, '| invoice', invoiceId)
}

async function login(ctx) {
  const page = await ctx.newPage()
  await page.goto(`${BASE}/internal/login`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(700)
  await page.locator('input[type="email"]').first().fill(STAFF_EMAIL)
  await page.locator('input[type="password"]').first().fill(STAFF_PASS)
  await page.locator('button[type="submit"]').first().click()
  await page.waitForURL('**/internal**', { timeout: 30000 }).catch(() => {})
  await page.waitForTimeout(1500)
  return page
}

function rowFor(json) {
  return (json.rows ?? []).find(r => r.restaurantId === RID)
}

async function main() {
  await setup()
  const browser = await chromium.launch()
  const ctx = await browser.newContext()
  const page = await login(ctx)
  console.log('   pós-login:', page.url())

  // 1) GET overview
  let res = await ctx.request.get(`${BASE}/api/internal/billing`)
  let json = await res.json()
  check('GET billing autenticado (200)', res.status() === 200 && Array.isArray(json.rows))
  let row = rowFor(json)
  check('Fatura em atraso detectada (status + dias)', row?.status === 'overdue' && row?.daysOverdue === 3, `status=${row?.status} dias=${row?.daysOverdue}`)
  check('KPI de atraso reflete', (json.kpis?.overdueCount ?? 0) >= 1)

  // 2) muda vencimento p/ +3 dias → a vencer
  await admin.from('billing_invoices').update({ due_date: dateOffset(3) }).eq('id', invoiceId)
  res = await ctx.request.get(`${BASE}/api/internal/billing`); json = await res.json(); row = rowFor(json)
  check('Vencimento próximo → due_soon', row?.status === 'due_soon' && row?.daysToDue === 3, `status=${row?.status} dias=${row?.daysToDue}`)

  // 3) marcar paga
  res = await ctx.request.post(`${BASE}/api/internal/billing`, { data: { action: 'mark_paid', invoiceId } })
  check('mark_paid (200)', res.ok())
  res = await ctx.request.get(`${BASE}/api/internal/billing`); json = await res.json(); row = rowFor(json)
  check('Fatura paga reflete no painel', row?.status === 'paid')

  // 4) charge em fatura paga → 422 (guard, sem chamar Asaas)
  res = await ctx.request.post(`${BASE}/api/internal/billing`, { data: { action: 'charge', invoiceId, billingType: 'BOLETO' } })
  check('charge em fatura paga → rejeitado (422)', res.status() === 422)

  // 5) auth: anônimo → 401
  const anon = await browser.newContext()
  const anonRes = await anon.request.get(`${BASE}/api/internal/billing`)
  check('GET billing exige staff (401 anônimo)', anonRes.status() === 401, `status=${anonRes.status()}`)
  await anon.close()

  await browser.close()
  const passed = results.filter(r => r[1]).length
  console.log(`\n--- RESULTADO: ${passed}/${results.length} ---`)
  if (passed !== results.length) process.exitCode = 1
}

main()
  .catch(e => { console.error('ERRO:', e); process.exitCode = 1 })
  .finally(async () => {
    if (invoiceId) {
      await admin.from('service_nfe_invoices').delete().eq('billing_invoice_id', invoiceId)
      await admin.from('billing_invoices').delete().eq('id', invoiceId)
    }
    if (staffAuthId) {
      await admin.from('staff_users').delete().eq('user_id', staffAuthId)
      await admin.auth.admin.deleteUser(staffAuthId).catch(() => {})
    }
    console.log('cleanup: staff/fatura de teste removidos')
  })
