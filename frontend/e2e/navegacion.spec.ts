import { expect, test } from '@playwright/test'
import { esperarSinDesplazamientoHorizontal, esperarSinViolacionesGraves, usarLetra } from './utilidades/calidad'

const DESTINOS = ['Inicio', 'Vender', 'Recibir', 'Productos', 'Control']
const ANCHOS = [320, 360, 768, 1280]

test.describe('RN-UX-12: navegación', () => {
  test('los cinco destinos están visibles y funcionan', async ({ page }) => {
    await page.goto('./')
    for (const destino of DESTINOS) {
      await page.getByRole('link', { name: destino }).click()
      await expect(page.getByRole('heading', { level: 1 })).toHaveText(destino)
    }
  })
})

test.describe('RN-SIS-06 y RN-SIS-07: responsive y accesibilidad', () => {
  for (const ancho of ANCHOS) {
    test(`sin desplazamiento horizontal a ${ancho}px con letra Muy grande`, async ({ page }) => {
      await usarLetra(page, 'MUY_GRANDE')
      await page.setViewportSize({ width: ancho, height: 800 })
      for (const ruta of ['./', './vender', './recibir', './productos', './control', './ajustes', './historial']) {
        await page.goto(ruta)
        await esperarSinDesplazamientoHorizontal(page)
        await expect(page.getByRole('navigation')).toBeVisible()
      }
    })
  }

  test('sin violaciones graves de accesibilidad', async ({ page }) => {
    await page.goto('./')
    await esperarSinViolacionesGraves(page)
  })
})
