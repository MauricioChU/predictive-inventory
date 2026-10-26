// Plan 16, ítem 1: un día de tienda entero, tocando la pantalla (RN-SIS-05). Las cuentas:
//   Lejía Tradicional 1 L  compra 2.40 · venta 3.50 · mínimo 3 · stock 10
//   Jabón Bolívar          compra 1.20 · venta 2.00 · mínimo 4 · stock 6
//   1. Venta: 2 Lejía = S/ 7.00 (gana 2.20).
//   2. Venta: 3 Jabón + 1 Lejía = S/ 9.50 (gana 3.50).
//   3. Venta: 1 Lejía, y se deshace (no cuenta).
//   4. Para comprar sugiere 5 Jabón (sin historia: 2 × 4 − 3); llegan a S/ 1.30 (precio nuevo).
//   5. Se derrama 1 Lejía: pérdida S/ 2.40.  6. Se cuentan 7 Jabón (había 8): −S/ 1.30 aparte. Al final quedan 7 Lejía y 9 Jabón.
//   7. Venta: 1 Jabón = S/ 2.00 (gana 0.70 con el costo nuevo), exacto.
//   Hoy: vendiste S/ 18.50, ganaste 6.40 − 2.40 = S/ 4.00. Anular la venta 2: S/ 9.00 y S/ 0.50.
import { expect, test, type Page } from '@playwright/test'
import {
  abrirDetalleDeVenta,
  abrirProducto,
  comoSeLee,
  crearProductoPorPantalla,
  empezarElDia,
  esperarTexto,
  exactoComoSeLee,
  h1,
  hacerPrimeraVez,
  irA,
  lineaDelCarrito,
  nuevaVenta,
  venderPorPantalla,
} from '../utilidades/recorridos'
import { anotarTextosVistos, esperarSinPalabrasQueEvitar } from '../utilidades/textos'

const LEJIA = 'Lejía Tradicional 1 L'
const JABON = 'Jabón Bolívar'

/** Inicio dice exactamente estas cifras de hoy (RN-AN-03). */
async function esperarCifrasDeInicio(page: Page, cifras: string): Promise<void> {
  await irA(page, 'Inicio')
  await esperarTexto(page.locator('#contenido .cifras-de-hoy'), cifras)
}

/** El resumen de Control (Hoy) dice exactamente estas cifras. */
async function esperarCifrasDeControl(page: Page, cifras: string): Promise<void> {
  await irA(page, 'Control')
  await esperarTexto(page.locator('#contenido section .cifras-principales'), cifras)
}

/** El detalle del producto dice cuánto hay ("Tienes 7 unid."). */
async function esperarStockEnElDetalle(
  page: Page,
  buscado: string,
  nombre: string,
  stock: string,
): Promise<void> {
  await abrirProducto(page, buscado, nombre)
  await expect(page.locator('#contenido')).toContainText(comoSeLee(stock))
}

