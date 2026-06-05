// Verificação E2E: exportação do Analytics (CSV + HTML imprimível).
// Semeia um pagamento, loga como dono e baixa os dois formatos; valida
// conteúdo (resumo, itens, ticket médio) e o gating de auth.
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
const TABLE_ID = '1f87550a-4586-48ed-9fd8-e166658f61e5'
const MENU_ITEM_ID = 'cdffc5d7-7918-42fa-8805-6857e7651f5e'
const OWNER_EMAIL = 'smoke-garcom-owner-1780586566030@smoke.com'
const OWNER_PASS = 'SmokeTest2026!'

const results = []
const check = (label, ok, extra = '') => { results.push([label, ok]); console.log(`${ok ? '✅' : '❌'} ${label}${extra ? ' — ' + extra : ''}`) }

let sessionId = null, customerId = null, orderId = null, paymentId = null

async function setup() {
  const { data: c } = await admin.from('customers').insert({ first_name: 'Exp', last_name: 'Ort', whatsapp: '5511' + Math.floor(100000000 + Math.random() * 800000000) }).select('id').single()
  customerId = c.id
  const { data: s } = await admin.from('sessions').insert({ restaurant_id: RID, table_id: TABLE_ID, status: 'open' }).select('id').single()
  sessionId = s.id
  const { data: o } = await admin.from('orders').insert({ restaurant_id: RID, session_id: sessionId, customer_id: customerId, status: 'delivered' }).select('id').single()
  orderId = o.id
  await admin.from('order_items').insert({ order_id: orderId, menu_item_id: MENU_ITEM_ID, quantity: 2, unit_price: 25.9 })
  const { data: p } = await admin.from('payments').insert({
    restaurant_id: RID, session_id: sessionId, customer_id: customerId, amount: 51.8, method: 'pix', status: 'paid', paid_at: new Date().toISOString(),
  }).select('id').single()
  paymentId = p.id
}

async function main() {
  await setup()
  const browser = await chromium.launch()
  const ctx = await browser.newContext()
  const page = await ctx.newPage()
  await page.goto(`${BASE}/login?perfil=admin`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(800)
  await page.locator('input[type="email"]').first().fill(OWNER_EMAIL)
  await page.locator('input[type="password"]').first().fill(OWNER_PASS)
  await page.locator('button[type="submit"]').first().click()
  await page.waitForURL('**/dashboard**', { timeout: 30000 }).catch(() => {})
  await page.waitForTimeout(1500)

  // CSV
  const csvRes = await ctx.request.get(`${BASE}/api/dashboard/reports/export?period=week&format=csv`)
  const csv = await csvRes.text()
  const ct = csvRes.headers()['content-type'] ?? ''
  check('CSV 200 + content-type csv', csvRes.status() === 200 && ct.includes('text/csv'), `ct=${ct}`)
  check('CSV tem seções e ticket médio', /Resumo/.test(csv) && /Itens mais vendidos/.test(csv) && /Ticket médio por mesa/.test(csv))
  check('CSV inclui item semeado', /Item Smoke/.test(csv))

  // HTML imprimível
  const htmlRes = await ctx.request.get(`${BASE}/api/dashboard/reports/export?period=week&format=html`)
  const html = await htmlRes.text()
  const hct = htmlRes.headers()['content-type'] ?? ''
  check('HTML 200 + content-type html', htmlRes.status() === 200 && hct.includes('text/html'), `ct=${hct}`)
  check('HTML é relatório (tabelas + título)', /<table/.test(html) && /Analytics/.test(html) && /Itens mais vendidos/.test(html))

  // auth
  const anon = await browser.newContext()
  const anonRes = await anon.request.get(`${BASE}/api/dashboard/reports/export?period=week`)
  check('Export exige dono (401 anônimo)', anonRes.status() === 401, `status=${anonRes.status()}`)
  await anon.close()

  await browser.close()
  const passed = results.filter(r => r[1]).length
  console.log(`\n--- RESULTADO: ${passed}/${results.length} ---`)
  if (passed !== results.length) process.exitCode = 1
}

main()
  .catch(e => { console.error('ERRO:', e); process.exitCode = 1 })
  .finally(async () => {
    if (paymentId) await admin.from('payments').delete().eq('id', paymentId)
    if (orderId) { await admin.from('order_items').delete().eq('order_id', orderId); await admin.from('orders').delete().eq('id', orderId) }
    if (sessionId) await admin.from('sessions').delete().eq('id', sessionId)
    if (customerId) await admin.from('customers').delete().eq('id', customerId)
    console.log('cleanup: dados de teste removidos')
  })
