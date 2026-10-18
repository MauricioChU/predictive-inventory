// Plan 18, tarea 8 (RN-UX-16, RN-RE-10): la primera vez es obligatoria. Mientras falta, la
// navegación no existe, toda dirección lleva a la bienvenida y la copia se puede traer desde ella.
import { expect, test, type Browser, type Page, type TestInfo } from '@playwright/test'
import { abrir } from '../utilidades/navegacion'
import { h1, hacerPrimeraVezHastaCargar } from '../utilidades/recorridos'
import { abrirTiendaLista, crearProducto } from '../utilidades/tienda'

const BIENVENIDA = 'Te damos la bienvenida'
const navegacion = (page: Page) => page.getByRole('navigation')

/** Una copia real (texto del archivo) de una tienda con un producto, hecha en `page`. */
async function copiaDeUnaTienda(page: Page): Promise<string> {
  await abrirTiendaLista(page, './')
  await crearProducto(page, { nombre: 'Lejía 1 L', compra: '2.40', venta: '3.50', stock: '10' })
  return page.evaluate(async () => {
    const app = (
      window as Window & {
        __aplicacion?: { respaldo: { guardarCopia(): Promise<{ contenido: Blob }> } }
      }
    ).__aplicacion
    if (!app) throw new Error('La app no expuso window.__aplicacion')
    return (await app.respaldo.guardarCopia()).contenido.text()
  })
}

/** Otro celular: un perfil nuevo, sin nada guardado, ya en la bienvenida. */
async function otroCelularEnLaBienvenida(
  browser: Browser,
  page: Page,
  testInfo: TestInfo,
): Promise<Page> {
  const contexto = await browser.newContext({
    viewport: page.viewportSize(),
    isMobile: testInfo.project.use.isMobile,
    hasTouch: testInfo.project.use.hasTouch,
    userAgent: await page.evaluate(() => navigator.userAgent),
    locale: 'es-PE',
    timezoneId: 'America/Lima',
    baseURL: testInfo.project.use.baseURL,
  })
  const nuevo = await contexto.newPage()
  await abrir(nuevo, './')
  await expect(h1(nuevo)).toHaveText(BIENVENIDA)
  return nuevo
}

async function elegirLaCopia(page: Page, texto: string): Promise<void> {
  const selector = page.waitForEvent('filechooser')
  await page.getByRole('button', { name: 'Elegir la copia' }).click()
  await (await selector).setFiles({
    name: 'respaldo-bodega-rosita.json',
    mimeType: 'application/json',
    buffer: Buffer.from(texto),
  })
}

test.describe('Primera vez obligatoria (RN-UX-16)', () => {
  test('sin navegación: cualquier dirección lleva a la bienvenida', async ({ page }) => {
    await abrir(page, './vender')
    await expect(h1(page)).toHaveText(BIENVENIDA)
    await expect(navegacion(page)).toHaveCount(0)
    for (const ruta of ['./', './productos', './control', './ajustes', './historial', './no-existe']) {
      await abrir(page, ruta)
      await expect(h1(page), ruta).toHaveText(BIENVENIDA)
      await expect(navegacion(page), ruta).toHaveCount(0)
    }
  })

  test('los pasos y las pantallas de cargar productos y de restaurar sí se abren', async ({
    page,
  }) => {
    for (const [ruta, titulo] of [
      ['./bienvenida?paso=productos', '¿Cómo quieres cargar tus productos?'],
      ['./productos/nuevo?desde=primera-vez', 'Producto nuevo'],
      ['./ajustes/importar?desde=primera-vez', 'Importar productos'],
      ['./ajustes/restaurar?desde=primera-vez', 'Restaurar copia'],
    ] as const) {
      await abrir(page, ruta)
      await expect(h1(page), ruta).toHaveText(titulo)
      await expect(navegacion(page), ruta).toHaveCount(0)
    }
  })

  test('si la app se cierra a medias, vuelve a la bienvenida con el nombre y la letra guardados', async ({
    page,
  }) => {
    await hacerPrimeraVezHastaCargar(page, 'Bodega Rosita', 'Muy grande')
    await abrir(page, './vender')
    await expect(h1(page)).toHaveText(BIENVENIDA)
    await expect(navegacion(page)).toHaveCount(0)
    await expect(page.locator('html')).toHaveAttribute('data-letra', 'MUY_GRANDE')
    await page.getByRole('button', { name: 'Empezar' }).click()
    await expect(page.getByLabel('Nombre de la tienda')).toHaveValue('Bodega Rosita')
  })

  test('"Más tarde" lleva al último paso y "Terminar" libera la app', async ({ page }) => {
    await hacerPrimeraVezHastaCargar(page)
    await page.getByRole('button', { name: 'Más tarde' }).click()
    await expect(h1(page)).toHaveText('Ahora contemos lo que tienes')
    // Sin productos no hay qué contar: solo "Terminar".
    await expect(page.getByRole('button', { name: 'Contar ahora' })).toHaveCount(0)
    await expect(navegacion(page)).toHaveCount(0)

    await page.getByRole('button', { name: 'Terminar' }).click()
    await expect(h1(page)).toHaveText(/^Hola, Bodega Rosita/)
    await expect(navegacion(page)).toBeVisible()
    await page.getByRole('navigation').getByRole('link', { name: /^Vender/ }).click()
    await expect(h1(page)).toHaveText('Vender')
  })

  test('la primera vez no se termina sola: el paso 5 espera la respuesta aunque se recargue', async ({
    page,
  }) => {
    await hacerPrimeraVezHastaCargar(page)
    await page.getByRole('button', { name: 'Más tarde' }).click()
    await expect(h1(page)).toHaveText('Ahora contemos lo que tienes')
    await page.reload()
    await expect(h1(page)).toHaveText('Ahora contemos lo que tienes')
    await expect(navegacion(page)).toHaveCount(0)
    await abrir(page, './')
    await expect(h1(page)).toHaveText(BIENVENIDA)
  })
})

