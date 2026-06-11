// Teste de UI (Playwright) da fila de espera.
// Setup/limpeza via service role; UI: cliente anônimo entra na fila, owner
// chama pelo /garcom/fila, cliente vê "Mesa pronta".
import { chromium } from 'playwright'
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

const BASE = 'http://localhost:3000'
const OWNER_EMAIL = 'smoke-garcom-owner-1780586566030@smoke.com'
const PASSWORD = 'SmokeTest2026!'
const RESTAURANT_ID = 'dd8a40c6-6618-402a-af23-df0d17e24f7a'
const SLUG = 'smoke-garcom-1780586566030'

let featureId = null, tableId = null
const results = []
const check = (l, ok) => { results.push([l, ok]); console.log(`   ${ok ? '✅' : '❌'} ${l}`) }

async function main() {
  console.log('0) Setup (service role): característica + mesa livre…')
  await admin.from('restaurants').update({ waitlist_tolerance_minutes: 10 }).eq('id', RESTAURANT_ID)
  const { data: feat } = await admin.from('table_features').insert({ restaurant_id: RESTAURANT_ID, name: 'Smoke UI Vista', emoji: '🧪' }).select('id').single()
  featureId = feat.id
  const { data: tbl } = await admin.from('tables').insert({ restaurant_id: RESTAURANT_ID, number: 'SMOKE-WUI', status: 'free' }).select('id').single()
  tableId = tbl.id
  await admin.from('table_feature_map').insert({ table_id: tableId, feature_id: featureId })
  console.log('   → feature', featureId, '| mesa', tableId)

  const browser = await chromium.launch()

  // ── Cliente (anônimo) entra na fila ──
  console.log('1) Cliente: entra na fila por UI…')
  const cust = await browser.newContext()
  const cp = await cust.newPage()
  await cp.goto(`${BASE}/${SLUG}/fila`, { waitUntil: 'domcontentloaded' })
  await cp.getByRole('button', { name: /Smoke UI Vista/ }).first().click({ timeout: 15000 })
  await cp.getByPlaceholder('Seu nome').fill('Cliente Teste')
  await cp.getByRole('button', { name: /Entrar na fila/ }).click()
  const posOk = await cp.getByText(/da fila/).first().waitFor({ state: 'visible', timeout: 10000 }).then(() => true).catch(() => false)
  check('cliente entrou e vê a posição na fila', posOk)
  const joinHiddenWhileWaiting = await cp.getByRole('button', { name: /Entrar na fila/ }).count().then(c => c === 0).catch(() => false)
  check('formulário oculto enquanto aguarda na fila', joinHiddenWhileWaiting)

  // ── Owner chama o próximo pelo /garcom/fila ──
  console.log('2) Owner: login e "Chamar próximo"…')
  const own = await browser.newContext()
  const op = await own.newPage()
  await op.goto(`${BASE}/login?perfil=admin`, { waitUntil: 'domcontentloaded' })
  await op.locator('input[type="email"]').first().fill(OWNER_EMAIL)
  await op.locator('input[type="password"]').first().fill(PASSWORD)
  await op.locator('button[type="submit"]').first().click()
  await op.waitForURL('**/dashboard**', { timeout: 20000 }).catch(() => {})
  await op.goto(`${BASE}/garcom/fila`, { waitUntil: 'domcontentloaded' })
  const entryOk = await op.getByText('Cliente Teste').first().waitFor({ state: 'visible', timeout: 12000 }).then(() => true).catch(() => false)
  check('garçom vê o cliente na fila', entryOk)
  const callBtn = op.getByRole('button', { name: /Chamar próximo/ }).first()
  await callBtn.click({ timeout: 8000 }).catch(() => {})
  await op.waitForTimeout(1500)
  const calledOk = await op.getByText(/Chamado · Mesa SMOKE-WUI/).first().waitFor({ state: 'visible', timeout: 8000 }).then(() => true).catch(() => false)
  check('garçom: cliente marcado como "Chamado · Mesa"', calledOk)

  // ── Cliente vê "Mesa pronta" (poll 5s) ──
  console.log('3) Cliente: aguarda "Mesa pronta" (poll)…')
  const readyOk = await cp.getByText(/Sua mesa está pronta/).first().waitFor({ state: 'visible', timeout: 12000 }).then(() => true).catch(() => false)
  check('cliente vê "Sua mesa está pronta"', readyOk)
  const scanOk = await cp.getByRole('link', { name: /Escanear QR da mesa/ }).first().waitFor({ state: 'visible', timeout: 5000 }).then(() => true).catch(() => false)
  check('cliente vê botão de scan (não "Entrar na fila")', scanOk)
  const joinHidden = await cp.getByRole('button', { name: /Entrar na fila/ }).count().then(c => c === 0).catch(() => false)
  check('formulário "Entrar na fila" oculto após chamada', joinHidden)

  const shotDir = path.join(ROOT, 'scripts', 'smoke', '.cache')
  fs.mkdirSync(shotDir, { recursive: true })
  await cp.screenshot({ path: path.join(shotDir, 'waitlist-ui-cliente.png') }).catch(() => {})
  await op.screenshot({ path: path.join(shotDir, 'waitlist-ui-garcom.png') }).catch(() => {})

  await browser.close()

  console.log('\n--- RESULTADO ---')
  const pass = results.every(([, ok]) => ok)
  console.log(results.map(([l, ok]) => `${ok ? 'PASS' : 'FAIL'}  ${l}`).join('\n'))
  console.log(pass ? '\n🟢 UI OK' : '\n🔴 FALHAS')
  if (!pass) process.exitCode = 1
}

main()
  .catch((e) => { console.error('ERRO:', e.message); process.exitCode = 1 })
  .finally(async () => {
    if (featureId) await admin.from('table_waitlist').delete().eq('feature_id', featureId)
    if (tableId) await admin.from('table_feature_map').delete().eq('table_id', tableId)
    if (featureId) await admin.from('table_features').delete().eq('id', featureId)
    if (tableId) await admin.from('tables').delete().eq('id', tableId)
    console.log('cleanup: dados de teste removidos')
  })