test.describe('Recorrido: un día de tienda', () => {
  test('ventas con panel de venta y Deshacer, llegada desde Para comprar, pérdida, conteo; Inicio, Control e Historial cuadran', async ({
    page,
  }) => {
    test.setTimeout(90_000)
    await anotarTextosVistos(page)
    await empezarElDia(page)
    await hacerPrimeraVez(page)
    await crearProductoPorPantalla(page, {
      nombre: LEJIA,
      categoria: 'Lejías y desinfectantes',
      compra: '2.40',
      venta: '3.50',
      minimo: '3',
      stock: '10',
    })
    await crearProductoPorPantalla(page, {
      nombre: JABON,
      categoria: 'Detergentes y jabones',
      compra: '1.20',
      venta: '2.00',
      minimo: '4',
      stock: '6',
    })

    await test.step('1–2. Dos ventas con el panel de venta', async () => {
      await irA(page, 'Inicio')
      await page.getByRole('button', { name: 'Vender' }).click()
      await venderPorPantalla(
        page,
        [{ buscado: 'lejia', nombre: LEJIA, cantidad: 2 }],
        'S/ 7.00',
      )
      await nuevaVenta(page)
      await venderPorPantalla(
        page,
        [
          { buscado: 'jabon', nombre: JABON, cantidad: 3 },
          { buscado: 'lejia', nombre: LEJIA, cantidad: 1 },
        ],
        'S/ 9.50',
      )
      await nuevaVenta(page)
    })

    await test.step('3. Una venta que se deshace (RN-OP-18)', async () => {
      await venderPorPantalla(page, [{ buscado: 'lejia', nombre: LEJIA, cantidad: 1 }], 'S/ 3.50')
      await page.getByRole('button', { name: /^Deshacer/ }).click()
      await expect(page.locator('.resultado-de-deshacer')).toContainText(
        comoSeLee('Deshiciste la venta de S/ 3.50. Tus productos volvieron al carrito.'),
      )
      // Vuelve al carrito para corregirla; aquí no se vende.
      await abrirDetalleDeVenta(page)
      await page.getByRole('button', { name: `Quitar ${LEJIA}` }).click()
      await expect(lineaDelCarrito(page, LEJIA)).toHaveCount(0)
      await esperarCifrasDeInicio(page, 'Total vendido S/ 16.50 Ganancia real S/ 5.70')
    })

    await test.step('4. Para comprar → Registrar llegada, con un precio nuevo (RN-AN-08, RN-OP-14)', async () => {
      // El aviso de Inicio lleva a Productos ya filtrado (RN-AL-06a, RN-CAT-16); Para comprar
      // se abre desde Control → Ayuda inteligente.
      await expect(page.getByText('Queda poco: 1', { exact: true })).toBeVisible()
      await page.getByRole('button', { name: 'Queda poco de 1 producto. Ver productos' }).click()
      await expect(h1(page)).toHaveText('Productos')
      await expect(page).toHaveURL(/\/productos\?estado=queda-poco$/)
      await irA(page, 'Control')
      await page.getByRole('link', { name: /^Ayuda inteligente/ }).click()
      await page.getByRole('button', { name: 'Ver la lista para comprar' }).click()
      await expect(h1(page)).toHaveText('Para comprar')
      const linea = page.locator('#contenido').getByRole('group', { name: JABON })
      await expect(linea.getByLabel(/^Cantidad/)).toHaveValue('5')
      await esperarTexto(page.locator('#contenido .barra-de-total .total'), 'S/ 6.00')

      await page.getByRole('button', { name: 'Registrar llegada' }).click()
      await expect(h1(page)).toHaveText('Llegó mercadería')
      await expect(page.getByText('Cargamos tu lista para comprar de hoy')).toBeVisible()
      await abrirDetalleDeVenta(page)
      const llegada = lineaDelCarrito(page, JABON)
      await expect(llegada.getByLabel('Cantidad (unid.)')).toHaveValue('5')
      await llegada.getByRole('button', { name: `Cambiar costo de ${JABON}` }).click()
      await llegada.getByLabel('Nuevo costo en S/').fill('1.30')
      await llegada.getByRole('button', { name: 'Guardar costo' }).click()
      await page.getByRole('button', { name: 'Registrar llegada' }).click()
      const dialogo = page.getByRole('dialog')
      await expect(dialogo).toContainText(
        comoSeLee('¿Actualizar el precio de compra a S/ 1.30? Ganarás S/ 0.70 por unidad'),
      )
      await dialogo.getByRole('button', { name: 'Sí, actualizar' }).click()
      await expect(h1(page)).toHaveText('Llegada registrada')
      await esperarStockEnElDetalle(page, 'jabon', JABON, 'Tienes 8 unid.')
      await expect(page.locator('#contenido')).toContainText(comoSeLee('S/ 1.30'))
    })

    await test.step('5–6. Una pérdida y un conteo (RN-OP-15, RN-OP-16)', async () => {
      await abrirProducto(page, 'lejia', LEJIA)
      await page.getByRole('button', { name: 'Registrar pérdida' }).click()
      await expect(h1(page)).toHaveText('Registrar pérdida')
      await page.getByRole('radio', { name: 'Se derramó' }).click()
      await page.getByLabel('Cantidad (unid.)').fill('1')
      await page.getByRole('button', { name: 'Guardar' }).click()
      await expect(h1(page)).toHaveText('Lo anotamos')
      await expect(page.getByText(comoSeLee('Ahora hay 6 unid.'))).toBeVisible()

      await abrirProducto(page, 'jabon', JABON)
      await page.getByRole('button', { name: 'Contar stock' }).click()
      await expect(h1(page)).toHaveText('Contar stock')
      await page.getByLabel('¿Cuántos hay? (unid.)').fill('7')
      await page.getByRole('button', { name: 'Guardar conteo' }).click()
      await expect(h1(page)).toHaveText('Stock corregido')
      await expect(page.getByText(comoSeLee(`${JABON}: ahora hay 7 unid. (1 unid. menos)`))).toBeVisible()
    })

    await test.step('7. Una venta con el costo nuevo; Inicio y Control cuadran (RN-AN-02/03)', async () => {
      await irA(page, 'Vender')
      await venderPorPantalla(page, [{ buscado: 'jabon', nombre: JABON, cantidad: 1 }], 'S/ 2.00')
      await esperarCifrasDeInicio(page, 'Total vendido S/ 18.50 Ganancia real S/ 4.00')

      await esperarCifrasDeControl(page, 'Total vendido S/ 18.50 Ganancia real S/ 4.00')
      const resumen = page.getByRole('region', { name: 'Resumen', exact: true })
      await expect(resumen.locator('.fila-de-dato')).toHaveText(
        [
          'Costo de lo vendido S/ 12.10',
          'Pérdidas S/ 2.40',
          'Diferencias de conteo -S/ 1.30',
        ].map(exactoComoSeLee),
        { useInnerText: true },
      )
      // Lo que más se vende: Lejía y Jabón en 2 ventas cada uno; Lejía vendió más en soles.
      const masVendidos = page.getByRole('region', { name: 'Tus mejores productos', exact: true })
      await expect(masVendidos.locator('ol').first().locator('li').first()).toContainText(LEJIA)
    })

    await test.step('Movimientos lo lista todo, y anular la venta 2 deja el stock bien (RN-OP-17)', async () => {
      await irA(page, 'Inicio')
      await page.getByRole('button', { name: /^Movimientos/ }).click()
      await expect(page.getByRole('heading', { name: 'Movimientos', level: 2 })).toBeVisible()
      await expect(page.locator('#contenido .operacion .tipo')).toHaveText([
        'Venta',
        'Conteo de stock',
        'Se derramó',
        'Llegó mercadería',
        'Anulado',
        'Venta',
        'Venta',
        'Venta',
        'Stock inicial',
        'Stock inicial',
      ])
      await expect(page.locator('#contenido .operacion').filter({ hasText: 'Anulada' })).toHaveCount(1)

      await page.locator('#contenido .operacion').filter({ hasText: '9.50' }).click()
      await expect(h1(page)).toHaveText('Venta')
      await page.getByRole('button', { name: 'Anular' }).click()
      await expect(page.getByRole('dialog')).toContainText('¿Anular esta venta?')
      await page.getByRole('button', { name: 'Sí, anular' }).click()
      await expect(h1(page)).toHaveText('Operación anulada')
      // Se llegó desde la hoja Movimientos: el botón vuelve a ella.
      await expect(page.getByRole('button', { name: 'Volver a Movimientos' })).toBeVisible()

      await esperarStockEnElDetalle(page, 'lejia', LEJIA, 'Tienes 7 unid.')
      await esperarStockEnElDetalle(page, 'jabon', JABON, 'Tienes 9 unid.')
      await esperarCifrasDeInicio(page, 'Total vendido S/ 9.00 Ganancia real S/ 0.50')
      await esperarCifrasDeControl(page, 'Total vendido S/ 9.00 Ganancia real S/ 0.50')
    })

    // Plan 16, ítem 5: nada de lo que se vio en el día usa palabras que la guía manda evitar.
    await esperarSinPalabrasQueEvitar(page)
  })
})
