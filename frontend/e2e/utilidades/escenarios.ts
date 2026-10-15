import { expect, type Page } from '@playwright/test'

type VentanaConGanchos = Window & {
  __pruebas?: { mostrarAvisoDeshacer: (mensaje?: string) => void }
}

/**
 * Muestra el aviso Deshacer global con los ganchos de prueba de la app
 * (src/app/ganchos-de-prueba.ts: solo en desarrollo o bajo un navegador automatizado).
 * Dura los 10 s de siempre (RN-OP-18, el gancho no puede alargarlo): cada prueba que lo usa
 * termina mucho antes y, al final, confirma con `esperarAvisoTodaviaVisible` que siguió a la
 * vista durante todas sus mediciones.
 */
export async function mostrarAvisoDeshacer(
  page: Page,
  mensaje = 'Venta registrada',
): Promise<void> {
  await page.evaluate((texto) => {
    const ganchos = (window as VentanaConGanchos).__pruebas
    if (!ganchos) throw new Error('La app no expuso window.__pruebas')
    ganchos.mostrarAvisoDeshacer(texto)
  }, mensaje)
  await expect(page.locator('.aviso-deshacer')).toBeVisible()
}

/** Falla si el aviso ya se cerró solo (la prueba midió sin él). */
export async function esperarAvisoTodaviaVisible(page: Page): Promise<void> {
  // Comprobación instantánea (sin reintentos): si ya se cerró, las mediciones fueron sin él.
  const visible = await page.locator('.aviso-deshacer').isVisible()
  expect(visible, 'el aviso siguió a la vista durante toda la prueba').toBe(true)
}

/**
 * Agrega al final de <main id="contenido"> una página larga: `parrafos` párrafos (cada uno con
 * un enlace si `conEnlaces`) y un botón #ultimo. Se inserta directo en el DOM desde la prueba:
 * todavía no hay pantallas reales con tanto contenido.
 */
export async function agregarContenidoLargo(
  page: Page,
  parrafos = 40,
  conEnlaces = false,
): Promise<void> {
  await page.evaluate(
    ({ cantidad, enlaces }) => {
      const main = document.getElementById('contenido')
      if (!main) throw new Error('Falta #contenido')
      for (let i = 1; i <= cantidad; i += 1) {
        const p = document.createElement('p')
        p.textContent = `Párrafo ${i} con algo de texto para ocupar espacio vertical en la pantalla. `
        if (enlaces) {
          const a = document.createElement('a')
          a.href = '#'
          a.textContent = `Enlace ${i}`
          p.append(a)
        }
        main.append(p)
      }
      const ultimo = document.createElement('button')
      ultimo.id = 'ultimo'
      ultimo.type = 'button'
      ultimo.textContent = 'Último botón'
      main.append(ultimo)
    },
    { cantidad: parrafos, enlaces: conEnlaces },
  )
}

export interface Caja {
  top: number
  bottom: number
  left: number
  right: number
  width: number
  height: number
}

/** Caja del primer elemento que coincide con `selector`; falla la prueba si no existe. */
export async function caja(page: Page, selector: string): Promise<Caja> {
  const medida = await page.evaluate((sel) => {
    const el = document.querySelector(sel)
    if (!el) return null
    const { top, bottom, left, right, width, height } = el.getBoundingClientRect()
    return { top, bottom, left, right, width, height }
  }, selector)
  expect(medida, `"${selector}" debe existir`).not.toBeNull()
  return medida!
}