test.describe('Restaurar una copia desde la bienvenida (RN-RE-10)', () => {
  test('con un archivo que no es una copia: se explica y "Volver" regresa a la bienvenida', async ({
    page,
  }) => {
    await abrir(page, './')
    await page.getByRole('button', { name: 'Ya tengo una copia guardada' }).click()
    await expect(h1(page)).toHaveText('Restaurar copia')
    await elegirLaCopia(page, 'esto no es una copia')
    await expect(page.getByText('Elige el archivo que guardaste con «Guardar copia»')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Restaurar esta copia' })).toHaveCount(0)

    await page.getByRole('button', { name: 'Volver' }).click()
    await expect(h1(page)).toHaveText(BIENVENIDA)
    await expect(navegacion(page)).toHaveCount(0)
    // Nada quedó hecho: la primera vez sigue pendiente.
    await abrir(page, './vender')
    await expect(h1(page)).toHaveText(BIENVENIDA)
  })

  /** Un perfil nuevo en la bienvenida, con una copia elegida y la primera confirmación a la vista. */
  async function conLaCopiaElegida(
    page: Page,
    browser: Browser,
    testInfo: TestInfo,
  ): Promise<Page> {
    const copia = await copiaDeUnaTienda(page)
    const nuevo = await otroCelularEnLaBienvenida(browser, page, testInfo)
    await nuevo.getByRole('button', { name: 'Ya tengo una copia guardada' }).click()
    await elegirLaCopia(nuevo, copia)
    await nuevo.getByRole('button', { name: 'Restaurar esta copia' }).click()
    return nuevo
  }

  async function esperarLaBienvenidaSinRestaurar(nuevo: Page): Promise<void> {
    await expect(h1(nuevo)).toHaveText(BIENVENIDA)
    await expect(navegacion(nuevo)).toHaveCount(0)
    await abrir(nuevo, './productos')
    await expect(h1(nuevo)).toHaveText(BIENVENIDA)
    await nuevo.context().close()
  }

  test('cancelar en la primera confirmación regresa a la bienvenida sin restaurar', async ({
    page,
    browser,
  }, testInfo) => {
    const nuevo = await conLaCopiaElegida(page, browser, testInfo)
    await nuevo.getByRole('button', { name: 'No, cancelar' }).click()
    await esperarLaBienvenidaSinRestaurar(nuevo)
  })

  test('cancelar en la segunda confirmación regresa a la bienvenida sin restaurar', async ({
    page,
    browser,
  }, testInfo) => {
    const nuevo = await conLaCopiaElegida(page, browser, testInfo)
    await nuevo.getByRole('button', { name: 'Sí, continuar' }).click()
    await nuevo.getByRole('button', { name: 'No, mejor no' }).click()
    await esperarLaBienvenidaSinRestaurar(nuevo)
  })
})
