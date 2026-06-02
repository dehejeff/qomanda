/**
 * Smoke test E2E — App Garçom (/garcom)
 *
 * Pré-requisitos:
 *   npm run dev   (em outro terminal)
 *   npm install --save-dev playwright && npx playwright install chromium
 *
 * Uso:
 *   node scripts/smoke/garcom-smoke.mjs
 *   BASE_URL=http://localhost:3000 node scripts/smoke/garcom-smoke.mjs
 */

import { readFileSync, writeFileSync, mkdirSync } from 'fs'
import { resolve } from 'path'
import { randomUUID } from 'crypto'
import { createClient } from '@supabase/supabase-js'
import { chromium } from 'playwright'

const BASE = process.env.BASE_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3001'
const PASSWORD = process.env.SMOKE_PASSWORD ?? 'SmokeTest2026!'
const STAMP = Date.now()
const OWNER_EMAIL = `smoke-garcom-owner-${STAMP}@smoke.com`
const WAITER_EMAIL = `smoke-garcom-waiter-${STAMP}@smoke.com`

function loadEnvLocal() {
  try {
    const raw = readFileSync(resolve(process.cwd(), '.env.local'), 'utf8')
    for (const line of raw.split('\n')) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) continue
      const eq = trimmed.indexOf('=')
      if (eq === -1) continue
      const key = trimmed.slice(0, eq)
      const val = trimmed.slice(eq + 1)
      if (!process.env[key]) process.env[key] = val
    }
  } catch { /* ok */ }
}

loadEnvLocal()

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!url || !serviceKey) {
  console.error('Defina NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY.')
  process.exit(1)
}

const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } })

const results = []
function pass(step, detail = '') { results.push({ step, ok: true, detail }); console.log(`  ✅ ${step}${detail ? ` — ${detail}` : ''}`) }
function fail(step, detail = '') { results.push({ step, ok: false, detail }); console.error(`  ❌ ${step}${detail ? ` — ${detail}` : ''}`) }

