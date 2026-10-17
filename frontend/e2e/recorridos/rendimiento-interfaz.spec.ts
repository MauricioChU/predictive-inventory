// Plan 16, ítem 4 (RN-SIS-09, medición opcional): con 300 productos y 50 000 movimientos y la CPU
// 4 veces más lenta (un celular de gama media), lo que la persona siente en la pantalla:
// abrir Control (< 1 s) y confirmar una venta desde Vender (< 300 ms).
//   MEDIR_RENDIMIENTO=1 npx playwright test e2e/recorridos/rendimiento-interfaz.spec.ts --project=celular
import process from 'node:process'
import { expect, test, type Page } from '@playwright/test'
import { prepararTienda } from '../utilidades/control'
import { abrir } from '../utilidades/navegacion'
import { h1, irA } from '../utilidades/recorridos'
import { copiaConHistoria, frenarCpu, mediana } from '../utilidades/rendimiento'

const VECES = 5

/** Lo que la medición usa de la aplicación real (solo para cargar los datos masivos). */
interface AplicacionEnLaPagina {
  respaldo: { restaurarCopia(texto: string, d: { confirmaciones: number }): Promise<void> }
  catalogo: { buscarProductos(filtro: { texto: string }): Promise<unknown[]> }
  esperarTareasPendientes(): Promise<void>
}
type VentanaConAplicacion = Window & { __aplicacion?: AplicacionEnLaPagina }

/**
 * Toca (dentro de la página) el primer `selector` cuyo texto empieza con `texto` y mide, con el
 * reloj de la página, cuánto tarda en cumplirse `listo` (se mira en cada cuadro): lo que tarda
 * la pantalla en mostrar el resultado.
 */
async function medirToque(page: Page, selector: string, texto: string, listo: string): Promise<number> {
  return page.evaluate(
    ({ selector, texto, condicion }) =>
      new Promise<number>((resolver, rechazar) => {
        const elemento = [...document.querySelectorAll<HTMLElement>(selector)].find((e) =>
          (e.textContent ?? '').trim().startsWith(texto),
        )
        if (!elemento) {
          rechazar(new Error(`No está ${selector} "${texto}"`))
          return
        }
        const cumple = new Function(`return (${condicion})`) as () => boolean
        const inicio = performance.now()
        const mirar = () => {
          if (cumple()) resolver(Math.round(performance.now() - inicio))
          else requestAnimationFrame(mirar)
        }
        elemento.click()
        requestAnimationFrame(mirar)
      }),
    { selector, texto, condicion: listo },
  )
}

const CONTROL_LISTO = `(() => {
  const tablero = document.querySelector('#contenido .tablero')
  return !!tablero && tablero.getAttribute('aria-busy') === 'false' &&
    document.querySelectorAll('#contenido section h2').length === 7 &&
    !!document.querySelector('#contenido section .tarjeta-de-cifra')
})()`
const VENTA_LISTA = `document.querySelector('#contenido h1')?.textContent?.trim() === 'Venta registrada'`

test.describe('RN-SIS-09 con la interfaz (medición opcional)', () => {
  test.skip(!process.env.MEDIR_RENDIMIENTO, 'Solo con MEDIR_RENDIMIENTO=1')

  test('300 productos y 50 000 movimientos, CPU x4: abrir Control y confirmar una venta', async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== 'celular', 'Se mide una vez, en el perfil de celular')
    test.setTimeout(600_000)
    const { texto } = copiaConHistoria(0)
    await abrir(page, './')
    const productos = await page.evaluate(async (copia) => {
      const app = (window as VentanaConAplicacion).__aplicacion
      if (!app) throw new Error('La app no expuso window.__aplicacion')
      await app.respaldo.restaurarCopia(copia, { confirmaciones: 2 })
      await app.esperarTareasPendientes()
      return (await app.catalogo.buscarProductos({ texto: '' })).length
    }, texto)
    expect(productos, 'la tienda tiene sus 300 productos').toBe(300)
    await abrir(page, './ajustes')
    await prepararTienda(page, [])
    await abrir(page, './')
    await expect(h1(page)).toHaveText(/^Hola, Bodega Rosita/)
    await frenarCpu(page, 4)

    // Abrir Control desde la navegación, desde Inicio.
    const control: number[] = []
    for (let i = 0; i < VECES; i += 1) {
      await irA(page, 'Inicio')
      control.push(await medirToque(page, 'nav a', 'Control', CONTROL_LISTO))
    }

    // Confirmar una venta de un producto (uno de los más vendidos, con el botón de acceso rápido).
    const venta: number[] = []
    await irA(page, 'Vender')
    for (let i = 0; i < VECES; i += 1) {
      await page.locator('.accesos-rapidos button').first().click()
      await page.getByRole('button', { name: 'Cobrar' }).click()
      await page.getByRole('button', { name: 'Exacto', exact: true }).click()
      await expect(page.getByRole('button', { name: 'Confirmar venta' })).toBeEnabled()
      venta.push(await medirToque(page, '#contenido button', 'Confirmar venta', VENTA_LISTA))
      await page.getByRole('button', { name: 'Nueva venta' }).click()
      await expect(h1(page)).toHaveText('Vender')
    }

    const resumen =
      `RN-SIS-09 con la interfaz (CPU x4, ms): abrir Control ${JSON.stringify(control)} ` +
      `(mediana ${mediana(control)}, peor ${Math.max(...control)}; meta < 1000); ` +
      `confirmar venta ${JSON.stringify(venta)} (mediana ${mediana(venta)}, ` +
      `peor ${Math.max(...venta)}; meta < 300)`
    console.log(resumen)
    await testInfo.attach('rendimiento-interfaz-cpu-x4', { body: resumen, contentType: 'text/plain' })
    expect(mediana(control), 'abrir Control: menos de 1 s (RN-SIS-09)').toBeLessThan(1000)
    expect(mediana(venta), 'confirmar una venta: menos de 300 ms (RN-SIS-09)').toBeLessThan(300)
  })
})
