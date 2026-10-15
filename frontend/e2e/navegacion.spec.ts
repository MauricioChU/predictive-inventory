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

// S1 (ronda 2): la barra inferior usaba position:fixed con una altura "adivinada" en el
// padding de <main>, y un <main> con su propio overflow-y rompía el scroll normal del
// documento (gestos de borde de Android, barra de direcciones, scroll guardado del router).
// Ahora LayoutApp vuelve al scroll normal de la ventana; la barra + el aviso Deshacer son un
// solo contenedor "pie" sticky al final del flujo (nunca tapan nada porque reservan su propio
// espacio real, no uno adivinado), y las etiquetas de la barra usan container queries
// (BarraNavegacion) para no envolverse NI recortarse con puntos suspensivos nunca. Esto solo
// aplica al layout de celular (barra inferior); desde 1024px la navegación es una columna
// lateral y no hay nada que verificar aquí.
test.describe('S1: enlaces de navegación completos y dentro del viewport', () => {
  for (const ancho of [320, 360, 412]) {
    for (const letra of ['NORMAL', 'GRANDE', 'MUY_GRANDE'] as const) {
      test(`a ${ancho}px con letra ${letra}: etiquetas completas, enlaces ≥48px y último elemento visible sobre la barra`, async ({
        page,
      }, testInfo) => {
        test.skip(
          testInfo.project.name !== 'celular',
          'La barra inferior solo existe por debajo de 1024px (proyecto celular)',
        )
        await usarLetra(page, letra)
        await page.setViewportSize({ width: ancho, height: 800 })
        await page.goto('./')

        const datos = await page.evaluate(() => {
          const anchoVentana = document.documentElement.clientWidth
          const enlaces = Array.from(document.querySelectorAll('nav .enlace'))
          return enlaces.map((enlace) => {
            const etiqueta = enlace.querySelector('.etiqueta-texto')
            const cajaEnlace = enlace.getBoundingClientRect()
            return {
              texto: etiqueta?.textContent?.trim() ?? '',
              etiquetaScrollWidth: etiqueta?.scrollWidth ?? 0,
              etiquetaClientWidth: etiqueta?.clientWidth ?? 0,
              anchoEnlace: cajaEnlace.width,
              dentroDelViewport: cajaEnlace.left >= -1 && cajaEnlace.right <= anchoVentana + 1,
            }
          })
        })

        expect(datos.map((d) => d.texto)).toEqual(['Inicio', 'Vender', 'Recibir', 'Productos', 'Control'])
        for (const d of datos) {
          // scrollWidth <= clientWidth: la etiqueta nunca se recorta (nowrap + overflow:visible,
          // nunca ellipsis) ni se envuelve a una segunda línea.
          expect(
            d.etiquetaScrollWidth,
            `la etiqueta "${d.texto}" no debe recortarse ni envolverse`,
          ).toBeLessThanOrEqual(d.etiquetaClientWidth + 1)
          expect(d.anchoEnlace, `el enlace "${d.texto}" debe medir al menos 48px de ancho`).toBeGreaterThanOrEqual(
            48,
          )
          expect(d.dentroDelViewport, `el enlace "${d.texto}" debe quedar dentro del viewport`).toBe(true)
        }

        // último elemento de <main> visible sobre la barra tras desplazarse al final del documento
        await page.evaluate(() => window.scrollTo({ top: document.documentElement.scrollHeight }))
        const ultimo = page.locator('#contenido *').last()
        const cajaUltimo = await ultimo.boundingBox()
        const cajaNav = await page.getByRole('navigation').boundingBox()
        expect(cajaUltimo, 'el último elemento de <main> debe tener una caja visible').not.toBeNull()
        expect(cajaNav, 'la barra de navegación debe tener una caja visible').not.toBeNull()
        expect(cajaUltimo!.y + cajaUltimo!.height).toBeLessThanOrEqual(cajaNav!.y + 1)
      })
    }
  }
})
