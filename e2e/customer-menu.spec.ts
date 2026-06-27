/**
 * E2E — Public cardápio page  (`/:slug/cardapio`)
 * No auth required — publicly accessible.
 */

import { test, expect } from './setup/fixtures'

test.describe('Cardápio público', () => {
  test('carrega sem erros JS', async ({ page, ctx }) => {
    const jsErrors: string[] = []
    page.on('pageerror', (err) => jsErrors.push(err.message))

    await page.goto(`/${ctx.slug}/cardapio`, { waitUntil: 'domcontentloaded' })
    await page.waitForLoadState('networkidle').catch(() => {})

    const criticalErrors = jsErrors.filter(
      (msg) =>
        !msg.includes('supabase') &&
        !msg.includes('WebSocket') &&
        !msg.includes('NEXT_PUBLIC'),
    )
    expect(criticalErrors).toHaveLength(0)
  })

  test('exibe header do cardápio', async ({ page, ctx }) => {
    await page.goto(`/${ctx.slug}/cardapio`, { waitUntil: 'networkidle' })

    await expect(
      page.locator('text=Cardápio digital').or(page.locator('h1')).first(),
    ).toBeVisible({ timeout: 10_000 })
  })

  test('exibe categoria criada no setup', async ({ page, ctx }) => {
    await page.goto(`/${ctx.slug}/cardapio`, { waitUntil: 'networkidle' })

    await expect(page.locator('text=Pratos E2E')).toBeVisible({ timeout: 10_000 })
  })

  test('exibe item de menu com preço', async ({ page, ctx }) => {
    await page.goto(`/${ctx.slug}/cardapio`, { waitUntil: 'networkidle' })

    await expect(page.locator('text=Item E2E 1')).toBeVisible({ timeout: 10_000 })
    await expect(page.locator('text=/R\\$\\s*25/')).toBeVisible()
  })

  test('slug inválido exibe mensagem de não encontrado', async ({ page }) => {
    await page.goto('/restaurante-que-nao-existe-xyz/cardapio', {
      waitUntil: 'networkidle',
    })

    await expect(
      page
        .locator('text=Restaurante não encontrado')
        .or(page.locator('text=não encontrado'))
        .or(page.locator('text=404')),
    ).toBeVisible({ timeout: 10_000 })
  })
})
