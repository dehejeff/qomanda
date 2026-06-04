// Verificação E2E: garçom monta pedido por pessoa.
// Setup (admin): sessão aberta + 2 participantes. Garçom loga e, via API
// autenticada, lê o contexto (pessoas + cardápio) e cria pedido para uma
// pessoa. Confere customer_id e preço calculado no servidor + sondas de erro.
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
const WAITER_EMAIL = 'smoke-garcom-waiter-1780586566030@smoke.com'
const WAITER_PASS = 'SmokeTest2026!'

const results = []
const check = (label, ok) => { results.push([label, ok]); console.log(`${ok ? '✅' : '❌'} ${label}`) }

let sessionId = null
const customerIds = []
let createdWaiterAuthId = null

async function ensureWaiterAuth() {
  const { data } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 })
  const existing = (data?.users ?? []).find(u => (u.email ?? '').toLowerCase() === WAITER_EMAIL)
  if (existing) return
  const { data: created, error } = await admin.auth.admin.createUser({
    email: WAITER_EMAIL, password: WAITER_PASS, email_confirm: true,
  })
  if (error) throw new Error('waiter auth: ' + error.message)
  createdWaiterAuthId = created.user.id
  console.log('setup: usuário Auth do garçom criado para o teste')
}

async function setup() {
  await ensureWaiterAuth()
  // 2 clientes
  for (const n of ['Ana Teste', 'Bruno Teste']) {
    const [first, last] = n.split(' ')
    const wa = '5511' + Math.floor(100000000 + Math.random() * 800000000)
    const { data, error } = await admin.from('customers').insert({ first_name: first, last_name: last, whatsapp: wa }).select('id').single()
    if (error) throw new Error('customer: ' + error.message)
    customerIds.push(data.id)
  }
  // sessão aberta
  const { data: s, error: se } = await admin.from('sessions').insert({ restaurant_id: RID, table_id: TABLE_ID, status: 'open' }).select('id').single()
  if (se) throw new Error('session: ' + se.message)
  sessionId = s.id
  // participantes
  for (const cid of customerIds) {
    const { error } = await admin.from('session_participants').insert({ session_id: sessionId, customer_id: cid })
    if (error) throw new Error('participant: ' + error.message)
  }
  console.log('setup: session', sessionId, '| participantes', customerIds.length)
}

async function main() {
  await setup()
  const browser = await chromium.launch()
  const ctx = await browser.newContext()

  // login do garçom (UI) → cookies autenticados (signIn grava cookies mesmo
  // antes do redirect, então não dependemos da navegação)
  const page = await ctx.newPage()
  await page.goto(`${BASE}/login?perfil=garcom`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(1000) // deixa o seletor de perfil (waiter) assentar
  await page.locator('input[type="email"]').first().fill(WAITER_EMAIL)
  await page.locator('input[type="password"]').first().fill(WAITER_PASS)
  await page.locator('button[type="submit"]').first().click()
  await page.waitForURL('**/garcom/**', { timeout: 45000 }).catch(() => {})
  await page.waitForTimeout(2000)
  console.log('   pós-login URL:', page.url())

  // 1) contexto do pedido
  const ctxRes = await ctx.request.get(`${BASE}/api/dashboard/waiter/order?sessionId=${sessionId}`)
  const ctxData = await ctxRes.json()
  const menuItem = ctxData.menu?.[0]?.items?.[0]
  console.log('   contexto:', ctxRes.status(), 'participantes=', ctxData.participants?.length, 'item=', menuItem?.name, menuItem?.effectivePrice)
  check('Contexto traz participantes da mesa', ctxRes.ok() && ctxData.participants?.length === 2)
  check('Contexto traz cardápio com item', Boolean(menuItem?.id))

  // 2) cria pedido para a 1ª pessoa (qtd 2)
  const targetCustomer = customerIds[0]
  const createRes = await ctx.request.post(`${BASE}/api/dashboard/waiter/order`, {
    data: { sessionId, customerId: targetCustomer, items: [{ menuItemId: menuItem.id, quantity: 2 }] },
  })
  const createData = await createRes.json()
  console.log('   criação:', createRes.status(), JSON.stringify(createData))
  check('Pedido criado (ok)', createRes.ok() && createData.ok === true)
  check('Total = preço do servidor × qtd', Math.abs((createData.total ?? 0) - menuItem.effectivePrice * 2) < 0.001)

  // 3) confere no banco: customer_id correto + unit_price do servidor
  const { data: order } = await admin.from('orders').select('id, customer_id, status').eq('id', createData.orderId).maybeSingle()
  const { data: oi } = await admin.from('order_items').select('quantity, unit_price').eq('order_id', createData.orderId)
  console.log('   order:', JSON.stringify(order), '| items:', JSON.stringify(oi))
  check('Pedido vinculado à pessoa certa', order?.customer_id === targetCustomer)
  check('unit_price veio do banco (não do cliente)', oi?.[0] && Math.abs(Number(oi[0].unit_price) - menuItem.effectivePrice) < 0.001 && oi[0].quantity === 2)

  // 4) sondas de segurança
  const bogus = await ctx.request.post(`${BASE}/api/dashboard/waiter/order`, {
    data: { sessionId, customerId: '00000000-0000-0000-0000-000000000000', items: [{ menuItemId: menuItem.id, quantity: 1 }] },
  })
  check('🔍 customerId fora da mesa → rejeitado', bogus.status() === 400)

  const empty = await ctx.request.post(`${BASE}/api/dashboard/waiter/order`, { data: { sessionId, items: [] } })
  check('🔍 pedido sem itens → rejeitado', empty.status() === 400)

  const badItem = await ctx.request.post(`${BASE}/api/dashboard/waiter/order`, {
    data: { sessionId, items: [{ menuItemId: '00000000-0000-0000-0000-000000000000', quantity: 1 }] },
  })
  check('🔍 item inexistente → rejeitado', badItem.status() === 400)

  // 5) UI: a página de pedido renback renderiza pessoas + item
  await page.goto(`${BASE}/garcom/pedido?session=${sessionId}`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2500)
  const personVisible = await page.getByText('Ana').first().isVisible().catch(() => false)
  const itemVisible = await page.getByText(menuItem.name).first().isVisible().catch(() => false)
  check('UI mostra pessoa e item do cardápio', personVisible && itemVisible)

  await browser.close()

  const passed = results.filter(r => r[1]).length
  console.log(`\n--- RESULTADO: ${passed}/${results.length} ---`)
  if (passed !== results.length) process.exitCode = 1
}

main()
  .catch(e => { console.error('ERRO:', e); process.exitCode = 1 })
  .finally(async () => {
    if (sessionId) {
      const { data: orders } = await admin.from('orders').select('id').eq('session_id', sessionId)
      for (const o of orders ?? []) await admin.from('order_items').delete().eq('order_id', o.id)
      await admin.from('orders').delete().eq('session_id', sessionId)
      await admin.from('session_participants').delete().eq('session_id', sessionId)
      await admin.from('sessions').delete().eq('id', sessionId)
    }
    for (const cid of customerIds) await admin.from('customers').delete().eq('id', cid)
    if (createdWaiterAuthId) {
      // o login back-fill o user_id no membro; limpa antes de remover o auth user
      await admin.from('restaurant_members').update({ user_id: null }).eq('user_id', createdWaiterAuthId)
      await admin.auth.admin.deleteUser(createdWaiterAuthId).catch(() => {})
    }
    console.log('cleanup: sessão/pedidos/clientes/usuário de teste removidos')
  })
