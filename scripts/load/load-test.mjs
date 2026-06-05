// Teste de carga — jornada concorrente do cliente (menu + perfil + pedido).
// Cria um restaurante de teste isolado, roda VUS jornadas em paralelo (cada uma
// com ITER iterações) e reporta p50/p95/max + taxa de erro por etapa. Limpa tudo.
//
// Config (env): LOAD_BASE (http://localhost:3000), LOAD_VUS (20), LOAD_ITER (5),
//               LOAD_TABLES (10).
//
// Ressalva: contra o dev server (Turbopack, processo único) as métricas da rota
// Next NÃO representam produção; as do Supabase (REST) já são representativas.
import { createClient } from '@supabase/supabase-js'
import WebSocket from 'ws'
import fs from 'node:fs'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import { fileURLToPath } from 'node:url'
if (!globalThis.WebSocket) globalThis.WebSocket = WebSocket

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const env = fs.readFileSync(path.join(ROOT, '.env.local'), 'utf8')
const get = (k) => { const m = env.match(new RegExp('^' + k + '=(.*)$', 'm')); return m ? m[1].trim().replace(/^["']|["']$/g, '') : null }
const URL = get('NEXT_PUBLIC_SUPABASE_URL')
const ANON = get('NEXT_PUBLIC_SUPABASE_ANON_KEY') || get('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY')
const SVC = get('SUPABASE_SERVICE_ROLE_KEY') || get('SUPABASE_SERVICE_ROLE') || get('SUPABASE_SECRET_KEY')
const admin = createClient(URL, SVC, { auth: { persistSession: false } })

const BASE = get('LOAD_BASE') || process.env.LOAD_BASE || 'http://localhost:3000'
const VUS = Number(process.env.LOAD_VUS || 20)
const ITER = Number(process.env.LOAD_ITER || 5)
const TABLES = Number(process.env.LOAD_TABLES || 10)
const STAMP = Date.now()

// ---- métricas ----
const metrics = {} // step -> { ms: number[], ok: number, err: number }
function record(step, ms, ok) {
  const m = metrics[step] ?? (metrics[step] = { ms: [], ok: 0, err: 0 })
  m.ms.push(ms); ok ? m.ok++ : m.err++
}
async function timed(step, fn) {
  const t = Date.now()
  try { const ok = await fn(); record(step, Date.now() - t, ok !== false); return ok }
  catch { record(step, Date.now() - t, false); return false }
}
function pct(arr, p) {
  if (!arr.length) return 0
  const s = [...arr].sort((a, b) => a - b)
  return s[Math.min(s.length - 1, Math.floor((p / 100) * s.length))]
}

// ---- recursos de teste ----
let ownerId = null, restaurantId = null, categoryId = null
const itemIds = [], tableIds = [], customerIds = [], sessionIds = []

async function seed() {
  const email = `load-${STAMP}@smoke.com`
  const { data: u, error: ue } = await admin.auth.admin.createUser({ email, password: 'LoadTest2026!', email_confirm: true })
  if (ue) throw new Error('owner: ' + ue.message)
  ownerId = u.user.id
  const { data: r, error: re } = await admin.from('restaurants').insert({ owner_id: ownerId, name: `Load ${STAMP}`, slug: `load-${STAMP}`, status: 'active' }).select('id').single()
  if (re) throw new Error('restaurant: ' + re.message)
  restaurantId = r.id
  const { data: cat } = await admin.from('menu_categories').insert({ restaurant_id: restaurantId, name: 'Burgers', display_order: 1 }).select('id').single()
  categoryId = cat.id
  for (const [name, price] of [['Classic', 28], ['Cheddar', 32], ['Veggie', 26]]) {
    const { data: it } = await admin.from('menu_items').insert({ restaurant_id: restaurantId, category_id: categoryId, name, price, available: true }).select('id').single()
    itemIds.push(it.id)
  }
  for (let i = 1; i <= TABLES; i++) {
    const { data: t } = await admin.from('tables').insert({ restaurant_id: restaurantId, number: String(i), status: 'free' }).select('id').single()
    if (t) tableIds.push(t.id)
  }
  for (let i = 0; i < VUS; i++) {
    const { data: c } = await admin.from('customers').insert({ first_name: 'Load', last_name: `${STAMP}_${i}`, whatsapp: '55' + STAMP.toString().slice(-9) + String(i).padStart(2, '0') }).select('id').single()
    if (c) customerIds.push(c.id)
  }
  console.log(`seed: restaurante ${restaurantId} · ${itemIds.length} itens · ${tableIds.length} mesas · ${customerIds.length} clientes`)
}

const h = (key) => ({ apikey: key, Authorization: 'Bearer ' + key, 'Content-Type': 'application/json' })

// uma iteração da jornada do cliente
async function journey(vu) {
  // 1) check-in (cria sessão) — escrita Supabase
  const tableId = tableIds[Math.floor(Math.random() * tableIds.length)]
  const customerId = customerIds[vu % customerIds.length]
  let sessionId = null
  await timed('1_checkin (session insert)', async () => {
    const res = await fetch(`${URL}/rest/v1/sessions`, { method: 'POST', headers: { ...h(SVC), Prefer: 'return=representation' }, body: JSON.stringify({ restaurant_id: restaurantId, table_id: tableId, customer_id: customerId, status: 'open' }) })
    if (!res.ok) return false
    sessionId = (await res.json())[0]?.id
    sessionIds.push(sessionId)
    await fetch(`${URL}/rest/v1/session_participants`, { method: 'POST', headers: h(SVC), body: JSON.stringify({ session_id: sessionId, customer_id: customerId }) })
    return true
  })
  if (!sessionId) return

  // 2) carrega o cardápio — leitura Supabase (anon, caminho real do cliente)
  await timed('2_menu (Supabase read)', async () => {
    const res = await fetch(`${URL}/rest/v1/menu_categories?select=*,items:menu_items(*)&restaurant_id=eq.${restaurantId}&order=display_order`, { headers: h(ANON) })
    return res.ok && (await res.json()).length > 0
  })

  // 3) perfil/sessão — rota Next (server-side)
  await timed('3_profile (Next API)', async () => {
    const res = await fetch(`${BASE}/api/customer/profile?session=${sessionId}`)
    return res.ok
  })

  // 4) faz o pedido — escrita Supabase (order + itens)
  await timed('4_order (Supabase write)', async () => {
    const res = await fetch(`${URL}/rest/v1/orders`, { method: 'POST', headers: { ...h(SVC), Prefer: 'return=representation' }, body: JSON.stringify({ restaurant_id: restaurantId, session_id: sessionId, customer_id: customerId, status: 'pending' }) })
    if (!res.ok) return false
    const orderId = (await res.json())[0]?.id
    const n = 1 + Math.floor(Math.random() * 3)
    const items = Array.from({ length: n }, () => { const id = itemIds[Math.floor(Math.random() * itemIds.length)]; return { order_id: orderId, menu_item_id: id, quantity: 1 + Math.floor(Math.random() * 2), unit_price: 28 } })
    const ir = await fetch(`${URL}/rest/v1/order_items`, { method: 'POST', headers: h(SVC), body: JSON.stringify(items) })
    return ir.ok
  })
}

async function vu(i) {
  for (let k = 0; k < ITER; k++) await journey(i)
}

async function main() {
  console.log(`\n=== Teste de carga · ${VUS} VUs × ${ITER} iter = ${VUS * ITER} jornadas · alvo ${BASE} ===`)
  await seed()
  const t0 = Date.now()
  await Promise.all(Array.from({ length: VUS }, (_, i) => vu(i)))
  const totalSec = (Date.now() - t0) / 1000

  console.log(`\n--- Resultado (${totalSec.toFixed(1)}s) ---`)
  console.log('etapa'.padEnd(30), 'n'.padStart(5), 'erros'.padStart(6), 'p50'.padStart(7), 'p95'.padStart(7), 'max'.padStart(7))
  let totalReq = 0, totalErr = 0
  for (const step of Object.keys(metrics).sort()) {
    const m = metrics[step]; totalReq += m.ms.length; totalErr += m.err
    console.log(step.padEnd(30), String(m.ms.length).padStart(5), String(m.err).padStart(6), `${pct(m.ms, 50)}ms`.padStart(7), `${pct(m.ms, 95)}ms`.padStart(7), `${Math.max(...m.ms)}ms`.padStart(7))
  }
  const rps = (totalReq / totalSec).toFixed(1)
  const errPct = ((totalErr / totalReq) * 100).toFixed(2)
  console.log(`\ntotal: ${totalReq} req · ${totalErr} erros (${errPct}%) · ${rps} req/s`)
  console.log(errPct === '0.00' ? '✅ sem erros sob carga' : '⚠️ houve erros — investigar')
}

main()
  .catch(e => { console.error('ERRO:', e); process.exitCode = 1 })
  .finally(async () => {
    // cascata do restaurante remove sessões/pedidos/itens/mesas/cardápio
    if (restaurantId) await admin.from('restaurants').delete().eq('id', restaurantId)
    for (const id of customerIds) await admin.from('customers').delete().eq('id', id)
    if (ownerId) await admin.auth.admin.deleteUser(ownerId).catch(() => {})
    console.log('cleanup: restaurante (cascata) + clientes + owner removidos')
  })
