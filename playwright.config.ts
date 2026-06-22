import { defineConfig, devices } from '@playwright/test'

/**
 * Playwright E2E configuration for the Qomanda app.
 *
 * The dev server must be running separately (`npm run dev`) before executing
 * these tests.  Tests are written to be resilient against a missing Supabase
 * backend — they assert on structural page elements that are rendered even
 * before any async data resolves.
 */
export default defineConfig({
  testDir: './e2e',

  // Allow the full page lifecycle to settle before timing out a test.
  timeout: 30_000,

  // Each test gets a fresh, isolated browser context.
  fullyParallel: false,

  // Fail the run on any test.only left in source.
  forbidOnly: Boolean(process.env.CI),

  // Retry once in CI so transient flakes don't break the pipeline.
  retries: process.env.CI ? 1 : 0,

  reporter: 'list',

  use: {
    baseURL: 'http://localhost:3000',

    // Capture a trace on the first retry — use `npx playwright show-trace` to inspect.
    trace: 'on-first-retry',

    // Capture a screenshot on failure automatically.
    screenshot: 'only-on-failure',

    // Use a mobile viewport to match the PWA's primary device target.
    viewport: { width: 390, height: 844 },
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
})
