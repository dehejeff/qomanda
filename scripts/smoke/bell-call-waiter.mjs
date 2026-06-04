// Verificação E2E: sino "Chamar Garçom" no dashboard do dono.
// Loga como owner, insere um chamado call_waiter via admin e confirma
// o toast em tempo real + o badge do sino.
import { chromium } from 'playwright'
import { createClient } from '@supabase/supabase-js'
import WebSocket from 'ws'
import fs from 'node:fs'

// Node 20 não tem WebSocket nativo — necessário p/ supabase-js inicializar.
if (!globalThis.WebSocket) globalThis.WebSocket = WebSocket
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const env = fs.readFileSync(path.join(ROOT, '.env.local'), 'utf8')
const get = (k) => {
  const m = env.match(new RegExp('^' + k + '=(.*)$', 'm'))
  return m ? m[1].trim().replace(/^["']|["']$/g, '') : null
}
const URL = get('NEXT_PUBLIC_SUPABASE_URL')
const KEY = get('SUPABASE_SERVICE_ROLE_KEY') || get('SUPABASE_SERVICE_ROLE') || get('SUPABASE_SECRET_KEY')
const admin = createClient(URL, KEY, { auth: { persistSession: false } })

const OWNER_EMAIL = 'smoke-garcom-owner-1780586566030@smoke.com'
const PASSWORD = 'SmokeTest2026!'
const RESTAURANT_ID = 'dd8a40c6-6618-402a-af23-df0d17e24f7a'
const BASE = 'http://localhost:3000'

let insertedId = null

async function main() {
  const browser = await chromium.launch()
  const page = await browser.newPage()
  const logs = []
  page.on('console', (m) => logs.push(`[console.${m.type()}] ${m.text()}`))

  console.log('1) Login owner…')
  await page.goto(`${BASE}/login?perfil=admin`, { waitUntil: 'domcontentloaded' })
  await page.locator('input[type="email"]').first().fill(OWNER_EMAIL)
  await page.locator('input[type="password"]').first().fill(PASSWORD)
  await page.locator('button[type="submit"]').first().click()
  await page.waitForURL('**/dashboard**', { timeout: 20000 })
  console.log('   → URL:', page.url())

  // Espera o sino montar e a subscription realtime assinar.
  await page.waitForSelector('button[aria-label^="Notificações"]', { timeout: 10000 })
  await page.waitForTimeout(2500)

  console.log('2) Inserindo chamado call_waiter via admin…')
  const { data, error } = await admin
    .from('restaurant_notifications')
    .insert({
      restaurant_id: RESTAURANT_ID,
      type: 'call_waiter',
      title: 'Chamado — Mesa 7',
      body: 'Mesa 7 está chamando o garçom.',
      link: '/garcom/mesas',
      severity: 'warning',
      metadata: { localLabel: 'Mesa 7', tableNumber: '7' },
    })
    .select('id')
    .single()
  if (error) throw new Error('insert: ' + error.message)
  insertedId = data.id
  console.log('   → notification id:', insertedId)

  console.log('3) Aguardando toast realtime…')
  const toast = page.getByText(/está chamando o garçom/i)
  let toastOk = false
  try {
    await toast.first().waitFor({ state: 'visible', timeout: 12000 })
    toastOk = true
    console.log('   ✅ toast visível:', (await toast.first().textContent())?.trim())
  } catch {
    console.log('   ❌ toast NÃO apareceu em 12s')
  }

  // Badge do sino deve mostrar contagem não-lida.
  const badge = page.locator('button[aria-label^="Notificações"] span').first()
  const ariaLabel = await page.locator('button[aria-label^="Notificações"]').getAttribute('aria-label')
  console.log('   sino aria-label:', ariaLabel)

  // Abre o painel e confere o item + CTA "Ver mesas".
  await page.locator('button[aria-label^="Notificações"]').click()
  await page.waitForTimeout(600)
  const hasItem = await page.getByText('Chamado — Mesa 7').first().isVisible().catch(() => false)
  const hasMesasCta = await page.getByText('Ver mesas →').first().isVisible().catch(() => false)
  console.log('   item no painel:', hasItem, '| CTA "Ver mesas →":', hasMesasCta)

  const shotDir = path.join(ROOT, 'scripts', 'smoke', '.cache')
  fs.mkdirSync(shotDir, { recursive: true })
  const shotPath = path.join(shotDir, 'bell-call-waiter.png')
  await page.screenshot({ path: shotPath, fullPage: false })
  console.log('   screenshot:', shotPath)

  await browser.close()

  console.log('\n--- RESULTADO ---')
  console.log('toast realtime:', toastOk ? 'PASS' : 'FAIL')
  console.log('badge não-lida:', /não lidas/.test(ariaLabel || '') ? 'PASS' : 'WARN(verifique)')
  console.log('item + CTA mesas:', hasItem && hasMesasCta ? 'PASS' : 'FAIL')
  if (logs.length) console.log('\nconsole logs:\n' + logs.slice(-15).join('\n'))

  if (!toastOk || !hasItem || !hasMesasCta) process.exitCode = 1
}

main()
  .catch((e) => { console.error('ERRO:', e); process.exitCode = 1 })
  .finally(async () => {
    if (insertedId) {
      await admin.from('restaurant_notifications').delete().eq('id', insertedId)
      console.log('cleanup: notificação de teste removida')
    }
  })
