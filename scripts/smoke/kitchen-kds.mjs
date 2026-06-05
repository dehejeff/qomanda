// Verificação E2E: KDS (painel de cozinha). Semeia um pedido com itens, loga
// como dono, abre /cozinha e confere: pedido + itens na tela, avançar status
// (Aceitar → confirmed no banco) e a comanda imprimível (popup).
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
const MENU_ITEM_ID = 'cdffc5d7-7918-42fa-8805-6857e7651f5e' // "Item Smoke"
const OWNER_EMAIL = 'smoke-garcom-owner-1780586566030@smoke.com'
const OWNER_PASS = 'SmokeTest2026!'

const results = []
const check = (label, ok, extra = '') => { results.push([label, ok]); console.log(`${ok ? '✅' : '❌'} ${label}${extra ? ' — ' + extra : ''}`) }
let sessionId = null, customerId = null, orderId = null

async function setup() {
  const { data: c } = await admin.from('customers').insert({ first_name: 'KDS', last_name: 'Teste', whatsapp: '5511' + Math.floor(100000000 + Math.random() * 800000000) }).select('id').single()
  customerId = c.id
  const { data: s } = await admin.from('sessions').insert({ restaurant_id: RID, table_id: TABLE_ID, customer_id: customerId, status: 'open' }).select('id').single()
  sessionId = s.id
  const { data: o } = await admin.from('orders').insert({ restaurant_id: RID, session_id: sessionId, customer_id: customerId, status: 'pending' }).select('id').single()
  orderId = o.id
  await admin.from('order_items').insert({ order_id: orderId, menu_item_id: MENU_ITEM_ID, quantity: 2, unit_price: 25.9, notes: 'sem cebola' })
  console.log('setup: order', orderId)
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
  await page.waitForTimeout(1200)

  await page.goto(`${BASE}/cozinha`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(3000)
  const txt = await page.locator('body').innerText().catch(() => '')
  check('KDS abre (título + colunas)', /KDS/.test(txt) && /Novos/i.test(txt) && /Preparando/i.test(txt))
  check('Pedido aparece com item e observação', /Item Smoke/.test(txt) && /sem cebola/i.test(txt))
  check('Botão de avançar (Aceitar)', /Aceitar/i.test(txt))

  // avançar o MEU pedido (há outros pendentes no restaurante): mira pelo
  // data-order-id. Aceitar → confirmed no banco (poll p/ cold-compile).
  await page.locator(`[data-order-id="${orderId}"]`).getByRole('button', { name: 'Aceitar' }).click().catch(e => console.log('   [click] erro:', e.message))
  let status = 'pending'
  for (let i = 0; i < 12; i++) {
    await page.waitForTimeout(1000)
    const { data } = await admin.from('orders').select('status').eq('id', orderId).single()
    status = data?.status ?? 'pending'
    if (status !== 'pending') break
  }
  check('Avançar muda status no banco (pending→confirmed)', status === 'confirmed', `status=${status}`)

  // comanda imprimível: clicar no botão de imprimir abre popup com a comanda
  let comandaOk = false
  try {
    const [popup] = await Promise.all([
      ctx.waitForEvent('page', { timeout: 5000 }),
      page.getByRole('button', { name: 'Imprimir comanda' }).first().click(),
    ])
    const ptxt = await popup.content().catch(() => '') // HTML já escrito via document.write
    comandaOk = /Item Smoke/.test(ptxt) && /cozinha/i.test(ptxt)
    await popup.close().catch(() => {})
  } catch { /* popup pode autofechar rápido */ }
  check('Comanda imprimível gerada (popup com itens)', comandaOk)

  await browser.close()
  const passed = results.filter(r => r[1]).length
  console.log(`\n--- RESULTADO: ${passed}/${results.length} ---`)
  if (passed !== results.length) process.exitCode = 1
}

main()
  .catch(e => { console.error('ERRO:', e); process.exitCode = 1 })
  .finally(async () => {
    if (orderId) { await admin.from('order_items').delete().eq('order_id', orderId); await admin.from('orders').delete().eq('id', orderId) }
    if (sessionId) await admin.from('sessions').delete().eq('id', sessionId)
    if (customerId) await admin.from('customers').delete().eq('id', customerId)
    console.log('cleanup: pedido/sessão/cliente de teste removidos')
  })
