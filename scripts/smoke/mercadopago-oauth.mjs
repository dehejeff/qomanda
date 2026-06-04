// Verificação E2E: Mercado Pago OAuth — gating de auth, degradação sem
// credenciais e rejeição de state forjado (anti-CSRF). O round-trip real
// exige MERCADO_PAGO_CLIENT_ID/SECRET + app no MP (testado em produção).
import { chromium } from 'playwright'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const BASE = 'http://localhost:3000'
const OWNER_EMAIL = 'smoke-garcom-owner-1780586566030@smoke.com'
const OWNER_PASS = 'SmokeTest2026!'

const results = []
const check = (label, ok, extra = '') => { results.push([label, ok]); console.log(`${ok ? '✅' : '❌'} ${label}${extra ? ' — ' + extra : ''}`) }

async function main() {
  const browser = await chromium.launch()
  const ctx = await browser.newContext()
  const page = await ctx.newPage()

  // login owner
  await page.goto(`${BASE}/login?perfil=admin`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(800)
  await page.locator('input[type="email"]').first().fill(OWNER_EMAIL)
  await page.locator('input[type="password"]').first().fill(OWNER_PASS)
  await page.locator('button[type="submit"]').first().click()
  await page.waitForURL('**/dashboard**', { timeout: 30000 }).catch(() => {})
  await page.waitForTimeout(1500)

  // 1) GET gateway responde (migration aplicada) + expõe mpOAuthAvailable
  const gw = await ctx.request.get(`${BASE}/api/dashboard/gateway`)
  const gwData = await gw.json().catch(() => ({}))
  check('GET /gateway responde 200 (colunas MP existem)', gw.status() === 200, `status=${gw.status()}`)
  check('Resposta inclui mpOAuthAvailable', typeof gwData.mpOAuthAvailable === 'boolean', `valor=${gwData.mpOAuthAvailable}`)

  const oauthOn = gwData.mpOAuthAvailable === true

  // 2) connect — sem credenciais → 400; com credenciais → redirect p/ MP
  const connect = await ctx.request.get(`${BASE}/api/dashboard/gateway/mercadopago/connect`, { maxRedirects: 0 })
  if (oauthOn) {
    const loc = connect.headers()['location'] ?? ''
    check('connect redireciona para o Mercado Pago', connect.status() >= 300 && connect.status() < 400 && loc.includes('mercadopago'), `loc=${loc.slice(0, 60)}`)
  } else {
    check('connect degrada sem credenciais (400)', connect.status() === 400, `status=${connect.status()}`)
  }

  // 3) callback com state forjado → redireciona com mp=error (anti-CSRF)
  const cbBad = await ctx.request.get(`${BASE}/api/dashboard/gateway/mercadopago/callback?code=abc&state=forjado`, { maxRedirects: 0 })
  const locBad = cbBad.headers()['location'] ?? ''
  check('callback rejeita state forjado (mp=error)', cbBad.status() >= 300 && cbBad.status() < 400 && /mp=error/.test(locBad), `loc=${locBad.slice(0, 80)}`)

  // 4) callback sem params → mp=error
  const cbEmpty = await ctx.request.get(`${BASE}/api/dashboard/gateway/mercadopago/callback`, { maxRedirects: 0 })
  const locEmpty = cbEmpty.headers()['location'] ?? ''
  check('callback sem params → mp=error', /mp=error/.test(locEmpty), `loc=${locEmpty.slice(0, 80)}`)

  // 5) connect exige autenticação (sem cookies → 401)
  const anon = await browser.newContext()
  const connectAnon = await anon.request.get(`${BASE}/api/dashboard/gateway/mercadopago/connect`, { maxRedirects: 0 })
  check('connect exige dono autenticado (401 anônimo)', connectAnon.status() === 401, `status=${connectAnon.status()}`)
  await anon.close()

  // 6) UI: aba Pagamentos → selecionar Mercado Pago renderiza o bloco novo
  await page.goto(`${BASE}/dashboard/settings?tab=pagamentos`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2500)
  // clica no BOTÃO de provider (texto único do card), não no parágrafo de descrição
  await page.getByText('PIX e cartão na conta MP').first().click().catch(() => {})
  await page.waitForTimeout(800)
  const mpBlock = await page.getByText(/Conectar com Mercado Pago|indisponível|Mercado Pago conectado/i).first().isVisible().catch(() => false)
  check('UI renderiza bloco Mercado Pago (OAuth/manual/conectado)', mpBlock)

  await browser.close()

  const passed = results.filter(r => r[1]).length
  console.log(`\n--- RESULTADO: ${passed}/${results.length} ---`)
  if (passed !== results.length) process.exitCode = 1
}

main().catch(e => { console.error('ERRO:', e); process.exitCode = 1 })
