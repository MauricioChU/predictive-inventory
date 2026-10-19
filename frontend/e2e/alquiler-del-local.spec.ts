import { expect, test, type Page } from '@playwright/test'
import {
  esperarSinDesplazamientoHorizontal,
  esperarSinViolacionesGraves,
  usarLetra,
} from './utilidades/calidad'
import { palabrasPartidas, soles, textoDe } from './utilidades/control'
import { abrirTiendaLista, crearProducto, esperarObjetivosTactiles, vender } from './utilidades/tienda'

/**
 * RN-AN-17 / RN-AN-19: el alquiler del local se configura desde Control, la tarjeta muestra el
 * avance con una venta sembrada y, al cambiar a "No pago", la tarjeta desaparece.
 */

const h1 = (page: Page) => page.getByRole('heading', { level: 1 })
const tarjeta = (page: Page) => page.getByRole('region', { name: 'Alquiler del local', exact: true })

/** Una venta de hoy que deja S/ 200.00 de ganancia (100 de S/ 5.00 que costaron S/ 3.00). */
async function sembrarUnaVenta(page: Page): Promise<void> {
  const id = await crearProducto(page, {
    nombre: 'Cera líquida',
    compra: '3.00',
    venta: '5.00',
    stock: '200',
  })
  await vender(page, id, '100')
}