async function setup() {
  console.log('\n📦 Setup (service role)...')

  const { data: ownerAuth, error: ownerErr } = await admin.auth.admin.createUser({
    email: OWNER_EMAIL,
    password: PASSWORD,
    email_confirm: true,
    user_metadata: { name: 'Smoke Owner' },
  })
  if (ownerErr) throw new Error(`Owner: ${ownerErr.message}`)

  const { data: waiterAuth, error: waiterErr } = await admin.auth.admin.createUser({
    email: WAITER_EMAIL,
    password: PASSWORD,
    email_confirm: true,
    user_metadata: { name: 'Smoke Garçom' },
  })
  if (waiterErr) throw new Error(`Waiter: ${waiterErr.message}`)

  const slug = `smoke-garcom-${STAMP}`

  const { data: restaurant, error: restErr } = await admin.from('restaurants').insert({
    owner_id: ownerAuth.user.id,
    name: `Smoke Garçom ${STAMP}`,
    slug,
    operational_mode: 'dine_in',
    restaurant_model: 'salao',
    payment_gateway_provider: 'manual',
    manual_pix_key: '11999999999',
  }).select('id').single()
  if (restErr) throw new Error(`Restaurant: ${restErr.message}`)

  const restaurantId = restaurant.id

  await admin.from('restaurant_members').insert({
    restaurant_id: restaurantId,
    email: WAITER_EMAIL.toLowerCase(),
    name: 'Garçom Smoke',
    role: 'waiter',
    user_id: waiterAuth.user.id,
    active: true,
  })

  const { data: table } = await admin.from('tables').insert({
    restaurant_id: restaurantId,
    number: '99',
    status: 'free',
    check_in_token: randomUUID(),
  }).select('id, check_in_token').single()

  const { data: customer } = await admin.from('customers').insert({
    first_name: 'Cliente',
    last_name: 'Smoke',
    whatsapp: `5511999${String(STAMP).slice(-7)}`,
  }).select('id').single()

  const { data: session } = await admin.from('sessions').insert({
    table_id: table.id,
    restaurant_id: restaurantId,
    customer_id: customer.id,
    status: 'open',
  }).select('id').single()

  await admin.from('session_participants').insert({
    session_id: session.id,
    customer_id: customer.id,
  })

  const { data: category } = await admin.from('menu_categories').insert({
    restaurant_id: restaurantId,
    name: 'Smoke',
    display_order: 0,
  }).select('id').single()

  const { data: menuItem } = await admin.from('menu_items').insert({
    restaurant_id: restaurantId,
    category_id: category.id,
    name: 'Item Smoke',
    price: 25.9,
    available: true,
  }).select('id').single()

  const { data: order } = await admin.from('orders').insert({
    restaurant_id: restaurantId,
    session_id: session.id,
    customer_id: customer.id,
    status: 'pending',
    order_channel: 'table',
  }).select('id').single()

  await admin.from('order_items').insert({
    order_id: order.id,
    menu_item_id: menuItem.id,
    quantity: 1,
    unit_price: 25.9,
  })

  const { data: payment } = await admin.from('payments').insert({
    restaurant_id: restaurantId,
    session_id: session.id,
    customer_id: customer.id,
    amount: 25.9,
    method: 'cash',
    status: 'pending',
  }).select('id').single()

  const { data: loyaltyRule } = await admin.from('loyalty_rules').insert({
    restaurant_id: restaurantId,
    rule_type: 'visits',
    visit_count: 1,
    benefit_type: 'custom',
    benefit_value: 'Sobremesa cortesia smoke',
    active: true,
  }).select('id').single()

  const { error: offerErr } = await admin.from('customer_offers').insert({
    restaurant_id: restaurantId,
    customer_id: customer.id,
    benefit_type: 'custom',
    benefit_value: 'Sobremesa cortesia smoke',
    label: 'Benefício smoke garçom',
    status: 'active',
  })
  if (offerErr) throw new Error(`customer_offers: ${offerErr.message}`)

  const ctx = {
    slug,
    restaurantId,
    tableId: table.id,
    sessionId: session.id,
    orderId: order.id,
    paymentId: payment.id,
    waiterEmail: WAITER_EMAIL,
    password: PASSWORD,
  }

  const outDir = resolve(process.cwd(), 'scripts/smoke/.cache')
  mkdirSync(outDir, { recursive: true })
  writeFileSync(resolve(outDir, 'garcom-smoke-data.json'), JSON.stringify(ctx, null, 2))

  pass('Setup Supabase', `restaurant=${slug}`)

  const { count: openSess } = await admin.from('sessions').select('id', { count: 'exact', head: true }).eq('restaurant_id', restaurantId).eq('status', 'open')
  const { count: offerCount } = await admin.from('customer_offers').select('id', { count: 'exact', head: true }).eq('restaurant_id', restaurantId).eq('status', 'active')
  if ((openSess ?? 0) < 1 || (offerCount ?? 0) < 1) {
    throw new Error(`Setup incompleto: sessions=${openSess} offers=${offerCount}`)
  }

  return ctx
}

