/**
 * E2E — Login page
 *
 * Route: `/login` (inside (dashboard) route group)
 *
 * Three access profiles via `?perfil=` query param:
 *   • `/login?perfil=admin`    → "Restaurante" selected, heading "Painel do restaurante"
 *   • `/login?perfil=garcom`   → "Garçom" selected, heading "Acesso garçom"
 *   • `/login` (default)       → "Cliente" selected after hydration, heading "Área do cliente"
 *
 * Role selector buttons always visible: "Cliente", "Restaurante", "Garçom"
 */

import { test, expect } from '@playwright/test'

const LOGIN_URL = '/login'
const ADMIN_URL = '/login?perfil=admin'
const WAITER_URL = '/login?perfil=garcom'

test.describe('Login page — page structure', () => {
  test('renders the login page without JS errors', async ({ page }) => {
    const jsErrors: string[] = []
    page.on('pageerror', (err) => jsErrors.push(err.message))

    await page.goto(LOGIN_URL, { waitUntil: 'domcontentloaded' })
    await page.waitForLoadState('networkidle').catch(() => {})

    const criticalErrors = jsErrors.filter(
      (msg) =>
        !msg.includes('supabase') &&
        !msg.includes('WebSocket') &&
        !msg.includes('NEXT_PUBLIC'),
    )
    expect(criticalErrors).toHaveLength(0)
  })

  test('admin role via ?perfil=admin shows "Painel do restaurante" heading', async ({ page }) => {
    await page.goto(ADMIN_URL, { waitUntil: 'domcontentloaded' })

    const heading = page.locator('h1', { hasText: 'Painel do restaurante' })
    await expect(heading).toBeVisible({ timeout: 8_000 })
  })

  test('displays the three role selector buttons', async ({ page }) => {
    await page.goto(LOGIN_URL, { waitUntil: 'domcontentloaded' })

    await expect(page.locator('button', { hasText: 'Cliente' })).toBeVisible()
    await expect(page.locator('button', { hasText: 'Restaurante' })).toBeVisible()
    await expect(page.locator('button', { hasText: 'Garçom' })).toBeVisible()
  })

  test('admin role shows email and password inputs', async ({ page }) => {
    await page.goto(ADMIN_URL, { waitUntil: 'domcontentloaded' })

    await expect(
      page.locator('input[type="email"][placeholder="seu@restaurante.com"]'),
    ).toBeVisible()
    await expect(
      page.locator('input[type="password"]'),
    ).toBeVisible()
  })

  test('admin role shows "Entrar no painel" submit button', async ({ page }) => {
    await page.goto(ADMIN_URL, { waitUntil: 'domcontentloaded' })

    await expect(
      page.locator('button[type="submit"]', { hasText: 'Entrar no painel' }),
    ).toBeVisible()
  })

  test('clicking "Garçom" button switches heading and form placeholder', async ({ page }) => {
    await page.goto(ADMIN_URL, { waitUntil: 'domcontentloaded' })

    await page.locator('button', { hasText: 'Garçom' }).click()

    await expect(page.locator('h1', { hasText: 'Acesso garçom' })).toBeVisible()
    await expect(
      page.locator('input[type="email"][placeholder="garcom@restaurante.com"]'),
    ).toBeVisible()
    await expect(
      page.locator('button[type="submit"]', { hasText: 'Entrar como garçom' }),
    ).toBeVisible()
  })

  test('clicking "Cliente" button switches heading to "Área do cliente"', async ({ page }) => {
    await page.goto(ADMIN_URL, { waitUntil: 'domcontentloaded' })

    await page.locator('button', { hasText: 'Cliente' }).click()

    await expect(page.locator('h1', { hasText: 'Área do cliente' })).toBeVisible()
  })

  test('"Voltar ao site" link is present and points to /', async ({ page }) => {
    await page.goto(LOGIN_URL, { waitUntil: 'domcontentloaded' })

    const backLink = page.locator('a', { hasText: 'Voltar ao site' })
    await expect(backLink).toBeVisible()
    await expect(backLink).toHaveAttribute('href', '/')
  })

  test('"Cadastre seu estabelecimento" link is visible in admin role', async ({ page }) => {
    await page.goto(ADMIN_URL, { waitUntil: 'domcontentloaded' })

    const registerLink = page.locator('a', { hasText: 'Cadastre seu estabelecimento' })
    await expect(registerLink).toBeVisible()
    await expect(registerLink).toHaveAttribute('href', '/cadastro')
  })
})

test.describe('Login page — authentication flows', () => {
  test.skip(
    true,
    'Requires valid Supabase credentials (SUPABASE_URL, SUPABASE_ANON_KEY) and ' +
      'a seeded user account. Run in an environment with those env vars set.',
  )

  test('admin login with valid credentials redirects to /dashboard', async ({ page }) => {
    await page.goto(ADMIN_URL, { waitUntil: 'networkidle' })

    await page.locator('input[type="email"]').fill(process.env.TEST_ADMIN_EMAIL ?? '')
    await page.locator('input[type="password"]').fill(process.env.TEST_ADMIN_PASSWORD ?? '')
    await page.locator('button[type="submit"]').click()

    await expect(page).toHaveURL(/\/dashboard/, { timeout: 10_000 })
  })

  test('admin login with invalid credentials shows error toast', async ({ page }) => {
    await page.goto(ADMIN_URL, { waitUntil: 'networkidle' })

    await page.locator('input[type="email"]').fill('invalid@example.com')
    await page.locator('input[type="password"]').fill('wrongpassword')
    await page.locator('button[type="submit"]').click()

    const errorToast = page.locator('[data-sonner-toast]', {
      hasText: 'E-mail ou senha incorretos',
    })
    await expect(errorToast).toBeVisible({ timeout: 8_000 })
  })

  test('waiter login with valid credentials redirects to /garcom/pedidos', async ({ page }) => {
    await page.goto(WAITER_URL, { waitUntil: 'networkidle' })

    await page.locator('input[type="email"]').fill(process.env.TEST_WAITER_EMAIL ?? '')
    await page.locator('input[type="password"]').fill(process.env.TEST_WAITER_PASSWORD ?? '')
    await page.locator('button[type="submit"]').click()

    await expect(page).toHaveURL(/\/garcom\/pedidos/, { timeout: 10_000 })
  })
})
