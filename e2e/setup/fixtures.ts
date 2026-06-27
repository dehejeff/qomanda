/**
 * Playwright test fixtures that expose the live test context
 * (slug, table token, credentials) created by global-setup.ts.
 */

import { test as base } from '@playwright/test'
import { readFileSync } from 'fs'

interface TestContext {
  slug: string
  restaurantId: string
  tableToken: string
  adminEmail: string
  waiterEmail: string
  password: string
}

function loadContext(): TestContext {
  try {
    return JSON.parse(readFileSync('e2e/.test-run-context.json', 'utf8'))
  } catch {
    throw new Error(
      'e2e/.test-run-context.json not found. ' +
        'Run the full suite via `npx playwright test` so globalSetup runs first.',
    )
  }
}

export const test = base.extend<{ ctx: TestContext }>({
  ctx: async ({}, use) => {
    await use(loadContext())
  },
})

export { expect } from '@playwright/test'
