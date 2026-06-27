/**
 * E2E — Login page  (`/login`)
 *
 * Profiles via `?perfil=`:
 *   /login?perfil=admin   → "Restaurante", heading "Painel do restaurante"
 *   /login?perfil=garcom  → "Garçom", heading "Acesso garçom"
 *   /login (default)      → "Cliente" after hydration
 */

import { test, expect } from './setup/fixtures'

const ADMIN_URL = '/login?perfil=admin'
const WAITER_URL = '/login?perfil=garcom'

test.describe('Login — estrutura da página', () => {
  test('carrega sem erros JS', async ({ page }) => {
    const jsErrors: string[] = []
    page.on('pageerror', (err) => jsErrors.push(err.message))

    await page.goto('/login', { waitUntil: 'domcontentloaded' })
    await page.waitForLoadState('networkidle').catch(() => {})

    const criticalErrors = jsErrors.filter(
      (msg) =>
        !msg.includes('supabase') &&
        !msg.includes('WebSocket') &&
        !msg.includes('NEXT_PUBLIC'),
    )
    expect(criticalErrors).toHaveLength(0)
  })

  test('perfil=admin mostra "Painel do restaurante"', async ({ page }) => {
    await page.goto(ADMIN_URL, { waitUntil: 'domcontentloaded' })
    await expect(page.locator('h1', { hasText: 'Painel do restaurante' })).toBeVisible({ timeout: 8_000 })
  })

  test('exibe os três botões de perfil', async ({ page }) => {
    await page.goto('/login', { waitUntil: 'domcontentloaded' })
    await expect(page.locator('button', { hasText: 'Cliente' })).toBeVisible()
    await expect(page.locator('button', { hasText: 'Restaurante' })).toBeVisible()
    await expect(page.locator('button', { hasText: 'Garçom' })).toBeVisible()
  })

  test('admin: inputs de e-mail e senha visíveis', async ({ page }) => {
    await page.goto(ADMIN_URL, { waitUntil: 'domcontentloaded' })
    await expect(page.locator('input[type="email"][placeholder="seu@restaurante.com"]')).toBeVisible()
    await expect(page.locator('input[type="password"]')).toBeVisible()
  })

  test('admin: botão "Entrar no painel" visível', async ({ page }) => {
    await page.goto(ADMIN_URL, { waitUntil: 'domcontentloaded' })
    await expect(page.locator('button[type="submit"]', { hasText: 'Entrar no painel' })).toBeVisible()
  })

  test('clicar em "Garçom" muda heading e placeholder', async ({ page }) => {
    // Use networkidle to ensure React has hydrated before clicking
    await page.goto(ADMIN_URL, { waitUntil: 'networkidle' })
    await page.locator('button', { hasText: 'Garçom' }).click()
    await expect(page.locator('h1', { hasText: 'Acesso garçom' })).toBeVisible({ timeout: 8_000 })
    await expect(page.locator('input[type="email"][placeholder="garcom@restaurante.com"]')).toBeVisible()
    await expect(page.locator('button[type="submit"]', { hasText: 'Entrar como garçom' })).toBeVisible()
  })

  test('clicar em "Cliente" muda heading para "Área do cliente"', async ({ page }) => {
    await page.goto(ADMIN_URL, { waitUntil: 'networkidle' })
    await page.locator('button', { hasText: 'Cliente' }).click()
    await expect(page.locator('h1', { hasText: 'Área do cliente' })).toBeVisible({ timeout: 8_000 })
  })

  test('"Voltar ao site" aponta para /', async ({ page }) => {
    await page.goto('/login', { waitUntil: 'domcontentloaded' })
    const backLink = page.locator('a', { hasText: 'Voltar ao site' })
    await expect(backLink).toBeVisible()
    await expect(backLink).toHaveAttribute('href', '/')
  })

  test('"Cadastre seu estabelecimento" aponta para /cadastro', async ({ page }) => {
    await page.goto(ADMIN_URL, { waitUntil: 'domcontentloaded' })
    const registerLink = page.locator('a', { hasText: 'Cadastre seu estabelecimento' })
    await expect(registerLink).toBeVisible()
    await expect(registerLink).toHaveAttribute('href', '/cadastro')
  })
})

test.describe('Login — fluxos de autenticação', () => {
  test('admin com credenciais válidas redireciona para /dashboard', async ({ page, ctx }) => {
    await page.goto(ADMIN_URL, { waitUntil: 'networkidle' })

    await page.locator('input[type="email"]').fill(ctx.adminEmail)
    await page.locator('input[type="password"]').fill(ctx.password)
    await page.locator('button[type="submit"]').click()

    await expect(page).toHaveURL(/\/dashboard/, { timeout: 12_000 })
  })

  test('admin com senha errada mostra toast de erro', async ({ page, ctx }) => {
    await page.goto(ADMIN_URL, { waitUntil: 'networkidle' })

    await page.locator('input[type="email"]').fill(ctx.adminEmail)
    await page.locator('input[type="password"]').fill('senha-errada-123')
    await page.locator('button[type="submit"]').click()

    const errorToast = page.locator('[data-sonner-toast]', { hasText: 'E-mail ou senha incorretos' })
    await expect(errorToast).toBeVisible({ timeout: 8_000 })
  })

  test('garçom com credenciais válidas redireciona para /garcom/pedidos', async ({ page, ctx }) => {
    await page.goto(WAITER_URL, { waitUntil: 'networkidle' })

    await page.locator('input[type="email"]').fill(ctx.waiterEmail)
    await page.locator('input[type="password"]').fill(ctx.password)
    await page.locator('button[type="submit"]').click()

    await expect(page).toHaveURL(/\/garcom\/pedidos/, { timeout: 12_000 })
  })
})
