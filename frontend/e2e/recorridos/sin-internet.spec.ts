// Plan 16, ítem 2 (RN-SIS-08, RN-UX-14): en modo avión, después de la primera carga, la app
// abre y funciona completa, por la pantalla, y nada habla de la conexión.
import process from 'node:process'
import { expect, test, type Page } from '@playwright/test'
import { abrir } from '../utilidades/navegacion'
import {
  comoSeLee,
  crearProductoPorPantalla,
  empezarElDia,
  h1,
  hacerPrimeraVez,
  irA,
  venderPorPantalla,
} from '../utilidades/recorridos'

/** Palabras de un error de conexión ("Funciona sin internet", de la app, sí vale). */
const HABLA_DE_LA_CONEXION =
  /conexi[oó]n|offline|network|fetch|en l[ií]nea|(no hay|necesitas|requiere|revisa tu|sin acceso a) (internet|la red|red)/i

async function esperarSinErroresDeConexion(page: Page, pantalla: string): Promise<void> {
  const texto = await page.locator('body').innerText()
  expect(texto, `${pantalla}: nada habla de la conexión`).not.toMatch(HABLA_DE_LA_CONEXION)
}

test.describe('RN-SIS-08 / RN-UX-14: en modo avión (build de producción con Service Worker)', () => {
  test.skip(!process.env.CI, 'El Service Worker solo existe en el build de producción (npm run preview)')

  test('tras la primera carga, sin internet: abrir la app, vender, ver Control y ¿Necesito comprar?', async ({
    page,
    context,
  }) => {
    test.setTimeout(60_000)
    const fallidos: string[] = []
    const errores: string[] = []
    page.on('requestfailed', (pedido) => fallidos.push(pedido.url()))
    page.on('console', (m) => m.type() === 'error' && errores.push(m.text()))
    page.on('pageerror', (e) => errores.push(e.message))

    // Primera carga, con internet: la app se instala en el celular (Service Worker).
    await empezarElDia(page)
    await hacerPrimeraVez(page)
    await page.evaluate(async () => {
      await navigator.serviceWorker.ready
    })
    await page.waitForFunction(() => navigator.serviceWorker.controller !== null)
    await crearProductoPorPantalla(page, {
      nombre: 'Lejía Tradicional 1 L',
      categoria: 'Lejías y desinfectantes',
      compra: '2.40',
      venta: '3.50',
      minimo: '3',
      stock: '5',
    })

    await irA(page, 'Inicio')

    // Modo avión: se cierra y se vuelve a abrir la app.
    await context.setOffline(true)
    await page.reload()
    await expect(h1(page)).toHaveText(/^Hola, Bodega Rosita/)
    await esperarSinErroresDeConexion(page, 'Inicio')

    await page.getByRole('button', { name: 'Vender' }).click()
    await venderPorPantalla(
      page,
      [{ buscado: 'lejia', nombre: 'Lejía Tradicional 1 L', cantidad: 3 }],
      'S/ 20',
      'S/ 10.50',
    )
    await esperarSinErroresDeConexion(page, 'Venta registrada')

    await irA(page, 'Control')
    await expect(page.locator('#contenido section .tarjeta-de-cifra')).toContainText(
      comoSeLee('Vendiste S/ 10.50'),
    )
    await expect(page.locator('section h2')).toHaveCount(7)
    await esperarSinErroresDeConexion(page, 'Control')

    await irA(page, 'Inicio')
    await page.getByRole('button', { name: '¿Necesito comprar?' }).click()
    await page.getByLabel('¿Qué producto quieres comprar?').fill('lejia')
    await page.getByRole('button', { name: /Lejía Tradicional 1 L/ }).click()
    await expect(page.locator('.respuesta-grande')).toHaveText(comoSeLee('Sí, compra ~4 unid. (S/ 9.60)'))
    await esperarSinErroresDeConexion(page, '¿Necesito comprar?')

    // Y abrirla de nuevo desde el ícono (otra ventana), todavía sin internet.
    const otra = await context.newPage()
    otra.on('requestfailed', (pedido) => fallidos.push(pedido.url()))
    await abrir(otra, './')
    await expect(h1(otra)).toHaveText(/^Hola, Bodega Rosita/)
    await expect(otra.locator('.tarjeta-de-cifra')).toContainText(comoSeLee('Vendiste S/ 10.50'))
    await esperarSinErroresDeConexion(otra, 'Inicio en otra ventana')

    expect(fallidos, 'ningún pedido falló sin internet').toEqual([])
    expect(errores, 'sin errores en la consola').toEqual([])
  })
})
