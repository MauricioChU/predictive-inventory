import { expect, test, type Page } from '@playwright/test'
import { esperarSinDesplazamientoHorizontal, usarLetra } from './utilidades/calidad'
import { abrir } from './utilidades/navegacion'

type VentanaConGanchos = Window & {
  __pruebas?: {
    mostrarGrafico: (
      titulo: string,
      barras: { etiqueta: string; valor: number; textoValor: string; destacada?: boolean }[],
    ) => Promise<void>
  }
}

const VENTAS = [
  { etiqueta: 'Limpiavidrios', valor: 12345.67, textoValor: 'S/ 12 345.67', destacada: true },
  { etiqueta: 'Desinfectante multiuso', valor: 9.5, textoValor: 'S/ 9.50' },
  { etiqueta: 'Detergente Bolívar 2.6 kg', valor: 12000, textoValor: 'S/ 12 000.00' },
  { etiqueta: 'Jabón', valor: 6172.83, textoValor: 'S/ 6 172.83' },
]
const PALABRA_LARGUISIMA = 'Superdesinfectantemultiusoconcentradoextrafuerte'

/** Monta un GraficoBarras al final de #contenido con el gancho de pruebas de la app. */
async function mostrarGrafico(page: Page, titulo: string, barras: typeof VENTAS): Promise<void> {
  await page.evaluate(
    async ({ t, b }) => {
      const ganchos = (window as VentanaConGanchos).__pruebas
      if (!ganchos) throw new Error('La app no expuso window.__pruebas')
      await ganchos.mostrarGrafico(t, b)
    },
    { t: titulo, b: barras },
  )
  await expect(page.getByRole('figure', { name: titulo })).toBeVisible()
}

/** Mide cada fila del gráfico `titulo`: pista, barra, valor y las palabras de la etiqueta que
 * quedaron partidas entre dos líneas (con un Range por palabra: si sus rectángulos caen en más
 * de una línea, la palabra se cortó). */
async function medirFilas(page: Page, titulo: string) {
  return page.getByRole('figure', { name: titulo }).evaluate((figura) =>
    [...figura.querySelectorAll('.fila')].map((fila) => {
      const caja = (sel: string) => fila.querySelector(sel)!.getBoundingClientRect()
      const etiqueta = fila.querySelector('.etiqueta')!
      const nodo = etiqueta.firstChild!
      const texto = nodo.textContent ?? ''
      const partidas: string[] = []
      let inicio = 0
      for (const palabra of texto.split(' ')) {
        const rango = document.createRange()
        rango.setStart(nodo, inicio)
        rango.setEnd(nodo, inicio + palabra.length)
        const lineas = new Set([...rango.getClientRects()].map((r) => Math.round(r.top)))
        if (lineas.size > 1) partidas.push(palabra)
        inicio += palabra.length + 1
      }
      const pista = caja('.pista')
      const valor = caja('.valor')
      return {
        partidas,
        pista: { left: pista.left, width: pista.width, top: pista.top, bottom: pista.bottom },
        barra: caja('.barra').width,
        etiquetaAbajo: caja('.etiqueta').bottom,
        valor: { top: valor.top, bottom: valor.bottom, right: valor.right },
      }
    }),
  )
}

async function abrirControl(page: Page, ancho: number): Promise<void> {
  await usarLetra(page, 'MUY_GRANDE')
  await page.setViewportSize({ width: ancho, height: 800 })
  await abrir(page, './control')
  await page.evaluate(() => document.fonts.ready)
}

// N2 (rondas 4 y 5): una escala común y etiquetas que se cortan solo entre palabras.
test.describe('N2: GraficoBarras con escala común y etiquetas enteras', () => {
  for (const ancho of [320, 360]) {
    test(`celular ${ancho}px, letra Muy grande: etiqueta sola arriba, pista · valor abajo`, async ({
      page,
    }) => {
      await abrirControl(page, ancho)
      await mostrarGrafico(page, 'Ventas por producto', VENTAS)
      const filas = await medirFilas(page, 'Ventas por producto')
      expect(filas).toHaveLength(VENTAS.length)

      // Ninguna etiqueta se corta a mitad de palabra ("Limpiavidri|os", "Desinfectant|e").
      expect(filas.flatMap((f) => f.partidas)).toEqual([])

      // Misma pista (mismo ancho y misma base) en todas las filas ⇒ barras comparables.
      for (const fila of filas) {
        expect(Math.abs(fila.pista.width - filas[0]!.pista.width)).toBeLessThanOrEqual(0.5)
        expect(Math.abs(fila.pista.left - filas[0]!.pista.left)).toBeLessThanOrEqual(0.5)
        // Dos líneas: la etiqueta arriba; la pista y el valor juntos en la de abajo.
        expect(fila.etiquetaAbajo).toBeLessThanOrEqual(fila.pista.top + 0.5)
        expect(fila.valor.top).toBeLessThan(fila.pista.bottom)
        expect(fila.valor.bottom).toBeGreaterThan(fila.pista.top)
        expect(fila.valor.right).toBeLessThanOrEqual(ancho + 0.5)
      }

      // Escala común: largo proporcional al valor; el más chico igual se ve (≥ 4 px).
      const pista = filas[0]!.pista.width
      const maximo = Math.max(...VENTAS.map((v) => v.valor))
      VENTAS.forEach((venta, i) => {
        const esperado = Math.max(4, (venta.valor / maximo) * pista)
        expect(Math.abs(filas[i]!.barra - esperado), venta.etiqueta).toBeLessThanOrEqual(1)
      })

      await esperarSinDesplazamientoHorizontal(page)
    })

    test(`celular ${ancho}px, letra Muy grande: una palabra más ancha que la fila se parte sin salirse`, async ({
      page,
    }) => {
      await abrirControl(page, ancho)
      await mostrarGrafico(page, 'Palabra larguísima', [
        { etiqueta: PALABRA_LARGUISIMA, valor: 5, textoValor: '5 u' },
        { etiqueta: 'Lejía', valor: 3, textoValor: '3 u' },
      ])
      const filas = await medirFilas(page, 'Palabra larguísima')
      // Único corte permitido: la palabra que sola no cabe en toda la fila.
      expect(filas.flatMap((f) => f.partidas)).toEqual([PALABRA_LARGUISIMA])
      await esperarSinDesplazamientoHorizontal(page)
    })
  }

  test('PC 1280px, letra Muy grande: una sola grilla, misma pista en todas las filas', async ({
    page,
  }) => {
    await abrirControl(page, 1280)
    await mostrarGrafico(page, 'Ventas por producto', VENTAS)
    const filas = await medirFilas(page, 'Ventas por producto')
    expect(filas.flatMap((f) => f.partidas)).toEqual([])
    for (const fila of filas) {
      expect(Math.abs(fila.pista.width - filas[0]!.pista.width)).toBeLessThanOrEqual(0.5)
      expect(Math.abs(fila.pista.left - filas[0]!.pista.left)).toBeLessThanOrEqual(0.5)
    }
    await esperarSinDesplazamientoHorizontal(page)
  })
})
