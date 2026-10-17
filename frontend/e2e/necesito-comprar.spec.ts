import { expect, test, type Page } from '@playwright/test'
import {
  esperarSinDesplazamientoHorizontal,
  esperarSinViolacionesGraves,
} from './utilidades/calidad'
import {
  esperarObjetivosTactiles,
  palabrasPartidas,
  prepararTienda,
  textoDe,
  type ProductoParaPrueba,
} from './utilidades/control'
import { abrir, usarLetra } from './utilidades/navegacion'

/** Plan 13: ¿Necesito comprar? (RN-AN-16), pensado para usarse en el mercado. */

const PRODUCTOS: ProductoParaPrueba[] = [
  // Queda poco (2 de 3) y sin historia: entra en Para comprar con 2 × 3 − 2 = 4.
  {
    nombre: 'Lejía Tradicional 1 L',
    categoria: 'Lejías y desinfectantes',
    compra: '2.40',
    venta: '3.50',
    minimo: '3',
    stockInicial: '2',
  },
  {
    nombre: 'Lavavajillas Ayudín 500 g',
    categoria: 'Lavavajillas',
    compra: '3.10',
    venta: '4.50',
    minimo: '2',
    stockInicial: '12',
  },
]

/** Abre Inicio con la tienda lista (la primera vez completa). */
async function abrirInicio(page: Page): Promise<void> {
  await abrir(page, './')
  await prepararTienda(page, PRODUCTOS)
  await page.getByRole('link', { name: 'Inicio' }).click()
  await expect(page.locator('[data-app-montada] #contenido h1')).toBeVisible()
}

/** Desde Inicio: su botón ¿Necesito comprar? (plan 14) → buscar → tocar el producto. */
async function preguntarDesdeInicio(page: Page, buscado: string, producto: string): Promise<void> {
  await page.getByRole('button', { name: '¿Necesito comprar?' }).click()
  await page.getByLabel('¿Qué producto quieres comprar?').fill(buscado)
  await page.getByRole('button', { name: new RegExp(producto) }).click()
}

test.describe('¿Necesito comprar?', () => {
  test('criterio de éxito 6: desde Inicio, la respuesta en menos de 10 s', async ({ page }) => {
    await abrirInicio(page)
    const inicio = Date.now()
    await preguntarDesdeInicio(page, 'lej', 'Lejía Tradicional 1 L')
    const respuesta = page.locator('.respuesta-grande')
    await expect(respuesta).toBeVisible()
    const segundos = (Date.now() - inicio) / 1000
    expect(segundos, 'respuesta en menos de 10 s').toBeLessThan(10)

    expect(await textoDe(respuesta)).toBe('Sí, compra ~4 unid. (S/ 9.60)')
    await expect(
      page.getByRole('heading', { level: 2, name: 'Lejía Tradicional 1 L' }),
    ).toBeFocused()
    expect(await textoDe(page.locator('.respuesta .fila-de-dato').first())).toBe('Tienes 2 unid.')
  })

  test('RN-AN-16: sin historia todavía no sabe cuánto se vende, y lo dice', async ({ page }) => {
    await abrirInicio(page)
    await preguntarDesdeInicio(page, 'ayudin', 'Lavavajillas Ayudín 500 g')
    expect(await textoDe(page.locator('.respuesta-grande'))).toBe(
      'Tienes 12 unid. Todavía no sé cuánto vendes; vuelve a preguntar en unos días',
    )
  })

  for (const ancho of [320, 360, 768, 1280]) {
    test(`RN-UX-09 / RN-SIS-07, ${ancho} px con letra Muy grande: nada se sale, ninguna palabra se parte y axe no encuentra violaciones graves`, async ({
      page,
    }) => {
      await usarLetra(page, 'MUY_GRANDE')
      await page.setViewportSize({ width: ancho, height: 800 })
      await abrirInicio(page)
      await preguntarDesdeInicio(page, 'lej', 'Lejía Tradicional 1 L')
      await expect(page.locator('.respuesta-grande')).toBeVisible()
      await esperarSinDesplazamientoHorizontal(page)
      expect(await palabrasPartidas(page.locator('#contenido'))).toEqual([])
      await esperarObjetivosTactiles(page.locator('#contenido'))
      await esperarSinViolacionesGraves(page)

      // Con resultados a la vista (otra búsqueda), también.
      await page.getByLabel('¿Qué producto quieres comprar?').fill('a')
      await expect(page.locator('.tarjeta-de-producto').first()).toBeVisible()
      await esperarSinDesplazamientoHorizontal(page)
      await esperarObjetivosTactiles(page.locator('#contenido'))
      await esperarSinViolacionesGraves(page)
    })
  }
})
