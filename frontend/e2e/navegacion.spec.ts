import { expect, test } from '@playwright/test'
import { esperarSinDesplazamientoHorizontal, esperarSinViolacionesGraves, usarLetra } from './utilidades/calidad'

const DESTINOS = ['Inicio', 'Vender', 'Recibir', 'Productos', 'Control']
const ANCHOS = [320, 360, 768, 1280]

test.describe('RN-UX-12: navegación', () => {
  test('los cinco destinos están visibles y funcionan', async ({ page }) => {
    await page.goto('./')
    for (const destino of DESTINOS) {
      await page.getByRole('link', { name: destino }).click()
      await expect(page.getByRole('heading', { level: 1 })).toHaveText(destino)
    }
  })
})

test.describe('RN-SIS-06 y RN-SIS-07: responsive y accesibilidad', () => {
  for (const ancho of ANCHOS) {
    test(`sin desplazamiento horizontal a ${ancho}px con letra Muy grande`, async ({ page }) => {
      await usarLetra(page, 'MUY_GRANDE')
      await page.setViewportSize({ width: ancho, height: 800 })
      for (const ruta of ['./', './vender', './recibir', './productos', './control', './ajustes', './historial']) {
        await page.goto(ruta)
        await esperarSinDesplazamientoHorizontal(page)
        await expect(page.getByRole('navigation')).toBeVisible()
      }
    })
  }

  test('sin violaciones graves de accesibilidad', async ({ page }) => {
    await page.goto('./')
    await esperarSinViolacionesGraves(page)
  })
})

// S1: la barra inferior usaba position:fixed con una altura "adivinada" en el padding de
// <main> y en el desplazamiento del aviso Deshacer; si una etiqueta se envolvía (p. ej.
// "Productos" partido a mitad de palabra con letra Muy grande), la barra crecía más de lo
// previsto y tapaba el contenido. Ahora la barra es una fila de una grilla (ver LayoutApp) que
// nunca se superpone, y las etiquetas nunca se envuelven (ver BarraNavegacion). Esto solo
// aplica al layout de celular (barra inferior); desde 1024px la navegación es una columna
// lateral y no hay nada que verificar aquí.
test.describe('S1: la barra de navegación no tapa el contenido', () => {
  for (const ancho of [320, 360]) {
    for (const letra of ['NORMAL', 'GRANDE', 'MUY_GRANDE'] as const) {
      test(`el último elemento de <main> es visible sobre la barra a ${ancho}px con letra ${letra}`, async ({
        page,
      }, testInfo) => {
        test.skip(
          testInfo.project.name !== 'celular',
          'La barra inferior solo existe por debajo de 1024px (proyecto celular)',
        )
        await usarLetra(page, letra)
        await page.setViewportSize({ width: ancho, height: 800 })
        await page.goto('./')

        const main = page.locator('#contenido')
        await main.evaluate((el) => el.scrollTo({ top: el.scrollHeight }))

        const ultimo = page.locator('#contenido *').last()
        const cajaUltimo = await ultimo.boundingBox()
        const cajaNav = await page.getByRole('navigation').boundingBox()
        expect(cajaUltimo, 'el último elemento de <main> debe tener una caja visible').not.toBeNull()
        expect(cajaNav, 'la barra de navegación debe tener una caja visible').not.toBeNull()
        // el borde inferior del último elemento no debe pasar del tope de la barra (+1px de margen de redondeo)
        expect(cajaUltimo!.y + cajaUltimo!.height).toBeLessThanOrEqual(cajaNav!.y + 1)

        // ninguna etiqueta de la barra ocupa más de una línea (nunca se envuelve ni se parte a mitad de palabra)
        const lineas = await page.locator('nav .etiqueta-texto').evaluateAll((nodos) =>
          nodos.map((n) => {
            const caja = n.getBoundingClientRect()
            const estilo = getComputedStyle(n)
            const altoDeLinea = Number.parseFloat(estilo.lineHeight) || caja.height
            return { alto: caja.height, altoDeLinea }
          }),
        )
        for (const { alto, altoDeLinea } of lineas) {
          expect(alto).toBeLessThanOrEqual(altoDeLinea * 1.5)
        }
      })
    }
  }
})
