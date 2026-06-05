// Verificação E2E: painel Saúde do sistema. Cria staff temp, semeia um job em
// erro + um webhook em erro, e confere que /api/internal/health reflete os
// contadores, o status geral e o feed de erros recentes. Valida gating de auth.
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
const STAFF_EMAIL = `staff-health-${Date.now()}@smoke.com`
const STAFF_PASS = 'StaffTest2026!'
const TAG = `healthtest_${Date.now()}`

const results = []
const check = (label, ok, extra = '') => { results.push([label, ok]); console.log(`${ok ? '✅' : '❌'} ${label}${extra ? ' — ' + extra : ''}`) }

let staffAuthId = null, jobId = null, whId = null

async function setup() {
  const { data, error } = await admin.auth.admin.createUser({ email: STAFF_EMAIL, password: STAFF_PASS, email_confirm: true })
  if (error) throw new Error('staff auth: ' + error.message)
  staffAuthId = data.user.id
  await admin.from('staff_users').insert({ user_id: staffAuthId, email: STAFF_EMAIL, role: 'ops', active: true })

  const nowIso = new Date().toISOString()
  const { data: job } = await admin.from('async_jobs').insert({
    type: 'nfe_emit', payload: { tag: TAG }, status: 'error', attempts: 5, last_error: `falha de teste ${TAG}`, updated_at: nowIso,
  }).select('id').single()
  jobId = job.id
  const { data: wh } = await admin.from('webhook_events').insert({
    provider: 'asaas', event_id: `${TAG}_evt`, event_type: 'PAYMENT_RECEIVED', status: 'error', error_message: `webhook erro ${TAG}`, updated_at: nowIso,
  }).select('id').single()
  whId = wh.id
  console.log('setup: staff', STAFF_EMAIL, '| job(erro)', jobId, '| webhook(erro)', whId)
}

async function main() {
  await setup()
  const browser = await chromium.launch()
  const ctx = await browser.newContext()
  const page = await ctx.newPage()
  await page.goto(`${BASE}/internal/login`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(700)
  await page.locator('input[type="email"]').first().fill(STAFF_EMAIL)
  await page.locator('input[type="password"]').first().fill(STAFF_PASS)
  await page.locator('button[type="submit"]').first().click()
  await page.waitForURL('**/internal**', { timeout: 30000 }).catch(() => {})
  await page.waitForTimeout(2000)

  // Retry: a 1ª compilação da rota pode atrasar a propagação da sessão.
  let res
  for (let i = 0; i < 5; i++) {
    res = await ctx.request.get(`${BASE}/api/internal/health`)
    if (res.status() === 200) break
    await page.waitForTimeout(1500)
  }
  const h = await res.json()
  console.log('   health:', res.status(), 'status=', h.status, 'jobsErr=', h.jobs?.error, 'whErr=', h.webhooks?.error)
  check('GET health autenticado (200)', res.status() === 200 && typeof h.status === 'string')
  check('Conta job em erro (>=1)', (h.jobs?.error ?? 0) >= 1)
  check('Conta webhook em erro (>=1)', (h.webhooks?.error ?? 0) >= 1)
  check('Status geral crítico (webhook em erro)', h.status === 'critical')
  const hasJobErr = (h.recentErrors ?? []).some(e => e.message?.includes(TAG) && e.source === 'job')
  const hasWhErr = (h.recentErrors ?? []).some(e => e.message?.includes(TAG) && e.source === 'webhook')
  check('Feed mostra o job e o webhook semeados', hasJobErr && hasWhErr)

  // UI renderiza
  await page.goto(`${BASE}/internal/health`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2500)
  const txt = await page.locator('body').innerText().catch(() => '')
  check('UI: título + seção de erros', /Saúde do sistema/i.test(txt) && /Erros recentes/i.test(txt))

  // Banner de saúde no Overview
  await page.goto(`${BASE}/internal`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(3500)
  const ovTxt = await page.locator('body').innerText().catch(() => '')
  const hasBanner = /Saúde/i.test(ovTxt) && /Cr[ií]tico/i.test(ovTxt) && /Ver detalhes/i.test(ovTxt)
  check('Overview mostra o banner de saúde (crítico + ver detalhes)', hasBanner)

  // auth
  const anon = await browser.newContext()
  const anonRes = await anon.request.get(`${BASE}/api/internal/health`)
  check('health exige staff (401 anônimo)', anonRes.status() === 401, `status=${anonRes.status()}`)
  await anon.close()

  await browser.close()
  const passed = results.filter(r => r[1]).length
  console.log(`\n--- RESULTADO: ${passed}/${results.length} ---`)
  if (passed !== results.length) process.exitCode = 1
}

main()
  .catch(e => { console.error('ERRO:', e); process.exitCode = 1 })
  .finally(async () => {
    if (jobId) await admin.from('async_jobs').delete().eq('id', jobId)
    if (whId) await admin.from('webhook_events').delete().eq('id', whId)
    if (staffAuthId) {
      await admin.from('staff_users').delete().eq('user_id', staffAuthId)
      await admin.auth.admin.deleteUser(staffAuthId).catch(() => {})
    }
    console.log('cleanup: staff/job/webhook de teste removidos')
  })
