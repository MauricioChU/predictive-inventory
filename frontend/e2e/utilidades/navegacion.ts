import { expect, type Page } from '@playwright/test'

export type Letra = 'NORMAL' | 'GRANDE' | 'MUY_GRANDE'

/** La letra que cada prueba pidió con `usarLetra` (cada prueba tiene su propia página). */
const letraPedida = new WeakMap<Page, Letra>()

/** Lo que las pruebas usan de `window.__aplicacion` (src/app/ganchos-de-prueba.ts). */
interface VentanaConAplicacion {
  __aplicacion?: {
    tienda: { actualizarConfiguracion(cambios: { tamanoDeLetra: Letra }): Promise<void> }
  }
}

/**
 * Debe llamarse antes de `abrir`. Fija la copia rápida de localStorage (la que se aplica antes
 * de abrir la base, sin parpadeo) y, al abrir, la letra de la configuración de la tienda: desde
 * la Ola 3 es la fuente de verdad y `abrirApp` la aplica sobre la copia rápida.
 */
export async function usarLetra(page: Page, letra: Letra): Promise<void> {
  letraPedida.set(page, letra)
  await page.addInitScript((valor) => localStorage.setItem('pi.letra', valor), letra)
}

/**
 * Abre una ruta de la app y espera a que termine de arrancar. Desde la Ola 3 la app abre la
 * base local (IndexedDB) y prepara los datos ANTES de montar la interfaz, así que el evento
 * "load" ya no alcanza: se espera al <h1> de la pantalla (RN-UX-15: toda pantalla tiene uno) y,
 * si la prueba pidió una letra, a que la configuración la tenga aplicada.
 */
export async function abrir(page: Page, ruta: string): Promise<void> {
  await page.goto(ruta)
  await expect(page.locator('#contenido h1')).toBeVisible()
  const letra = letraPedida.get(page)
  if (letra === undefined) return
  await page.evaluate(async (valor) => {
    const aplicacion = (window as VentanaConAplicacion).__aplicacion
    if (!aplicacion) throw new Error('La app no expuso window.__aplicacion')
    await aplicacion.tienda.actualizarConfiguracion({ tamanoDeLetra: valor })
  }, letra)
  await expect(page.locator('html')).toHaveAttribute('data-letra', letra)
}
