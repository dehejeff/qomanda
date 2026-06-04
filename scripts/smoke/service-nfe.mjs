// Verificação E2E: NF-e de serviço (Qomanda → restaurante) em modo simulado.
// Dirige o webhook Asaas real: cria uma billing_invoice com asaas_payment_id,
// envia o webhook PAYMENT_RECEIVED e confirma que a fatura vira 'paid' e uma
// service_nfe_invoices 'simulated' é criada (gatilho automático).
import { createClient } from '@supabase/supabase-js'
import WebSocket from 'ws'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

if (!globalThis.WebSocket) globalThis.WebSocket = WebSocket

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const env = fs.readFileSync(path.join(ROOT, '.env.local'), 'utf8')
const get = (k) => { const m = env.match(new RegExp('^' + k + '=(.*)$', 'm')); return m ? m[1].trim().replace(/^["']|["']$/g, '') : null }
const URL = get('NEXT_PUBLIC_SUPABASE_URL')
const KEY = get('SUPABASE_SERVICE_ROLE_KEY') || get('SUPABASE_SERVICE_ROLE') || get('SUPABASE_SECRET_KEY')
const admin = createClient(URL, KEY, { auth: { persistSession: false } })

const RESTAURANT_ID = 'dd8a40c6-6618-402a-af23-df0d17e24f7a'
const BASE = 'http://localhost:3000'
const PAY_ID = `svc_smoke_${Date.now()}`

let invoiceId = null
let restoredDoc = null
let docWasNull = false

async function main() {
  // Garante CNPJ no tomador (restaurante) — necessário p/ emitir.
  const { data: r } = await admin.from('restaurants').select('document_number').eq('id', RESTAURANT_ID).single()
  restoredDoc = r?.document_number ?? null
  docWasNull = !restoredDoc
  if (!restoredDoc) {
    await admin.from('restaurants').update({ document_number: '11222333000181' }).eq('id', RESTAURANT_ID)
    console.log('1) CNPJ de teste definido no restaurante (tomador)')
  } else {
    console.log('1) Restaurante já tem documento:', restoredDoc)
  }

  // Cria a fatura de mensalidade vinculada a um asaas_payment_id.
  const now = new Date()
  const ps = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10)
  const pe = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10)
  const { data: inv, error: invErr } = await admin.from('billing_invoices').insert({
    restaurant_id: RESTAURANT_ID, period_start: ps, period_end: pe,
    amount: 149.9, status: 'sent', due_date: pe, asaas_payment_id: PAY_ID,
    notes: 'Mensalidade Qomanda (smoke NF-e serviço)',
  }).select('id').single()
  if (invErr) throw new Error('insert invoice: ' + invErr.message)
  invoiceId = inv.id
  console.log('2) Fatura criada:', invoiceId, '| asaas_payment_id:', PAY_ID)

  // Dispara o webhook Asaas real → marca paga → emite NF-e de serviço.
  console.log('3) Enviando webhook Asaas PAYMENT_RECEIVED…')
  const res = await fetch(`${BASE}/api/asaas/webhook`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id: `evt_${PAY_ID}`, event: 'PAYMENT_RECEIVED', payment: { id: PAY_ID, status: 'RECEIVED' } }),
  })
  console.log('   webhook resp:', res.status, await res.text())

  // Dá tempo de processar (emit roda dentro do request, mas garante consistência).
  await new Promise(r => setTimeout(r, 1500))

  const { data: invAfter } = await admin.from('billing_invoices').select('status, paid_at').eq('id', invoiceId).single()
  const { data: note } = await admin.from('service_nfe_invoices').select('id, status, provider, amount, environment').eq('billing_invoice_id', invoiceId).maybeSingle()

  console.log('\n--- RESULTADO ---')
  console.log('fatura.status:', invAfter?.status, '| paid_at:', invAfter?.paid_at ? 'set' : 'null')
  console.log('service_nfe:', note ? JSON.stringify(note) : 'NENHUMA')

  const invoicePaid = invAfter?.status === 'paid'
  const noteSimulated = note?.status === 'simulated' && note?.provider === 'simulado'
  console.log('fatura paga:', invoicePaid ? 'PASS' : 'FAIL')
  console.log('NF-e serviço simulada criada:', noteSimulated ? 'PASS' : 'FAIL')

  // Idempotência: reenvia o webhook; não deve duplicar nota.
  await fetch(`${BASE}/api/asaas/webhook`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id: `evt_${PAY_ID}`, event: 'PAYMENT_RECEIVED', payment: { id: PAY_ID, status: 'RECEIVED' } }),
  })
  await new Promise(r => setTimeout(r, 800))
  const { count } = await admin.from('service_nfe_invoices').select('id', { count: 'exact', head: true }).eq('billing_invoice_id', invoiceId)
  console.log('notas após reenvio (deve ser 1):', count, count === 1 ? 'PASS' : 'FAIL')

  if (!invoicePaid || !noteSimulated || count !== 1) process.exitCode = 1
}

main()
  .catch((e) => { console.error('ERRO:', e); process.exitCode = 1 })
  .finally(async () => {
    if (invoiceId) {
      await admin.from('service_nfe_invoices').delete().eq('billing_invoice_id', invoiceId)
      await admin.from('billing_invoices').delete().eq('id', invoiceId)
    }
    // restaura documento se foi setado pelo teste
    if (docWasNull) await admin.from('restaurants').update({ document_number: null }).eq('id', RESTAURANT_ID)
    // limpa o webhook_event de teste
    await admin.from('webhook_events').delete().eq('event_id', `evt_${PAY_ID}`)
    console.log('cleanup: fatura/nota/documento/webhook de teste removidos')
  })
