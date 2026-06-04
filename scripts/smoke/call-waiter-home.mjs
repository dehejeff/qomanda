// Verificação E2E: home do cliente — botão "Chamar Garçom" ativado no acesso
// rápido + re-alerta a cada chamado real (throttle só para não-atendidos).
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

const results = []
const check = (label, ok) => { results.push([label, ok]); console.log(`${ok ? '✅' : '❌'} ${label}`) }

let sessionId = null, customerId = null, slug = null

async function countCalls() {
  const { count } = await admin.from('restaurant_notifications')
    .select('id', { count: 'exact', head: true })
    .eq('session_id', sessionId).eq('type', 'call_waiter')
  return count ?? 0
}
async function callViaApi() {
  const res = await fetch(`${BASE}/api/customer/call-waiter`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionId }),
  })
  return res.json()
}

async function setup() {
  const { data: r } = await admin.from('restaurants').select('slug').eq('id', RID).single()
  slug = r.slug
  const { data: c } = await admin.from('customers').insert({ first_name: 'Jeff', last_name: 'Teste', whatsapp: '5511' + Math.floor(100000000 + Math.random() * 800000000) }).select('id').single()
  customerId = c.id
  const { data: s } = await admin.from('sessions').insert({ restaurant_id: RID, table_id: TABLE_ID, status: 'open' }).select('id').single()
  sessionId = s.id
  await admin.from('session_participants').insert({ session_id: sessionId, customer_id: customerId })
  console.log('setup: slug', slug, '| session', sessionId)
}

async function main() {
  await setup()

  // --- Re-alerta (endpoint real) ---
  const r1 = await callViaApi()
  check('1º chamado cria notificação', r1.ok === true && !r1.throttled && (await countCalls()) === 1)

  const r2 = await callViaApi()
  check('2º chamado imediato é throttled (não duplica)', r2.throttled === true && (await countCalls()) === 1)

  // garçom atende (marca lido)
  await admin.from('restaurant_notifications').update({ read_at: new Date().toISOString() })
    .eq('session_id', sessionId).eq('type', 'call_waiter')

  const r3 = await callViaApi()
  check('Após atendido, novo chamado alerta de novo', r3.ok === true && !r3.throttled && (await countCalls()) === 2)

  // --- UI: card ativado + sem banner no topo ---
  const browser = await chromium.launch()
  const page = await browser.newPage()
  await page.addInitScript(() => {
    localStorage.setItem('qomanda_customer_name', 'Jefferson')
  })
  await page.goto(`${BASE}/${slug}/home?session=${sessionId}`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(3500)

  const cardVisible = await page.getByText('Toque para chamar').first().isVisible().catch(() => false)
  check('Card "Chamar Garçom" ativado (Toque para chamar)', cardVisible)

  const semBreve = !(await page.getByText('Em breve').first().isVisible().catch(() => false))
  check('Removido o "Em breve"', semBreve)

  // limpa o lido para o clique da UI não ser throttled
  await admin.from('restaurant_notifications').update({ read_at: new Date().toISOString() })
    .eq('session_id', sessionId).eq('type', 'call_waiter')
  const before = await countCalls()
  await page.getByText('Toque para chamar').first().click().catch(() => {})
  await page.waitForTimeout(2500)
  const after = await countCalls()
  check('Clicar no card dispara chamado', after === before + 1)

  await browser.close()

  const passed = results.filter(r => r[1]).length
  console.log(`\n--- RESULTADO: ${passed}/${results.length} ---`)
  if (passed !== results.length) process.exitCode = 1
}

main()
  .catch(e => { console.error('ERRO:', e); process.exitCode = 1 })
  .finally(async () => {
    if (sessionId) {
      await admin.from('restaurant_notifications').delete().eq('session_id', sessionId).eq('type', 'call_waiter')
      await admin.from('session_participants').delete().eq('session_id', sessionId)
      await admin.from('sessions').delete().eq('id', sessionId)
    }
    if (customerId) await admin.from('customers').delete().eq('id', customerId)
    console.log('cleanup: sessão/cliente/chamados de teste removidos')
  })
