// Plan 16, ítem 1: guardar una copia, perder el celular (un perfil nuevo, sin datos) y
// restaurarla: todo vuelve igual (RN-RE-01..05, RN-SIS-05).
import { readFileSync } from 'node:fs'
import { expect, test, type Page } from '@playwright/test'
import {
  abrirProducto,
  crearProductoPorPantalla,
  empezarElDia,
  h1,
  hacerPrimeraVez,
  hacerPrimeraVezHastaCargar,
  irA,
  textoVisible,
  venderPorPantalla,
} from '../utilidades/recorridos'
import { sinMenuDeCompartir } from '../utilidades/tienda'

const LEJIA = 'Lejía Tradicional 1 L'

interface LoQueSeVe {
  inicio: string
  productos: string
  fotos: number
  detalle: string
  historial: string
  control: string
  letra: string | null
}

/** Lo que la persona ve en cada pantalla (para comparar antes y después de restaurar). */
async function loQueSeVe(page: Page): Promise<LoQueSeVe> {
  await irA(page, 'Inicio')
  const inicio = await textoVisible(page, '#contenido .tarjeta-de-cifra')
  const letra = await page.locator('html').getAttribute('data-letra')
  await irA(page, 'Productos')
  const lista = page.getByRole('list', { name: 'Productos' })
  await expect(lista.locator('img[src^="blob:"]').first()).toBeVisible()
  const productos = (await lista.innerText()).replace(/\s+/g, ' ').trim()
  const fotos = await lista.locator('img[src^="blob:"]').count()
  await abrirProducto(page, 'lejia', LEJIA)
  const detalle = await textoVisible(page, '#contenido')
  await irA(page, 'Inicio')
  await page.getByRole('link', { name: /^Historial/ }).click()
  await expect(h1(page)).toHaveText('Historial')
  const historial = await textoVisible(page, '#contenido')
  await irA(page, 'Control')
  await expect(page.getByRole('heading', { level: 2, name: 'Productos parados' })).toBeVisible()
  const control = await textoVisible(page, '#contenido')
  return { inicio, productos, fotos, detalle, historial, control, letra }
}

test.describe('Recorrido: guardar y restaurar una copia', () => {
  test('la copia de un celular se restaura en otro sin datos y todo vuelve igual', async ({
    page,
    browser,
  }, testInfo) => {
    test.setTimeout(90_000)
    await sinMenuDeCompartir(page)
    await empezarElDia(page)
    await hacerPrimeraVezHastaCargar(page, 'Bodega Rosita', 'Muy grande')
    await page.getByRole('button', { name: 'Dejar para después' }).click()
    await crearProductoPorPantalla(page, {
      nombre: LEJIA,
      categoria: 'Lejías y desinfectantes',
      compra: '2.40',
      venta: '3.50',
      minimo: '3',
      stock: '10',
      conFoto: true,
    })
    await crearProductoPorPantalla(page, {
      nombre: 'Jabón Bolívar',
      compra: '1.20',
      venta: '2.00',
      minimo: '4',
      stock: '6',
    })
    await irA(page, 'Vender')
    await venderPorPantalla(
      page,
      [
        { buscado: 'lejia', nombre: LEJIA, cantidad: 2 },
        { buscado: 'jabon', nombre: 'Jabón Bolívar', cantidad: 3 },
      ],
      'S/ 20',
      'S/ 13.00',
    )
    const antes = await loQueSeVe(page)
    // Lo que se compara después es lo de verdad: 2 Lejía (gana 2.20) y 3 Jabón (gana 2.40).
    expect(antes.inicio).toBe('Hoy ganaste S/ 4.60 Vendiste S/ 13.00')
    expect(antes.letra).toBe('MUY_GRANDE')

    // Guardar copia (Inicio → Ajustes → Guardar copia): sale del celular como archivo.
    await irA(page, 'Inicio')
    await page.getByRole('link', { name: 'Ajustes' }).click()
    await page.getByRole('link', { name: /^Guardar copia/ }).click()
    await expect(h1(page)).toHaveText('Guardar copia')
    const descarga = page.waitForEvent('download')
    await page.getByRole('button', { name: 'Guardar copia ahora' }).click()
    const archivo = await descarga
    const ruta = testInfo.outputPath(archivo.suggestedFilename())
    await archivo.saveAs(ruta)
    await expect(h1(page)).toHaveText('Copia guardada')

    // Otro celular: un perfil nuevo, sin nada guardado.
    const otroCelular = await browser.newContext({
      viewport: page.viewportSize(),
      isMobile: testInfo.project.use.isMobile,
      hasTouch: testInfo.project.use.hasTouch,
      userAgent: await page.evaluate(() => navigator.userAgent),
      locale: 'es-PE',
      timezoneId: 'America/Lima',
      baseURL: testInfo.project.use.baseURL,
    })
    const nuevo = await otroCelular.newPage()
    await empezarElDia(nuevo)
    await hacerPrimeraVez(nuevo, 'Mi tienda')
    await expect(nuevo.getByText('Aún no tienes productos')).toBeVisible()

    await nuevo.getByRole('link', { name: 'Ajustes' }).click()
    await nuevo.getByRole('link', { name: /^Restaurar copia/ }).click()
    const selector = nuevo.waitForEvent('filechooser')
    await nuevo.getByRole('button', { name: 'Elegir la copia' }).click()
    await (await selector).setFiles({
      name: archivo.suggestedFilename(),
      mimeType: 'application/json',
      buffer: readFileSync(ruta),
    })
    await expect(
      nuevo.getByText(/^2 productos, \d+ movimientos, del \d{2}\/\d{2}\/\d{4} al \d{2}\/\d{2}\/\d{4}$/),
    ).toBeVisible()
    await nuevo.getByRole('button', { name: 'Restaurar esta copia' }).click()
    await nuevo.getByRole('button', { name: 'Sí, continuar' }).click()
    await nuevo.getByRole('button', { name: 'Sí, restaurar' }).click()
    await expect(h1(nuevo)).toHaveText('Copia restaurada')
    await nuevo.getByRole('button', { name: 'Ir al inicio' }).click()
    await expect(h1(nuevo)).toHaveText(/^Hola, Bodega Rosita/)

    expect(await loQueSeVe(nuevo)).toEqual(antes)
    await otroCelular.close()
  })
})
