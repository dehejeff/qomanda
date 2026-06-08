// Smoke da fila de espera por característica de mesa.
// Backend puro (service role): cria característica + mesa + 2 entradas, e
// exercita posição, matching (chamar próximo), trava de duplo aviso, expiração
// e auto-avanço — espelhando src/lib/waitlist.ts. Limpa tudo no fim.
import { createClient } from '@supabase/supabase-js'
import WebSocket from 'ws'
if (!globalThis.WebSocket) globalThis.WebSocket = WebSocket
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const env = fs.readFileSync(path.join(ROOT, '.env.local'), 'utf8')
const get = (k) => {
  const m = env.match(new RegExp('^' + k + '=(.*)$', 'm'))
  return m ? m[1].trim().replace(/^["']|["']$/g, '') : null
}
const admin = createClient(get('NEXT_PUBLIC_SUPABASE_URL'), get('SUPABASE_SERVICE_ROLE_KEY'), { auth: { persistSession: false } })

let featureId = null, tableId = null, aliceId = null, bobId = null, carolId = null, daveId = null
const results = []
const check = (label, ok) => { results.push([label, ok]); console.log(`   ${ok ? '✅' : '❌'} ${label}`) }

// Espelha notifyNextForFeature/notifyWaitlistOnTableFree (lib/waitlist.ts).
// capacity null = sem limite; senão só chama quem cabe (party_size <= capacity).
async function matchTableFree(restaurantId, fid, tid, tol, capacity = null) {
  await admin.from('table_waitlist').update({ status: 'expired' })
    .eq('status', 'notified').lt('expires_at', new Date().toISOString()).eq('restaurant_id', restaurantId)
  const { data: active } = await admin.from('table_waitlist').select('id')
    .eq('restaurant_id', restaurantId).eq('feature_id', fid).eq('status', 'notified')
    .gte('expires_at', new Date().toISOString()).limit(1).maybeSingle()
  if (active) return false
  let nextQ = admin.from('table_waitlist').select('id')
    .eq('restaurant_id', restaurantId).eq('feature_id', fid).eq('status', 'waiting')
    .order('created_at', { ascending: true }).limit(1)
  if (capacity != null) nextQ = nextQ.lte('party_size', capacity)
  const { data: next } = await nextQ.maybeSingle()
  if (!next) return false
  await admin.from('table_waitlist').update({
    status: 'notified', notified_table_id: tid, notified_at: new Date().toISOString(),
    expires_at: new Date(Date.now() + tol * 60000).toISOString(),
  }).eq('id', next.id).eq('status', 'waiting')
  return next.id
}

async function main() {
  console.log('1) Restaurante de teste…')
  const { data: rest } = await admin.from('restaurants').select('id, name, waitlist_tolerance_minutes').eq('status', 'active').limit(1).single()
  if (!rest) throw new Error('Nenhum restaurante ativo.')
  const rId = rest.id
  const tol = Number(rest.waitlist_tolerance_minutes ?? 10)
  console.log('   →', rest.name, '| tolerância:', tol, 'min')

  console.log('2) Característica + mesa de teste…')
  const { data: feat } = await admin.from('table_features').insert({ restaurant_id: rId, name: 'Smoke Vista', emoji: '🧪' }).select('id').single()
  featureId = feat.id
  const { data: tbl } = await admin.from('tables').insert({ restaurant_id: rId, number: 'SMOKE-W', status: 'free' }).select('id').single()
  tableId = tbl.id
  await admin.from('table_feature_map').insert({ table_id: tableId, feature_id: featureId })
  check('característica + mesa + atribuição criadas', !!featureId && !!tableId)

  console.log('3) Duas entradas na fila (Alice antes de Bob)…')
  const t0 = new Date(Date.now() - 60000).toISOString()
  const t1 = new Date(Date.now() - 30000).toISOString()
  const { data: a } = await admin.from('table_waitlist').insert({ restaurant_id: rId, feature_id: featureId, name: 'Alice', party_size: 2, source: 'staff', created_at: t0 }).select('id').single()
  const { data: b } = await admin.from('table_waitlist').insert({ restaurant_id: rId, feature_id: featureId, name: 'Bob', party_size: 2, source: 'staff', created_at: t1 }).select('id').single()
  aliceId = a.id; bobId = b.id

  // Posição: Bob deve ser 2º (1 esperando antes).
  const { count: ahead } = await admin.from('table_waitlist').select('id', { count: 'exact', head: true })
    .eq('feature_id', featureId).eq('status', 'waiting').lt('created_at', t1)
  check('posição do Bob = 2', (ahead ?? 0) + 1 === 2)

  console.log('4) Mesa livre → chama o próximo (Alice)…')
  const notified = await matchTableFree(rId, featureId, tableId, tol)
  const { data: alice1 } = await admin.from('table_waitlist').select('status, notified_table_id, expires_at').eq('id', aliceId).single()
  check('Alice notificada', alice1.status === 'notified')
  check('Alice apontando para a mesa de teste', alice1.notified_table_id === tableId)
  check('expires_at no futuro', new Date(alice1.expires_at).getTime() > Date.now())
  check('matchTableFree retornou a Alice', notified === aliceId)

  console.log('5) Mesa livre de novo → NÃO chama o Bob (Alice ainda ativa)…')
  await matchTableFree(rId, featureId, tableId, tol)
  const { data: bob1 } = await admin.from('table_waitlist').select('status').eq('id', bobId).single()
  check('Bob continua waiting (sem duplo aviso)', bob1.status === 'waiting')

  console.log('6) Tolerância estoura → expira Alice e chama o Bob…')
  await admin.from('table_waitlist').update({ expires_at: new Date(Date.now() - 1000).toISOString() }).eq('id', aliceId)
  await matchTableFree(rId, featureId, tableId, tol)
  const { data: alice2 } = await admin.from('table_waitlist').select('status').eq('id', aliceId).single()
  const { data: bob2 } = await admin.from('table_waitlist').select('status, notified_table_id').eq('id', bobId).single()
  check('Alice expirada', alice2.status === 'expired')
  check('Bob notificado (auto-avanço)', bob2.status === 'notified' && bob2.notified_table_id === tableId)

  console.log('7) Capacidade: mesa p/ 3 → pula grupo de 5, chama o grupo de 2…')
  // Libera o Bob (sai do estado notified) e define capacidade da mesa = 3.
  await admin.from('table_waitlist').update({ status: 'seated' }).eq('id', bobId)
  await admin.from('tables').update({ capacity: 3 }).eq('id', tableId)
  const tc0 = new Date(Date.now() - 60000).toISOString()
  const tc1 = new Date(Date.now() - 30000).toISOString()
  const { data: c } = await admin.from('table_waitlist').insert({ restaurant_id: rId, feature_id: featureId, name: 'Carol', party_size: 5, source: 'staff', created_at: tc0 }).select('id').single()
  const { data: d } = await admin.from('table_waitlist').insert({ restaurant_id: rId, feature_id: featureId, name: 'Dave', party_size: 2, source: 'staff', created_at: tc1 }).select('id').single()
  carolId = c.id; daveId = d.id
  const notified2 = await matchTableFree(rId, featureId, tableId, tol, 3)
  const { data: carol1 } = await admin.from('table_waitlist').select('status').eq('id', carolId).single()
  const { data: dave1 } = await admin.from('table_waitlist').select('status, notified_table_id').eq('id', daveId).single()
  check('grupo de 5 (Carol) NÃO foi chamado (não cabe)', carol1.status === 'waiting')
  check('grupo de 2 (Dave) foi chamado', dave1.status === 'notified' && dave1.notified_table_id === tableId)
  check('matchTableFree retornou o Dave', notified2 === daveId)

  console.log('\n--- RESULTADO ---')
  const pass = results.every(([, ok]) => ok)
  console.log(results.map(([l, ok]) => `${ok ? 'PASS' : 'FAIL'}  ${l}`).join('\n'))
  console.log(pass ? '\n🟢 TUDO PASSOU' : '\n🔴 FALHAS ACIMA')
  if (!pass) process.exitCode = 1
}

main()
  .catch((e) => { console.error('ERRO:', e.message); process.exitCode = 1 })
  .finally(async () => {
    // Limpeza
    if (aliceId) await admin.from('table_waitlist').delete().eq('id', aliceId)
    if (bobId) await admin.from('table_waitlist').delete().eq('id', bobId)
    if (carolId) await admin.from('table_waitlist').delete().eq('id', carolId)
    if (daveId) await admin.from('table_waitlist').delete().eq('id', daveId)
    if (tableId) await admin.from('table_feature_map').delete().eq('table_id', tableId)
    if (featureId) await admin.from('table_features').delete().eq('id', featureId)
    if (tableId) await admin.from('tables').delete().eq('id', tableId)
    console.log('cleanup: dados de teste removidos')
  })
