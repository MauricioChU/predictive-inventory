import { expect, test, type Page } from '@playwright/test'
import {
  esperarSinDesplazamientoHorizontal,
  esperarSinViolacionesGraves,
} from './utilidades/calidad'
import {
  esperarObjetivosTactiles,
  hoyEnLaTienda,
  palabrasPartidas,
  prepararTienda,
  textoDe,
  type ProductoParaPrueba,
} from './utilidades/control'
import { abrir, usarLetra } from './utilidades/navegacion'

/** Plan 13: Para comprar → Compartir → Registrar llegada (RN-AN-08). */

/** Sin historia (sin predicción): Bolsas agotadas (10), Carbón 1 de 3 kg (5 kg), Jabón 2 de 4 (6). */
const PRODUCTOS: ProductoParaPrueba[] = [
  {
    nombre: 'Bolsas de basura x10',
    categoria: 'Bolsas',
    compra: '1.50',
    venta: '2.50',
    minimo: '5',
  },
  {
    nombre: 'Carbón',
    categoria: 'Carbón y combustibles',
    unidad: 'KILO',
    compra: '2.75',
    venta: '4.00',
    minimo: '3',
    stockInicial: '1',
  },
  {
    nombre: 'Jabón Bolívar',
    categoria: 'Detergentes y jabones',
    compra: '1.20',
    venta: '2.00',
    minimo: '4',
    stockInicial: '2',
  },
]

/** El texto de la lista con Jabón cambiado a 12 (spec 04, "Formato del texto compartido"). */
function textoEsperado(): string {
  return [
    `Lista de compras – Bodega Rosita – ${hoyEnLaTienda()}`,
    '• Bolsas de basura x10: 10 unid.',
    '• Carbón: 5 kg',
    '• Jabón Bolívar: 12 unid.',
    'Total estimado: S/ 43.15',
  ].join('\n')
}

type VentanaConCompartidos = Window & { __compartidos?: string[] }

/** Web Share API de mentira: guarda lo que se compartió (la hoja del celular no se puede tocar). */
async function simularWebShare(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const ventana = window as VentanaConCompartidos
    ventana.__compartidos = []
    Object.defineProperty(navigator, 'share', {
      configurable: true,
      value: async (datos: ShareData) => {
        ventana.__compartidos!.push(datos.text ?? '')
      },
    })
    Object.defineProperty(navigator, 'canShare', { configurable: true, value: () => true })
  })
}

/** Un navegador sin Web Share API (como Chrome en una PC con Linux). */
async function sinWebShare(page: Page): Promise<void> {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'share', { configurable: true, value: undefined })
  })
}

/** Abre la app en Inicio, deja la tienda lista y entra a Para comprar desde Control (que se
 * monta recién ahí, ya con los productos). */
async function abrirParaComprar(page: Page): Promise<void> {
  await abrir(page, './')
  await prepararTienda(page, PRODUCTOS)
  await page.getByRole('link', { name: 'Control' }).click()
  await page.getByRole('button', { name: 'Ver la lista para comprar' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Para comprar' })).toBeVisible()
}

async function cambiarCantidad(page: Page, producto: string, cantidad: string): Promise<void> {
  const linea = page.getByRole('group', { name: producto })
  await linea.getByRole('textbox', { name: /Cantidad/ }).fill(cantidad)
}

test.describe('Para comprar', () => {
  test('RN-AN-08: cambiar una cantidad, compartir la lista y registrar la llegada', async ({
    page,
  }) => {
    await simularWebShare(page)
    await abrirParaComprar(page)
    await expect(page.locator('.fila-de-carrito .nombre')).toHaveText([
      'Bolsas de basura x10',
      'Carbón',
      'Jabón Bolívar',
    ])
    expect(await textoDe(page.locator('.barra-de-total .resumen'))).toBe('Total estimado S/ 35.95')

    await cambiarCantidad(page, 'Jabón Bolívar', '12')
    await expect(page.locator('.barra-de-total .resumen')).toContainText('43.15')

    await page.getByRole('button', { name: 'Compartir' }).click()
    await expect
      .poll(() => page.evaluate(() => (window as VentanaConCompartidos).__compartidos))
      .toEqual([textoEsperado()])

    await page.getByRole('button', { name: 'Registrar llegada' }).click()
    // Recibir (rama 12) se abre prellenado leyendo la lista de hoy: no viaja nada por la ruta.
    await expect(page).toHaveURL(/\/recibir\?desde=para-comprar$/)
    await expect(page.locator('[data-app-montada] #contenido h1')).toBeVisible()
    const llegada = await page.evaluate(async () => {
      const app = (
        window as Window & {
          __aplicacion?: {
            analisis: {
              lineasParaRegistrarLlegada(): Promise<{ cantidad: { milesimas: number } }[]>
            }
          }
        }
      ).__aplicacion
      return (await app!.analisis.lineasParaRegistrarLlegada()).map((l) => l.cantidad.milesimas)
    })
    expect(llegada).toEqual([10_000, 5_000, 12_000])
  })

  test('sin Web Share API, Compartir copia la lista para pegarla en WhatsApp', async ({
    page,
    context,
  }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write'])
    await sinWebShare(page)
    await abrirParaComprar(page)
    await cambiarCantidad(page, 'Jabón Bolívar', '12')
    await page.getByRole('button', { name: 'Compartir' }).click()
    await expect(page.getByText('Copiamos la lista')).toBeVisible()
    // En Windows el portapapeles devuelve cada salto de línea como CR LF.
    const copiado = await page.evaluate(() => navigator.clipboard.readText())
    expect(copiado.replace(/\r\n/g, '\n')).toBe(textoEsperado())
  })

  for (const ancho of [320, 360, 768, 1280]) {
    test(`RN-UX-09 / RN-SIS-07, ${ancho} px con letra Muy grande: nada se sale, ninguna palabra se parte y axe no encuentra violaciones graves`, async ({
      page,
    }) => {
      await usarLetra(page, 'MUY_GRANDE')
      await page.setViewportSize({ width: ancho, height: 800 })
      await abrirParaComprar(page)
      await esperarSinDesplazamientoHorizontal(page)
      expect(await palabrasPartidas(page.locator('#contenido'))).toEqual([])
      await esperarObjetivosTactiles(page.locator('#contenido'))
      await esperarSinViolacionesGraves(page)
    })
  }
})
