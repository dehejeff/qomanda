// Verificação E2E: fila assíncrona (NF-e fora do request de pagamento).
// Confirma um pagamento via webhook Asaas e prova que: (a) o pagamento é pago
// na hora, (b) um job nfe_emit é enfileirado, (c) a NF-e NÃO sai no request
// (desacoplada), e (d) o worker /api/cron/process-jobs emite a NF-e depois.
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
const PAY_AID = `jobtest_${Date.now()}`
const EVT_ID = `evt_${PAY_AID}`

const results = []
const check = (label, ok) => { results.push([label, ok]); console.log(`${ok ? '✅' : '❌'} ${label}`) }

let sessionId = null, customerId = null, paymentId = null, bogusId = null, savedNfe = null

async function setup() {
  const { data: r } = await admin.from('restaurants')
    .select('nfe_enabled, nfe_auto_emit, nfe_status, nfe_note_type').eq('id', RID).single()
  savedNfe = r
  await admin.from('restaurants').update({ nfe_enabled: true, nfe_auto_emit: true, nfe_status: 'active', nfe_note_type: 'nfce' }).eq('id', RID)

  const { data: c } = await admin.from('customers').insert({ first_name: 'Fila', last_name: 'Teste', whatsapp: '5511' + Math.floor(100000000 + Math.random() * 800000000) }).select('id').single()
  customerId = c.id
  const { data: s } = await admin.from('sessions').insert({ restaurant_id: RID, table_id: TABLE_ID, status: 'open' }).select('id').single()
  sessionId = s.id
  const { data: p } = await admin.from('payments').insert({
    restaurant_id: RID, session_id: sessionId, customer_id: customerId,
    amount: 25.9, method: 'pix', status: 'pending', asaas_payment_id: PAY_AID,
  }).select('id').single()
  paymentId = p.id
  console.log('setup: payment', paymentId, '| asaas_id', PAY_AID)
}

async function jobsFor(pid) {
  const { data } = await admin.from('async_jobs').select('id, type, status, payload').eq('type', 'nfe_emit')
  return (data ?? []).filter(j => j.payload?.paymentId === pid)
}
async function nfeCount(pid) {
  const { count } = await admin.from('nfe_invoices').select('id', { count: 'exact', head: true }).eq('payment_id', pid)
  return count ?? 0
}

async function main() {
  await setup()

  // 1) webhook confirma o pagamento
  await fetch(`${BASE}/api/asaas/webhook`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id: EVT_ID, event: 'PAYMENT_RECEIVED', payment: { id: PAY_AID, status: 'RECEIVED' } }),
  })
  await new Promise(r => setTimeout(r, 1200))

  const { data: payAfter } = await admin.from('payments').select('status').eq('id', paymentId).single()
  check('Pagamento confirmado na hora (paid)', payAfter?.status === 'paid')

  const jobs = await jobsFor(paymentId)
  check('Job nfe_emit enfileirado', jobs.length === 1 && jobs[0].status === 'pending')

  const nfeBefore = await nfeCount(paymentId)
  check('NF-e NÃO emitida no request (desacoplada)', nfeBefore === 0)

  // 2) worker processa a fila
  const procRes = await fetch(`${BASE}/api/cron/process-jobs`, { method: 'POST' })
  const proc = await procRes.json()
  console.log('   worker:', procRes.status, JSON.stringify(proc))
  check('Worker autorizado em dev + processa', procRes.ok && proc.done >= 1)

  await new Promise(r => setTimeout(r, 500))
  const jobsDone = await jobsFor(paymentId)
  check('Job marcado done', jobsDone[0]?.status === 'done')
  check('NF-e emitida pelo worker (depois)', (await nfeCount(paymentId)) === 1)

  // 3) job de tipo desconhecido → error
  const pastIso = new Date(Date.now() - 5000).toISOString() // evita skew de relógio app/DB
  const { data: bogus } = await admin.from('async_jobs').insert({ type: 'bogus', payload: {}, run_after: pastIso }).select('id').single()
  bogusId = bogus.id
  await fetch(`${BASE}/api/cron/process-jobs`, { method: 'POST' })
  await new Promise(r => setTimeout(r, 400))
  const { data: bogusAfter } = await admin.from('async_jobs').select('status, last_error').eq('id', bogusId).single()
  check('Job desconhecido → error com motivo', bogusAfter?.status === 'error' && /handler/.test(bogusAfter?.last_error ?? ''))

  const passed = results.filter(r => r[1]).length
  console.log(`\n--- RESULTADO: ${passed}/${results.length} ---`)
  if (passed !== results.length) process.exitCode = 1
}

main()
  .catch(e => { console.error('ERRO:', e); process.exitCode = 1 })
  .finally(async () => {
    if (paymentId) {
      const jobs = await jobsFor(paymentId)
      for (const j of jobs) await admin.from('async_jobs').delete().eq('id', j.id)
      await admin.from('nfe_invoices').delete().eq('payment_id', paymentId)
      await admin.from('payments').delete().eq('id', paymentId)
    }
    if (bogusId) await admin.from('async_jobs').delete().eq('id', bogusId)
    if (sessionId) await admin.from('sessions').delete().eq('id', sessionId)
    if (customerId) await admin.from('customers').delete().eq('id', customerId)
    await admin.from('webhook_events').delete().eq('event_id', EVT_ID)
    if (savedNfe) await admin.from('restaurants').update(savedNfe).eq('id', RID)
    console.log('cleanup: jobs/nfe/pagamento/sessão/cliente + restaurante restaurado')
  })
