// Verificação E2E: Analytics dashboard. Semeia pedido + itens + pagamento PIX
// e confere que a página /dashboard/reports renderiza dados reais (itens mais
// vendidos, métodos, horários, dia da semana) para o dono autenticado.
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
const MENU_ITEM_ID = 'cdffc5d7-7918-42fa-8805-6857e7651f5e' // "Item Smoke" R$25,90
const OWNER_EMAIL = 'smoke-garcom-owner-1780586566030@smoke.com'
const OWNER_PASS = 'SmokeTest2026!'

const results = []
const check = (label, ok) => { results.push([label, ok]); console.log(`${ok ? '✅' : '❌'} ${label}`) }

let sessionId = null, customerId = null, orderId = null, paymentId = null

async function setup() {
  const { data: c } = await admin.from('customers').insert({ first_name: 'Ana', last_name: 'Analytics', whatsapp: '5511' + Math.floor(100000000 + Math.random() * 800000000) }).select('id').single()
  customerId = c.id
  const { data: s } = await admin.from('sessions').insert({ restaurant_id: RID, table_id: TABLE_ID, status: 'open' }).select('id').single()
  sessionId = s.id
  const { data: o } = await admin.from('orders').insert({ restaurant_id: RID, session_id: sessionId, customer_id: customerId, status: 'delivered' }).select('id').single()
  orderId = o.id
  await admin.from('order_items').insert({ order_id: orderId, menu_item_id: MENU_ITEM_ID, quantity: 2, unit_price: 25.9 })
  const now = new Date().toISOString()
  const { data: p } = await admin.from('payments').insert({
    restaurant_id: RID, session_id: sessionId, customer_id: customerId,
    amount: 51.8, method: 'pix', status: 'paid', paid_at: now,
  }).select('id').single()
  paymentId = p.id
  console.log('setup: order', orderId, '| payment', paymentId)
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

  await page.goto(`${BASE}/dashboard/reports`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(4000) // carrega analytics (período semana)

  const text = await page.locator('body').innerText().catch(() => '')

  check('Título Analytics', /Analytics/i.test(text))
  check('Seção Itens mais vendidos', /Itens mais vendidos/i.test(text))
  check('Item semeado aparece no top', /Item Smoke/.test(text))
  check('Seção Métodos de pagamento + PIX', /Métodos de pagamento/i.test(text) && /PIX/.test(text))
  check('Seção Faturamento por hora', /Faturamento por hora/i.test(text))
  check('Seção dia da semana', /dia da semana/i.test(text))
  check('Insights de pico (horário/dia)', /Horário de pico/i.test(text) && /Dia mais forte/i.test(text))

  await page.screenshot({ path: path.join(ROOT, 'scripts', 'smoke', '.cache', 'analytics.png'), fullPage: true }).catch(() => {})
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
