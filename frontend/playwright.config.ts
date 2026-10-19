import process from 'node:process'
import { defineConfig, devices } from '@playwright/test'

// PUERTO_E2E: cada worktree corre su propio servidor de desarrollo sin pisar el de otro.
const PUERTO = process.env.CI ? '4173' : (process.env.PUERTO_E2E ?? '5173')
const BASE = `http://localhost:${PUERTO}/predictive-inventory/`

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  expect: { timeout: 5_000 },
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: { baseURL: BASE, trace: 'on-first-retry', locale: 'es-PE', timezoneId: 'America/Lima' },
  projects: [
    { name: 'celular', use: { ...devices['Pixel 7'], viewport: { width: 360, height: 740 } } },
    { name: 'pc', use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 800 } } },
  ],
  webServer: {
    command: process.env.CI ? 'npm run preview' : `npm run dev -- --port ${PUERTO} --strictPort`,
    url: BASE,
    reuseExistingServer: !process.env.CI,
  },
})
