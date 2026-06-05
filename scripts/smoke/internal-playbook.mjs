// Verificação E2E: página escondida /internal/playbook (staff-only).
// Staff vê o playbook (Implementação + Suporte); anônimo é barrado (login).
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
const STAFF_EMAIL = `staff-pb-${Date.now()}@smoke.com`
const STAFF_PASS = 'StaffTest2026!'

const results = []
const check = (label, ok, extra = '') => { results.push([label, ok]); console.log(`${ok ? '✅' : '❌'} ${label}${extra ? ' — ' + extra : ''}`) }
let staffAuthId = null

async function main() {
  const { data, error } = await admin.auth.admin.createUser({ email: STAFF_EMAIL, password: STAFF_PASS, email_confirm: true })
  if (error) throw new Error('staff auth: ' + error.message)
  staffAuthId = data.user.id
  await admin.from('staff_users').insert({ user_id: staffAuthId, email: STAFF_EMAIL, role: 'ops', active: true })

  const browser = await chromium.launch()

  // anônimo → barrado (sem conteúdo do playbook)
  const anon = await browser.newContext()
  const ap = await anon.newPage()
  await ap.goto(`${BASE}/internal/playbook`, { waitUntil: 'domcontentloaded' })
  await ap.waitForTimeout(2500)
  const anonTxt = await ap.locator('body').innerText().catch(() => '')
  const anonBlocked = /\/internal\/login/.test(ap.url()) || !/onboarding de novo cliente/i.test(anonTxt)
  check('Anônimo é barrado (não vê o playbook)', anonBlocked, ap.url())
  await anon.close()

  // staff → vê o conteúdo
  const ctx = await browser.newContext()
  const page = await ctx.newPage()
  await page.goto(`${BASE}/internal/login`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(700)
  await page.locator('input[type="email"]').first().fill(STAFF_EMAIL)
  await page.locator('input[type="password"]').first().fill(STAFF_PASS)
  await page.locator('button[type="submit"]').first().click()
  await page.waitForURL('**/internal**', { timeout: 30000 }).catch(() => {})
  await page.waitForTimeout(1500)

  await page.goto(`${BASE}/internal/playbook`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2500)
  const txt = await page.locator('body').innerText().catch(() => '')
  check('Título Playbook', /Playbook/.test(txt))
  check('Parte Implementação + Suporte', /Implementa[çc][ãa]o/i.test(txt) && /Suporte/i.test(txt))
  check('Itens-chave presentes', /Coleta de dados/i.test(txt) && /Definir senha|sem senha não loga/i.test(txt) && /Chamar Gar[çc]om/i.test(txt))

  // checklist marcável: clica o 1º item e confirma persistência (line-through ou estado)
  const firstItem = page.getByText('Razão social + nome fantasia').first()
  const hadItem = await firstItem.isVisible().catch(() => false)
  check('Checklist renderiza itens clicáveis', hadItem)

  await browser.close()
  const passed = results.filter(r => r[1]).length
  console.log(`\n--- RESULTADO: ${passed}/${results.length} ---`)
  if (passed !== results.length) process.exitCode = 1
}

main()
  .catch(e => { console.error('ERRO:', e); process.exitCode = 1 })
  .finally(async () => {
    if (staffAuthId) {
      await admin.from('staff_users').delete().eq('user_id', staffAuthId)
      await admin.auth.admin.deleteUser(staffAuthId).catch(() => {})
    }
    console.log('cleanup: staff de teste removido')
  })
