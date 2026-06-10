// Smoke do Flow A — reserva de grupo pelo grid (Mesas → selecionar → reserveTables).
// Usa service role para simular a mesma lógica da API e validar cancelByTable em grupo.
import { createClient } from '@supabase/supabase-js'
import WebSocket from 'ws'
if (!globalThis.WebSocket) globalThis.WebSocket = WebSocket
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const env = fs.readFileSync(path.join(ROOT, '.env.local'), 'utf8')
const get = (k) => { const m = env.match(new RegExp('^' + k + '=(.*)$', 'm')); return m ? m[1].trim().replace(/^["']|["']$/g, '') : null }
const admin = createClient(get('NEXT_PUBLIC_SUPABASE_URL'), get('SUPABASE_SERVICE_ROLE_KEY'), { auth: { persistSession: false } })

const STAMP = Date.now()
let restaurantId = null, ownerId = null
const tableIds = []
let entryId = null
const results = []
const check = (label, ok) => { results.push([label, ok]); console.log(`   ${ok ? '✅' : '❌'} ${label}`) }

async function freeAllocatedTables(rId, eId) {
  const { data: allocs } = await admin.from('table_waitlist_allocations').select('table_id').eq('waitlist_id', eId)
  const ids = (allocs ?? []).map(a => a.table_id)
  if (ids.length > 0) {
    await admin.from('tables').update({ status: 'free' }).in('id', ids).eq('status', 'reserved').eq('restaurant_id', rId)
    await admin.from('table_waitlist_allocations').delete().eq('waitlist_id', eId)
  }
  return ids
}

async function resolveEntryByTable(rId, tableId) {
  const { data: allocs } = await admin.from('table_waitlist_allocations').select('waitlist_id').eq('table_id', tableId)
  const entryIds = [...new Set((allocs ?? []).map(a => a.waitlist_id))]
  if (!entryIds.length) return null
  const { data: entry } = await admin.from('table_waitlist').select('id')
    .in('id', entryIds).eq('restaurant_id', rId).in('status', ['waiting', 'notified'])
    .order('created_at', { ascending: false }).limit(1).maybeSingle()
  return entry?.id ?? null
}

async function main() {
  console.log('1) Restaurante + 3 mesas livres…')
  const email = `smoke-grid-${STAMP}@smoke.com`
  const { data: u } = await admin.auth.admin.createUser({ email, password: 'SmokeTest2026!', email_confirm: true })
  ownerId = u.user.id
  const { data: r } = await admin.from('restaurants').insert({
    owner_id: ownerId, name: `Smoke Grid ${STAMP}`, slug: `smoke-grid-${STAMP}`, status: 'active',
  }).select('id').single()
  restaurantId = r.id
  for (const n of ['G1', 'G2', 'G3']) {
    const { data: t } = await admin.from('tables').insert({
      restaurant_id: restaurantId, number: n, status: 'free', capacity: 4,
    }).select('id').single()
    tableIds.push(t.id)
  }
  check('restaurante + 3 mesas criadas', tableIds.length === 3)

  console.log('2) reserveTables (Flow A) — grupo em 3 mesas…')
  const { data: entry, error: entryErr } = await admin.from('table_waitlist').insert({
    restaurant_id: restaurantId, feature_id: null, name: 'Grupo Smoke', whatsapp: '5511987654321',
    party_size: 10, source: 'staff',
  }).select('id').single()
  if (entryErr || !entry) {
    throw new Error((entryErr?.message ?? 'insert falhou') + ' — rode supabase/migrate-waitlist-allocations.sql')
  }
  entryId = entry.id
  await admin.from('table_waitlist_allocations').insert(tableIds.map(tid => ({ waitlist_id: entryId, table_id: tid })))
  await admin.from('tables').update({ status: 'reserved' }).in('id', tableIds).eq('restaurant_id', restaurantId)
  const { data: reserved } = await admin.from('tables').select('status').in('id', tableIds)
  check('3 mesas ficaram reserved', (reserved ?? []).every(t => t.status === 'reserved'))

  console.log('3) cancelByTable na mesa G2 libera o grupo inteiro…')
  const resolved = await resolveEntryByTable(restaurantId, tableIds[1])
  check('resolveEntryByTable acha a entrada', resolved === entryId)
  const freed = await freeAllocatedTables(restaurantId, resolved)
  await admin.from('table_waitlist').update({ status: 'cancelled' }).eq('id', resolved)
  const { data: after } = await admin.from('tables').select('status').in('id', tableIds)
  check('todas as mesas voltaram a free', (after ?? []).every(t => t.status === 'free'))
  check('3 mesas liberadas no cancelamento', freed.length === 3)

  console.log('\n--- RESULTADO ---')
  const pass = results.every(([, ok]) => ok)
  console.log(results.map(([l, ok]) => `${ok ? 'PASS' : 'FAIL'}  ${l}`).join('\n'))
  console.log(pass ? '\n🟢 Flow A OK' : '\n🔴 FALHAS')
  if (!pass) process.exitCode = 1
}

main()
  .catch(e => { console.error('ERRO:', e.message); process.exitCode = 1 })
  .finally(async () => {
    if (restaurantId) await admin.from('restaurants').delete().eq('id', restaurantId)
    if (ownerId) await admin.auth.admin.deleteUser(ownerId).catch(() => {})
    console.log('cleanup: restaurante + owner removidos')
  })
