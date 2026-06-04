// Verificação E2E: gestão de equipe (senha na criação, troca de senha, inativar).
// Dono cria garçom via API autenticada → garçom loga de fato → inativar bloqueia
// o acesso → troca de senha + reativar libera login com a nova senha.
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
const OWNER_EMAIL = 'smoke-garcom-owner-1780586566030@smoke.com'
const OWNER_PASS = 'SmokeTest2026!'
const RESTAURANT_ID = 'dd8a40c6-6618-402a-af23-df0d17e24f7a'
const WAITER_EMAIL = `team-test-${Date.now()}@smoke.com`
const PASS_1 = 'WaiterPass123'
const PASS_2 = 'WaiterNew456'

const results = []
const check = (label, ok) => { results.push([label, ok]); console.log(`${ok ? '✅' : '❌'} ${label}`) }

async function ownerLogin(ctx) {
  const page = await ctx.newPage()
  await page.goto(`${BASE}/login?perfil=admin`, { waitUntil: 'domcontentloaded' })
  await page.locator('input[type="email"]').first().fill(OWNER_EMAIL)
  await page.locator('input[type="password"]').first().fill(OWNER_PASS)
  await page.locator('button[type="submit"]').first().click()
  await page.waitForURL('**/dashboard**', { timeout: 20000 })
  return page
}

async function waiterLogin(ctx, password) {
  const page = await ctx.newPage()
  await page.goto(`${BASE}/login?perfil=garcom`, { waitUntil: 'domcontentloaded' })
  await page.locator('input[type="email"]').first().fill(WAITER_EMAIL)
  await page.locator('input[type="password"]').first().fill(password)
  await page.locator('button[type="submit"]').first().click()
  await page.waitForTimeout(4000) // deixa o redirect + guarda de acesso resolverem
  const url = page.url()
  await page.close()
  return url
}

async function main() {
  const browser = await chromium.launch()
  const ownerCtx = await browser.newContext()
  await ownerLogin(ownerCtx)

  // 1) Dono cria garçom COM senha (API real, cookies do dono)
  const createRes = await ownerCtx.request.post(`${BASE}/api/dashboard/members`, {
    data: { email: WAITER_EMAIL, name: 'Garçom Teste', role: 'waiter', password: PASS_1 },
  })
  const createData = await createRes.json()
  console.log('   criação:', createRes.status(), JSON.stringify(createData.member ?? createData))
  check('Garçom criado com login (has_login=true)', createRes.ok() && createData.member?.has_login === true)

  // 2) Garçom loga de fato
  const ctx1 = await browser.newContext()
  const url1 = await waiterLogin(ctx1, PASS_1)
  await ctx1.close()
  console.log('   URL pós-login:', url1)
  check('Garçom acessa /garcom com a senha definida', /\/garcom/.test(url1))

  // 3) Dono inativa a conta
  const memberId = createData.member.id
  const offRes = await ownerCtx.request.patch(`${BASE}/api/dashboard/members`, { data: { memberId, active: false } })
  check('Inativar conta (API ok)', offRes.ok())

  // 4) Garçom inativo NÃO acessa /garcom (acesso exige active=true)
  const ctx2 = await browser.newContext()
  const url2 = await waiterLogin(ctx2, PASS_1)
  await ctx2.close()
  console.log('   URL pós-login (inativo):', url2)
  check('Conta inativa é bloqueada (não fica em /garcom)', !/\/garcom\/(pedidos|mesas|pagamentos|beneficios)/.test(url2))

  // 5) Dono troca a senha e reativa
  const resetRes = await ownerCtx.request.patch(`${BASE}/api/dashboard/members`, { data: { memberId, password: PASS_2 } })
  const onRes = await ownerCtx.request.patch(`${BASE}/api/dashboard/members`, { data: { memberId, active: true } })
  check('Trocar senha + reativar (API ok)', resetRes.ok() && onRes.ok())

  // 6) Garçom loga com a NOVA senha
  const ctx3 = await browser.newContext()
  const url3 = await waiterLogin(ctx3, PASS_2)
  await ctx3.close()
  console.log('   URL pós-login (nova senha):', url3)
  check('Login com a nova senha acessa /garcom', /\/garcom/.test(url3))

  // 7) Senha antiga não funciona mais
  const ctx4 = await browser.newContext()
  const url4 = await waiterLogin(ctx4, PASS_1)
  await ctx4.close()
  check('Senha antiga deixa de funcionar', !/\/garcom\/(pedidos|mesas|pagamentos|beneficios)/.test(url4))

  await browser.close()

  const passed = results.filter(r => r[1]).length
  console.log(`\n--- RESULTADO: ${passed}/${results.length} ---`)
  if (passed !== results.length) process.exitCode = 1
}

main()
  .catch(e => { console.error('ERRO:', e); process.exitCode = 1 })
  .finally(async () => {
    // cleanup: remove member + auth user de teste
    await admin.from('restaurant_members').delete().eq('restaurant_id', RESTAURANT_ID).eq('email', WAITER_EMAIL)
    try {
      const { data } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 })
      const u = (data?.users ?? []).find(x => (x.email ?? '').toLowerCase() === WAITER_EMAIL)
      if (u) await admin.auth.admin.deleteUser(u.id)
    } catch { /* ignore */ }
    console.log('cleanup: membro/usuário de teste removidos')
  })
