import AxeBuilder from '@axe-core/playwright'
import { expect, type Page } from '@playwright/test'

export type Letra = 'NORMAL' | 'GRANDE' | 'MUY_GRANDE'

/** Debe llamarse antes de page.goto: fija el tamaño de letra guardado. */
export async function usarLetra(page: Page, letra: Letra): Promise<void> {
  await page.addInitScript((valor) => localStorage.setItem('pi.letra', valor), letra)
}

/** RN-UX-09 / RN-SIS-06 */
export async function esperarSinDesplazamientoHorizontal(page: Page): Promise<void> {
  const { scroll, cliente } = await page.evaluate(() => ({
    scroll: document.documentElement.scrollWidth,
    cliente: document.documentElement.clientWidth,
  }))
  expect(scroll, 'la página no debe desplazarse a los lados').toBeLessThanOrEqual(cliente)
}

/** RN-SIS-07 */
export async function esperarSinViolacionesGraves(page: Page): Promise<void> {
  const resultado = await new AxeBuilder({ page }).analyze()
  const graves = resultado.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical')
  expect(graves.map((v) => `${v.id}: ${v.help}`)).toEqual([])
}
