// Verificação E2E: WhatsApp em fila. Um pagamento gera nfe_emit; ao processar,
// a NF-e enfileira um whatsapp_send (não envia inline); o worker então envia
// (mock em dev) e marca whatsapp_sent_at na nota. Sem regressão na fila.
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
const check = (label, ok, extra = '') => { results.push([label, ok]); console.log(`${ok ? '✅' : '❌'} ${label}${extra ? ' — ' + extra : ''}`) }

let sessionId = null, customerId = null, paymentId = null, savedNfe = null, savedWa = null
const jobIds = []

async function setup() {
  const { data: r } = await admin.from('restaurants')
    .select('nfe_enabled, nfe_auto_emit, nfe_status, nfe_note_type, whatsapp_nfe_enabled').eq('id', RID).single()
  savedNfe = { nfe_enabled: r.nfe_enabled, nfe_auto_emit: r.nfe_auto_emit, nfe_status: r.nfe_status, nfe_note_type: r.nfe_note_type }
  savedWa = r.whatsapp_nfe_enabled
  await admin.from('restaurants').update({ nfe_enabled: true, nfe_auto_emit: true, nfe_status: 'active', nfe_note_type: 'nfce', whatsapp_nfe_enabled: true }).eq('id', RID)

  const { data: c } = await admin.from('customers').insert({ first_name: 'Zap', last_name: 'Fila', whatsapp: '5511' + Math.floor(100000000 + Math.random() * 800000000) }).select('id').single()
  customerId = c.id
  const { data: s } = await admin.from('sessions').insert({ restaurant_id: RID, table_id: TABLE_ID, status: 'open' }).select('id').single()
  sessionId = s.id
  const { data: p } = await admin.from('payments').insert({
    restaurant_id: RID, session_id: sessionId, customer_id: customerId, amount: 25.9, method: 'pix', status: 'paid', paid_at: new Date().toISOString(),
  }).select('id').single()
  paymentId = p.id

  // enfileira o nfe_emit (run_after no passado p/ evitar skew)
  const { data: job } = await admin.from('async_jobs').insert({
    type: 'nfe_emit', payload: { paymentId }, status: 'pending', run_after: new Date(Date.now() - 5000).toISOString(),
  }).select('id').single()
  jobIds.push(job.id)
  console.log('setup: payment', paymentId, '| nfe_emit job', job.id)
}

async function process() {
  return (await fetch(`${BASE}/api/cron/process-jobs`, { method: 'POST' })).json()
}
async function nfeInvoice() {
  const { data } = await admin.from('nfe_invoices').select('id, whatsapp_sent_at').eq('payment_id', paymentId).maybeSingle()
  return data
}
async function waJobs() {
  const { data } = await admin.from('async_jobs').select('id, status, payload').eq('type', 'whatsapp_send')
  return (data ?? []).filter(j => j.payload?.invoiceId)
}

async function main() {
  await setup()

  // 1) processa nfe_emit → cria NF-e + enfileira whatsapp_send
  const r1 = await process()
  console.log('   worker run1:', JSON.stringify(r1))
  await new Promise(r => setTimeout(r, 600))
  const inv = await nfeInvoice()
  check('NF-e emitida pelo worker', Boolean(inv?.id))

  const allWa = await waJobs()
  const myWa = allWa.find(j => j.payload?.invoiceId === inv?.id)
  if (myWa) jobIds.push(myWa.id)
  check('whatsapp_send enfileirado (não enviado inline)', Boolean(myWa) && myWa.status === 'pending')
  check('NF-e ainda SEM whatsapp_sent_at após emissão', inv?.whatsapp_sent_at == null)
  check('payload do whatsapp tem destino e mensagem', Boolean(myWa?.payload?.to) && Boolean(myWa?.payload?.message))

  // 2) processa whatsapp_send → envia (mock) + marca sent_at
  const r2 = await process()
  console.log('   worker run2:', JSON.stringify(r2))
  await new Promise(r => setTimeout(r, 600))
  const invAfter = await nfeInvoice()
  const { data: waAfter } = await admin.from('async_jobs').select('status').eq('id', myWa?.id ?? '00000000-0000-0000-0000-000000000000').maybeSingle()
  check('whatsapp_send concluído (done)', waAfter?.status === 'done')
  check('NF-e marcada com whatsapp_sent_at', Boolean(invAfter?.whatsapp_sent_at))

  const passed = results.filter(r => r[1]).length
  console.log(`\n--- RESULTADO: ${passed}/${results.length} ---`)
  if (passed !== results.length) process.exitCode = 1
}

main()
  .catch(e => { console.error('ERRO:', e); process.exitCode = 1 })
  .finally(async () => {
    for (const id of jobIds) await admin.from('async_jobs').delete().eq('id', id)
    if (paymentId) {
      await admin.from('nfe_invoices').delete().eq('payment_id', paymentId)
      await admin.from('payments').delete().eq('id', paymentId)
    }
    if (sessionId) await admin.from('sessions').delete().eq('id', sessionId)
    if (customerId) await admin.from('customers').delete().eq('id', customerId)
    if (savedNfe) await admin.from('restaurants').update({ ...savedNfe, whatsapp_nfe_enabled: savedWa }).eq('id', RID)
    console.log('cleanup: jobs/nfe/pagamento/sessão/cliente + restaurante restaurado')
  })