async function runUi(ctx) {
  console.log('\n🎭 UI Playwright (/garcom)...')

  const browser = await chromium.launch({ headless: true })
  const page = await browser.newPage()

  try {
    await page.goto(`${BASE}/login?perfil=garcom`, { waitUntil: 'domcontentloaded', timeout: 30_000 })
    pass('Login page carrega')

    await page.locator('button').filter({ hasText: 'Garçom' }).first().click()
    await page.waitForSelector('text=Acesso garçom', { timeout: 10_000 })
    await page.getByPlaceholder('garcom@restaurante.com').fill(ctx.waiterEmail)
    await page.locator('input[type="password"]').fill(ctx.password)
    await page.click('button[type="submit"]')
    await page.waitForURL('**/garcom/pedidos**', { timeout: 20_000 })
    await page.waitForSelector('text=Fila de pedidos', { timeout: 15_000 })
    pass('Login garçom → /garcom/pedidos')

    const pedidoText = await page.textContent('body')
    if (pedidoText?.includes('Fila de pedidos')) pass('Aba Pedidos visível')
    else fail('Aba Pedidos visível', 'texto não encontrado')

    if (pedidoText?.includes('pagamento') || pedidoText?.includes('Pagamento')) {
      pass('Alerta pagamento pendente na fila')
    } else {
      fail('Alerta pagamento pendente na fila')
    }

    const advanceBtn = page.locator('button:has-text("Confirmar"), button:has-text("Preparar"), button:has-text("Pronto")').first()
    if (await advanceBtn.count()) {
      await advanceBtn.click()
      await page.waitForTimeout(1500)
      pass('Avançar status do pedido')
    } else {
      fail('Avançar status do pedido', 'botão não encontrado')
    }

    await page.goto(`${BASE}/garcom/beneficios`, { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(500)
    const alertData = await page.evaluate(async () => {
      const r = await fetch('/api/dashboard/waiter/alerts')
      return { status: r.status, ...(await r.json()) }
    })
    if (alertData.status === 200 && (alertData.activeCount ?? 0) > 0) {
      pass('Aba Benefícios — fidelidade visível (API)')
    } else {
      fail('Aba Benefícios — fidelidade visível', JSON.stringify(alertData))
    }
    try {
      await page.waitForSelector('text=Benefício smoke', { timeout: 8_000 })
      pass('Aba Benefícios — UI renderizada')
    } catch {
      fail('Aba Benefícios — UI renderizada')
    }

    await Promise.all([
      page.waitForResponse(r => r.url().includes('/api/dashboard/waiter/tables') && r.status() === 200),
      page.goto(`${BASE}/garcom/mesas`, { waitUntil: 'domcontentloaded' }),
    ])
    try {
      await page.waitForSelector('button:has-text("99")', { timeout: 8_000 })
      const mesaBtn = page.locator('button:has-text("99")').first()
      await mesaBtn.click()
      await page.waitForResponse(r => r.url().includes('/api/dashboard/waiter/tables/') && r.status() === 200)
      await page.waitForSelector('text=Consumo', { timeout: 8_000 })
      pass('Abrir detalhe da mesa 99')
      pass('Sheet mesa — detalhes')

      const closeBtn = page.locator('button:has-text("Solicitar fechamento")').first()
      await closeBtn.waitFor({ state: 'visible', timeout: 5_000 })
      await closeBtn.click({ force: true })
      await page.waitForTimeout(1500)
      pass('Solicitar fechamento de mesa')
    } catch (e) {
      fail('Mesas / fechamento', e instanceof Error ? e.message : 'falhou')
    }

    await page.goto(`${BASE}/garcom/pagamentos`, { waitUntil: 'networkidle' })
    const payBody = await page.textContent('body')
    if (payBody?.includes('Informou') || payBody?.includes('Valor recebido')) {
      pass('Aba Pagamentos — pendente listado')
      const okBtn = page.locator('button:has-text("OK")').first()
      if (await okBtn.count()) {
        await okBtn.click()
        await page.waitForTimeout(2000)
        pass('Confirmar pagamento dinheiro')
      } else fail('Confirmar pagamento dinheiro')
    } else {
      fail('Aba Pagamentos — pendente listado')
    }

    await page.goto(`${BASE}/dashboard/waiter`, { waitUntil: 'networkidle' })
    if (page.url().includes('/garcom/')) pass('Redirect legado /dashboard/waiter → /garcom')
    else fail('Redirect legado /dashboard/waiter', page.url())
  } catch (err) {
    fail('UI exception', err instanceof Error ? err.message : String(err))
  } finally {
    await browser.close()
  }
}

async function cleanup(ctx) {
  console.log('\n🧹 Cleanup...')
  try {
    await admin.from('restaurants').delete().eq('id', ctx.restaurantId)
    pass('Cleanup restaurante smoke')
  } catch (e) {
    console.warn('  ⚠ Cleanup parcial:', e.message)
  }
  try {
    const users = [ctx.waiterEmail, OWNER_EMAIL]
    for (const email of users) {
      const { data } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 })
      const u = data.users.find(x => x.email === email)
      if (u) await admin.auth.admin.deleteUser(u.id)
    }
    pass('Cleanup usuários auth')
  } catch { /* ok */ }
}

async function main() {
  console.log('═══════════════════════════════════════')
  console.log(' Smoke Garçom — /garcom')
  console.log(` BASE: ${BASE}`)
  console.log('═══════════════════════════════════════')

  let ctx
  try {
    ctx = await setup()
    await runUi(ctx)
  } catch (err) {
    console.error('\n💥 Falha fatal:', err)
    process.exitCode = 1
  } finally {
    if (ctx) await cleanup(ctx)
  }

  const failed = results.filter(r => !r.ok)
  console.log('\n═══════════════════════════════════════')
  console.log(` Resultado: ${results.length - failed.length}/${results.length} passou`)
  if (failed.length) {
    console.log(' Falhas:', failed.map(f => f.step).join(', '))
    process.exitCode = 1
  } else {
    console.log(' ✅ Todos os passos passaram')
  }
  console.log('═══════════════════════════════════════\n')
}

main()
