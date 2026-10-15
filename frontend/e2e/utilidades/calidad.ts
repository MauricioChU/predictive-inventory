import AxeBuilder from '@axe-core/playwright'
import { expect, type Page } from '@playwright/test'

export type Letra = 'NORMAL' | 'GRANDE' | 'MUY_GRANDE'

/** Debe llamarse antes de page.goto: fija el tamaño de letra guardado. */
export async function usarLetra(page: Page, letra: Letra): Promise<void> {
  await page.addInitScript((valor) => localStorage.setItem('pi.letra', valor), letra)
}

/** RN-UX-09 / RN-SIS-06.
 *
 * Ronda 2 (hallazgo S1): un overflow:hidden en algún ancestro puede esconder visualmente un
 * desborde (recorta contenido) sin que scrollWidth del documento lo delate — scrollWidth
 * seguía midiendo el ancho del viewport mientras un enlace de la barra quedaba tapado. Por eso
 * además de ese chequeo, se verifica la geometría real: ningún elemento de <main> o de la
 * barra de navegación debe salir del viewport, y <main> tampoco debe tener su propio
 * desplazamiento horizontal interno.
 */
export async function esperarSinDesplazamientoHorizontal(page: Page): Promise<void> {
  const { scroll, cliente } = await page.evaluate(() => ({
    scroll: document.documentElement.scrollWidth,
    cliente: document.documentElement.clientWidth,
  }))
  expect(scroll, 'la página no debe desplazarse a los lados').toBeLessThanOrEqual(cliente)

  const resultado = await page.evaluate(() => {
    const anchoVentana = document.documentElement.clientWidth
    const main = document.getElementById('contenido')
    const nav = document.querySelector('nav')
    const elementos = [
      ...(main ? Array.from(main.querySelectorAll('*')) : []),
      ...(nav ? Array.from(nav.querySelectorAll('*')) : []),
    ]
    const fueraDeVista = elementos
      .map((el) => el.getBoundingClientRect())
      .filter((r) => r.width > 0 && r.height > 0)
      .some((r) => r.left < -1 || r.right > anchoVentana + 1)
    const mainDesborda = main ? main.scrollWidth > main.clientWidth + 1 : false
    return { fueraDeVista, mainDesborda }
  })
  expect(
    resultado.fueraDeVista,
    'ningún elemento de <main> o de la navegación debe salir del viewport',
  ).toBe(false)
  expect(
    resultado.mainDesborda,
    '<main> no debe tener su propio desplazamiento horizontal interno',
  ).toBe(false)
}

/** RN-SIS-07 */
export async function esperarSinViolacionesGraves(page: Page): Promise<void> {
  const resultado = await new AxeBuilder({ page }).analyze()
  const graves = resultado.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical')
  expect(graves.map((v) => `${v.id}: ${v.help}`)).toEqual([])
}
