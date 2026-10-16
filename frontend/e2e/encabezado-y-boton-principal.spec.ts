import { expect, test, type Locator, type Page } from '@playwright/test'
import { esperarSinDesplazamientoHorizontal } from './utilidades/calidad'
import { abrir, usarLetra } from './utilidades/navegacion'

/**
 * Plan 13 (Ola 4): a 320 px con letra Muy grande,
 * - EncabezadoPagina con "Volver" y un título largo encogía el botón hasta una letra por línea
 *   ("V|o|l|v|e|r");
 * - BotonPrincipal, con su relleno de 1.5rem por lado, no dejaba lugar a una palabra larga y la
 *   partía ("Compa|rtir" en la barra del total de Para comprar).
 * Se prueban con los textos más largos de las pantallas de la Ola 4, puestos en los componentes
 * que ya existen (el encabezado de Historial y la barra del total del catálogo del kit A).
 */

type VentanaConGanchos = Window & {
  __pruebas?: { mostrarCatalogo: (kit: 'productos') => Promise<void> }
}

/** Las palabras del texto de `locator` que quedaron partidas entre dos líneas. */
async function palabrasPartidas(locator: Locator): Promise<string[]> {
  return locator.evaluate((elemento) => {
    const partidas: string[] = []
    const textos = document.createTreeWalker(elemento, NodeFilter.SHOW_TEXT)
    for (let nodo = textos.nextNode(); nodo; nodo = textos.nextNode()) {
      let inicio = 0
      for (const palabra of (nodo.textContent ?? '').split(' ')) {
        if (palabra.trim() !== '') {
          const rango = document.createRange()
          rango.setStart(nodo, inicio)
          rango.setEnd(nodo, inicio + palabra.length)
          const lineas = new Set([...rango.getClientRects()].map((r) => Math.round(r.top)))
          if (lineas.size > 1) partidas.push(palabra.trim())
        }
        inicio += palabra.length + 1
      }
    }
    return partidas
  })
}

async function abrirAngosto(page: Page, ruta: string): Promise<void> {
  await usarLetra(page, 'MUY_GRANDE')
  await page.setViewportSize({ width: 320, height: 740 })
  await abrir(page, ruta)
}

test.describe('Componentes base a 320 px con letra Muy grande', () => {
  test('EncabezadoPagina: "Volver" nunca se parte; un título largo baja a su propia línea', async ({
    page,
  }) => {
    await abrirAngosto(page, './historial')
    const titulo = page.locator('.encabezado-pagina h1')
    await titulo.evaluate((h1) => {
      h1.textContent = '¿Necesito comprar?'
    })
    const volver = page.getByRole('button', { name: 'Volver' })
    expect(await palabrasPartidas(volver)).toEqual([])
    const caja = (await volver.boundingBox())!
    expect(caja.height).toBeGreaterThanOrEqual(48)
    expect(caja.width).toBeGreaterThanOrEqual(48)
    expect(await palabrasPartidas(titulo)).toEqual([])
    await esperarSinDesplazamientoHorizontal(page)
  })

  test('BotonPrincipal: una palabra larga ("Compartir") entra entera en la barra del total', async ({
    page,
  }) => {
    await abrirAngosto(page, './historial')
    await page.evaluate(async () => {
      const ganchos = (window as VentanaConGanchos).__pruebas
      if (!ganchos) throw new Error('La app no expuso window.__pruebas')
      await ganchos.mostrarCatalogo('productos')
    })
    const boton = page.locator('.barra-de-total .boton-principal')
    await expect(boton).toBeVisible()
    await boton.locator('span').evaluate((texto) => {
      texto.textContent = 'Compartir'
    })
    expect(await palabrasPartidas(boton)).toEqual([])
    expect((await boton.boundingBox())!.height).toBeGreaterThanOrEqual(56)
  })
})
