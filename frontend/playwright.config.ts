import process from 'node:process'
import { defineConfig, devices } from '@playwright/test'

const BASE = process.env.CI ? 'http://localhost:4173/predictive-inventory/' : 'http://localhost:5173/predictive-inventory/'

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  expect: { timeout: 5_000 },
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: { baseURL: BASE, trace: 'on-first-retry', locale: 'es-PE', timezoneId: 'America/Lima' },
  projects: [
    { name: 'celular', use: { ...devices['Pixel 7'], viewport: { width: 360, height: 740 } } },
    { name: 'pc', use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 800 } } },
  ],
  webServer: {
    command: process.env.CI ? 'npm run preview' : 'npm run dev',
    url: BASE,
    reuseExistingServer: !process.env.CI,
  },
})
