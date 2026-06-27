/**
 * E2E — Customer check-in page  (`/:slug`)
 *
 * Two render states:
 *   A) No QR token  → QR-scan landing (no API call needed)
 *   B) QR token present → table verification → check-in form
 *
 * The recently-fixed flash bug: page must not show the check-in form
 * before the loading state resolves (lazy useState from localStorage).
 */

import { test, expect } from './setup/fixtures'

test.describe('Check-in — no QR token (scan screen)', () => {
  test('no "Fazer Check-in" button visible without a table token', async ({ page, ctx }) => {
    await page.goto(`/${ctx.slug}`, { waitUntil: 'domcontentloaded' })
    await page.waitForLoadState('networkidle').catch(() => {})

    const checkInButton = page.locator('button', { hasText: 'Fazer Check-in' })
    await expect(checkInButton).not.toBeVisible({ timeout: 8_000 })
  })

  test('no JS errors on initial load', async ({ page, ctx }) => {
    const jsErrors: string[] = []
    page.on('pageerror', (err) => jsErrors.push(err.message))

    await page.goto(`/${ctx.slug}`, { waitUntil: 'domcontentloaded' })
    await page.waitForLoadState('networkidle').catch(() => {})

    const criticalErrors = jsErrors.filter(
      (msg) =>
        !msg.includes('supabase') &&
        !msg.includes('WebSocket') &&
        !msg.includes('fetch') &&
        !msg.includes('NEXT_PUBLIC'),
    )
    expect(criticalErrors).toHaveLength(0)
  })
})

test.describe('Check-in — with QR token (table form)', () => {
  test('shows "Primeiro acesso" and "Já tenho cadastro" after QR verification', async ({
    page,
    ctx,
  }) => {
    await page.goto(`/${ctx.slug}?mesa=01&t=${ctx.tableToken}`, {
      waitUntil: 'networkidle',
    })

    await expect(page.locator('text=Primeiro acesso')).toBeVisible({ timeout: 10_000 })
    await expect(page.locator('text=Já tenho cadastro')).toBeVisible()
  })

  test('"Primeiro acesso" reveals the registration form', async ({ page, ctx }) => {
    await page.goto(`/${ctx.slug}?mesa=01&t=${ctx.tableToken}`, {
      waitUntil: 'networkidle',
    })

    await page.locator('button', { hasText: 'Primeiro acesso' }).click()

    await expect(page.locator('input[placeholder="João"]')).toBeVisible()
    await expect(page.locator('input[placeholder="Silva"]')).toBeVisible()
    await expect(page.locator('input[autocomplete="tel"]').first()).toBeVisible()
    await expect(page.locator('button', { hasText: 'Fazer Check-in' })).toBeVisible()
  })

  test('"Já tenho cadastro" reveals the WhatsApp login input', async ({ page, ctx }) => {
    await page.goto(`/${ctx.slug}?mesa=01&t=${ctx.tableToken}`, {
      waitUntil: 'networkidle',
    })

    await page.locator('button', { hasText: 'Já tenho cadastro' }).click()

    await expect(
      page
        .locator('input[placeholder*="99999"]')
        .or(page.locator('input[placeholder*="+55"]')),
    ).toBeVisible()
  })

  test('full check-in: preenche formulário → redireciona para /home', async ({ page, ctx }) => {
    await page.goto(`/${ctx.slug}?mesa=01&t=${ctx.tableToken}`, {
      waitUntil: 'networkidle',
    })

    await page.locator('button', { hasText: 'Primeiro acesso' }).click()

    // Basic fields
    await page.locator('input[placeholder="João"]').fill('Teste')
    await page.locator('input[placeholder="Silva"]').fill('E2E')
    await page.locator('input[autocomplete="tel"]').first().fill('(11) 99999-1234')

    // PIN (4 digits) — the PinInput uses input[autocomplete="one-time-code"]
    const pinInput = page.locator('input[autocomplete="one-time-code"]').first()
    await pinInput.fill('1234')

    // Confirm PIN appears after first PIN is filled
    const pinConfirm = page.locator('input[autocomplete="one-time-code"]').nth(1)
    await expect(pinConfirm).toBeVisible({ timeout: 3_000 })
    await pinConfirm.fill('1234')

    // Button should now be enabled
    const submitBtn = page.locator('button', { hasText: 'Fazer Check-in' })
    await expect(submitBtn).toBeEnabled({ timeout: 3_000 })
    await submitBtn.click()

    await expect(page).toHaveURL(new RegExp(`/${ctx.slug}/home`), { timeout: 15_000 })
  })
})