test.describe('Alquiler del local', () => {
  test.setTimeout(60_000)

  test('se configura desde Control, la tarjeta muestra el avance y "No pago" la quita', async ({
    page,
  }) => {
    await abrirTiendaLista(page, './')
    await sembrarUnaVenta(page)
    await page.goto('./control')

    // Sin configurar, la tarjeta pregunta.
    await expect(tarjeta(page)).toContainText('¿Pagas alquiler por tu local?')
    await tarjeta(page).getByRole('button', { name: 'Configurar' }).click()
    await expect(h1(page)).toHaveText('Alquiler del local')

    // Una vez al mes, S/ 1 000.00 cada 28.
    await page.getByRole('radio', { name: 'Una vez al mes' }).click()
    await page.getByLabel('¿Cuánto pagas cada vez? (S/)').fill('1000')
    await page.getByLabel('¿Qué día pagas?').selectOption('28')
    await page.getByRole('button', { name: 'Guardar' }).click()
    await expect(h1(page)).toHaveText('Listo, guardamos el alquiler del local')
    await page.getByRole('button', { name: 'Volver' }).click()

    // De vuelta en Control: lo que llevas ganado contra el pago.
    await expect(h1(page)).toHaveText('Control')
    const lineas = tarjeta(page).locator('.linea')
    expect(await textoDe(lineas.nth(0))).toMatch(
      new RegExp(`^Para el pago del \\d{2}/\\d{2} llevas ${soles(20000)} de ${soles(100000)}$`),
    )
    expect(await textoDe(lineas.nth(1))).toBe(`Te falta ${soles(80000)}`)
    const barra = tarjeta(page).getByRole('progressbar')
    await expect(barra).toHaveAttribute('aria-valuenow', '20')
    await expect(barra).toHaveAttribute('aria-valuetext', '20 %')

    // Cambiar: la pantalla trae lo guardado y "No pago" hace desaparecer la tarjeta.
    await tarjeta(page).getByRole('link', { name: 'Cambiar' }).click()
    await expect(h1(page)).toHaveText('Alquiler del local')
    await expect(page.getByRole('radio', { name: 'Una vez al mes' })).toHaveAttribute(
      'aria-checked',
      'true',
    )
    await expect(page.getByLabel('¿Cuánto pagas cada vez? (S/)')).toHaveValue('1000.00')
    await expect(page.getByLabel('¿Qué día pagas?')).toHaveValue('28')
    await page.getByRole('radio', { name: 'No pago, el local es mío' }).click()
    await expect(page.getByLabel('¿Cuánto pagas cada vez? (S/)')).toHaveCount(0)
    await page.getByRole('button', { name: 'Guardar' }).click()
    await expect(h1(page)).toHaveText('Listo, guardamos el alquiler del local')
    await page.getByRole('button', { name: 'Volver' }).click()

    await expect(h1(page)).toHaveText('Control')
    await expect(page.getByRole('heading', { level: 2, name: 'Resumen' })).toBeVisible()
    await expect(tarjeta(page)).toHaveCount(0)
  })

  test('se abre también desde Datos de la tienda y vuelve a ella', async ({ page }) => {
    await abrirTiendaLista(page, './ajustes/tienda')
    await expect(page.getByRole('link', { name: /Alquiler del local/ })).toContainText(
      'Sin configurar',
    )
    await page.getByRole('link', { name: /Alquiler del local/ }).click()
    await expect(h1(page)).toHaveText('Alquiler del local')

    await page.getByRole('radio', { name: 'Dos veces al mes' }).click()
    await page.getByLabel('¿Cuánto pagas cada vez? (S/)').fill('300.50')
    await page.getByLabel('Primer día de pago').selectOption('20')
    await page.getByLabel('Segundo día de pago').selectOption('5')
    await page.getByRole('button', { name: 'Guardar' }).click()
    await page.getByRole('button', { name: 'Volver' }).click()

    await expect(h1(page)).toHaveText('Datos de la tienda')
    expect(await textoDe(page.getByRole('link', { name: /Alquiler del local/ }))).toContain(
      `${soles(30050)} · días 5 y 20`,
    )
  })

  test('los dos días iguales muestran el error junto al selector y no guardan', async ({
    page,
  }) => {
    await abrirTiendaLista(page, './control/alquiler')
    await page.getByRole('radio', { name: 'Dos veces al mes' }).click()
    await page.getByLabel('¿Cuánto pagas cada vez? (S/)').fill('300')
    await page.getByLabel('Primer día de pago').selectOption('10')
    await page.getByLabel('Segundo día de pago').selectOption('10')
    await page.getByRole('button', { name: 'Guardar' }).click()
    await expect(page.getByRole('alert').filter({ hasText: 'Elige dos días distintos' })).toBeVisible()
    await expect(h1(page)).toHaveText('Alquiler del local')
  })

  for (const ancho of [320, 360, 768]) {
    test(`RN-UX-09, ${ancho} px con letra Muy grande: la tarjeta y la pantalla caben, sin palabras partidas, con botones grandes`, async ({
      page,
    }) => {
      await usarLetra(page, 'MUY_GRANDE')
      await page.setViewportSize({ width: ancho, height: 800 })
      await abrirTiendaLista(page, './')
      await sembrarUnaVenta(page)
      await page.evaluate(async () => {
        const app = (
          window as Window & {
            __aplicacion?: {
              tienda: { actualizarConfiguracion(c: Record<string, unknown>): Promise<void> }
            }
          }
        ).__aplicacion
        await app!.tienda.actualizarConfiguracion({
          alquilerDelLocal: { tipo: 'QUINCENAL', montoCentimos: 123456, dias: [5, 20] },
        })
      })

      await page.goto('./control')
      await expect(tarjeta(page)).toBeVisible()
      await esperarSinDesplazamientoHorizontal(page)
      expect(await palabrasPartidas(page.locator('#contenido'))).toEqual([])
      await esperarSinViolacionesGraves(page)

      await tarjeta(page).getByRole('link', { name: 'Cambiar' }).click()
      await expect(h1(page)).toHaveText('Alquiler del local')
      await expect(page.getByLabel('Segundo día de pago')).toBeVisible()
      await esperarSinDesplazamientoHorizontal(page)
      expect(await palabrasPartidas(page.locator('#contenido'))).toEqual([])
      await esperarObjetivosTactiles(page)
      await esperarSinViolacionesGraves(page)
    })
  }
})
