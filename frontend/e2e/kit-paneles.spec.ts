import { expect, test, type Locator, type Page } from '@playwright/test'
import {
  esperarSinDesplazamientoHorizontal,
  esperarSinViolacionesGraves,
  usarLetra,
} from './utilidades/calidad'

type VentanaConGanchos = Window & {
  __pruebas?: { mostrarCatalogo: (nombre: string) => Promise<void> }
}

const ALTO = 800
const ANCHOS = [320, 360, 768, 1280]

/** Abre una pantalla cualquiera con letra Muy grande y monta debajo el catálogo del kit B
 * (src/shared/ui/__catalogo__/CatalogoKitPaneles.vue) con el gancho de pruebas de la app. */
async function abrirCatalogo(page: Page, ancho: number): Promise<Locator> {
  await usarLetra(page, 'MUY_GRANDE')
  await page.setViewportSize({ width: ancho, height: ALTO })
  await page.goto('./historial')
  await page.evaluate(async () => {
    const ganchos = (window as VentanaConGanchos).__pruebas
    if (!ganchos) throw new Error('La app no expuso window.__pruebas')
    await ganchos.mostrarCatalogo('paneles')
  })
  const catalogo = page.locator('.catalogo-kit-paneles')
  await expect(catalogo).toBeVisible()
  await page.evaluate(() => document.fonts.ready)
  return catalogo
}

/** Trozos (separados por espacios normales) de cada elemento de `selector` que quedaron
 * partidos entre dos líneas. Un monto "S/ 12 345.67" usa espacios que no cortan: es UN trozo. */
async function trozosPartidos(catalogo: Locator, selector: string): Promise<string[]> {
  return catalogo.evaluate((raiz, sel) => {
    const partidos: string[] = []
    for (const elemento of raiz.querySelectorAll(sel)) {
      const nodo = [...elemento.childNodes].find((n) => n.nodeType === Node.TEXT_NODE)
      const texto = nodo?.textContent ?? ''
      let inicio = 0
      for (const trozo of texto.split(' ')) {
        const rango = document.createRange()
        rango.setStart(nodo!, inicio)
        rango.setEnd(nodo!, inicio + trozo.length)
        const lineas = new Set([...rango.getClientRects()].map((r) => Math.round(r.top)))
        if (lineas.size > 1) partidos.push(trozo)
        inicio += trozo.length + 1
      }
    }
    return partidos
  }, selector)
}

/** Textos de los componentes que se envuelven solo entre palabras (nunca "derram|ó"). */
const TEXTOS_DE_LOS_COMPONENTES = [
  '.selector-segmentado .etiqueta',
  '.selector-segmentado .texto',
  '.botones-de-opcion .etiqueta',
  '.botones-de-opcion .texto',
  '.botones-de-opcion .error',
  '.tarjeta-de-cifra .titulo',
  '.tarjeta-de-cifra .detalle',
  '.aviso-en-pagina .titulo',
  '.aviso-en-pagina .texto',
  '.aviso-en-pagina button span',
  '.lista-agrupada-por-dia .dia',
  '.barra-de-progreso .texto',
  '.mensaje-de-error .mensaje',
  '.mensaje-de-error .ayuda',
  '.fila-de-dato dt',
].join(', ')

test.describe('Kit B (paneles): responsive y accesible con letra Muy grande', () => {
  for (const ancho of ANCHOS) {
    test(`${ancho}px: nada se sale de la pantalla, ningún monto ni palabra se parte y axe no encuentra violaciones graves`, async ({
      page,
    }) => {
      const catalogo = await abrirCatalogo(page, ancho)
      await esperarSinDesplazamientoHorizontal(page)
      expect(await trozosPartidos(catalogo, '.tarjeta-de-cifra .valor')).toEqual([])
      expect(await trozosPartidos(catalogo, '.respuesta-grande .texto')).toEqual([])
      expect(await trozosPartidos(catalogo, '.fila-de-dato .valor')).toEqual([])
      expect(await trozosPartidos(catalogo, TEXTOS_DE_LOS_COMPONENTES)).toEqual([])
      await esperarSinViolacionesGraves(page)
    })
  }

  for (const ancho of [320, 1280]) {
    test(`RN-UX-02, ${ancho}px: todo lo tocable mide ≥ 48 px, las opciones grandes ≥ 56 px y hay ≥ 8 px entre opciones`, async ({
      page,
    }) => {
      const catalogo = await abrirCatalogo(page, ancho)
      const botones = await catalogo
        .locator('button')
        .evaluateAll((lista) => lista.map((b) => b.getBoundingClientRect().toJSON() as DOMRect))
      expect(botones.length).toBeGreaterThan(10)
      for (const caja of botones) {
        expect(caja.width).toBeGreaterThanOrEqual(48)
        expect(caja.height).toBeGreaterThanOrEqual(48)
      }

      const opcionesGrandes = await catalogo
        .locator('.botones-de-opcion [role="radio"]')
        .evaluateAll((lista) => lista.map((b) => b.getBoundingClientRect().height))
      for (const alto of opcionesGrandes) expect(alto).toBeGreaterThanOrEqual(56)

      const separaciones = await catalogo.locator('[role="radiogroup"]').evaluateAll((grupos) =>
        grupos.flatMap((grupo) => {
          const cajas = [...grupo.querySelectorAll('[role="radio"]')].map((r) =>
            r.getBoundingClientRect(),
          )
          return cajas.slice(1).map((b, i) => {
            const a = cajas[i]!
            const mismaFila = b.top < a.bottom && a.top < b.bottom
            return mismaFila ? b.left - a.right : b.top - a.bottom
          })
        }),
      )
      for (const separacion of separaciones) expect(separacion).toBeGreaterThanOrEqual(7.5)
    })
  }
})

test.describe('SelectorSegmentado', () => {
  test('a 320 px con letra Muy grande se envuelve en más de una fila, sin salirse del grupo', async ({
    page,
  }) => {
    const catalogo = await abrirCatalogo(page, 320)
    const grupo = catalogo.getByRole('radiogroup', { name: 'Mostrar' })
    const medida = await grupo.evaluate((g) => {
      const caja = g.getBoundingClientRect()
      const radios = [...g.querySelectorAll('[role="radio"]')].map((r) => r.getBoundingClientRect())
      return {
        filas: new Set(radios.map((r) => Math.round(r.top))).size,
        dentro: radios.every((r) => r.left >= caja.left - 0.5 && r.right <= caja.right + 0.5),
      }
    })
    expect(medida.filas).toBeGreaterThan(1)
    expect(medida.dentro).toBe(true)
  })

  test('con el teclado: las flechas eligen y llevan el foco; Tab entra a la elegida y sale de un paso', async ({
    page,
  }) => {
    const catalogo = await abrirCatalogo(page, 1280)
    const grupo = catalogo.getByRole('radiogroup', { name: 'Mostrar' })
    const opcion = (nombre: string) => grupo.getByRole('radio', { name: nombre, exact: true })

    await expect(opcion('Queda poco')).toBeChecked()
    await opcion('Todos').click()
    await expect(opcion('Todos')).toBeChecked()

    await page.keyboard.press('ArrowRight')
    await expect(opcion('Queda poco')).toBeChecked()
    await expect(opcion('Queda poco')).toBeFocused()

    await page.keyboard.press('ArrowLeft')
    await page.keyboard.press('ArrowLeft')
    await expect(opcion('Archivados')).toBeChecked()
    await expect(opcion('Archivados')).toBeFocused()
    await expect(opcion('Todos')).not.toBeChecked()

    // Un solo punto de tabulación por grupo: el siguiente Tab ya está en el grupo de abajo.
    await page.keyboard.press('Tab')
    await expect(catalogo.getByRole('radio', { name: 'Se derramó' })).toBeFocused()
    await page.keyboard.press('Shift+Tab')
    await expect(opcion('Archivados')).toBeFocused()
  })

  test('RN-UX-04: la opción elegida se distingue por fondo, borde y negrita, no solo por color', async ({
    page,
  }) => {
    const catalogo = await abrirCatalogo(page, 360)
    const estilo = (nombre: string) =>
      catalogo.getByRole('radio', { name: nombre, exact: true }).evaluate((b) => {
        const s = getComputedStyle(b)
        return { peso: s.fontWeight, sombra: s.boxShadow, fondo: s.backgroundColor }
      })
    const elegida = await estilo('Queda poco')
    const otra = await estilo('Agotados')
    expect(elegida.peso).toBe('700')
    expect(otra.peso).toBe('400')
    expect(elegida.sombra).not.toBe('none')
    expect(otra.sombra).toBe('none')
    expect(elegida.fondo).not.toBe(otra.fondo)
  })

  test('elegir otra opción no mueve a las demás (el ancho de la negrita ya estaba reservado)', async ({
    page,
  }) => {
    const catalogo = await abrirCatalogo(page, 1280)
    const grupo = catalogo.getByRole('radiogroup', { name: 'Mostrar' })
    const cajas = () =>
      grupo.evaluate((g) =>
        [...g.querySelectorAll('[role="radio"]')].map((r) => {
          const { left, width } = r.getBoundingClientRect()
          return { left: Math.round(left), width: Math.round(width) }
        }),
      )
    const antes = await cajas()
    await grupo.getByRole('radio', { name: 'Archivados' }).click()
    expect(await cajas()).toEqual(antes)
  })
})

test.describe('BotonesDeOpcion', () => {
  test('la elegida lleva la marca ✓; con error, el grupo queda inválido y el error se lee', async ({
    page,
  }) => {
    const catalogo = await abrirCatalogo(page, 360)
    const motivo = catalogo.getByRole('radiogroup', { name: '¿Qué pasó?' })
    await expect(motivo.getByRole('radio', { name: 'Se derramó' })).toBeChecked()
    await expect(motivo.locator('[aria-checked="true"] .marca--elegida')).toHaveCount(1)
    await motivo.getByRole('radio', { name: 'Se venció' }).click()
    await expect(motivo.getByRole('radio', { name: 'Se venció' })).toBeChecked()
    await expect(motivo.locator('[aria-checked="true"] .marca--elegida')).toHaveCount(1)

    const unidad = catalogo.getByRole('radiogroup', { name: '¿Cómo se vende?' })
    await expect(unidad).toHaveAttribute('aria-invalid', 'true')
    await expect(unidad).toHaveAccessibleDescription('Elige cómo se vende el producto.')
    await unidad.getByRole('radio', { name: 'Por kilo' }).click()
    await expect(unidad).not.toHaveAttribute('aria-invalid', 'true')
  })
})

test.describe('BarraDeProgreso', () => {
  test('progressbar con nombre y "Llevas 1 de 3"; el relleno crece al contar otro', async ({
    page,
  }) => {
    const catalogo = await abrirCatalogo(page, 360)
    const barra = catalogo.getByRole('progressbar', { name: 'Avance' })
    await expect(barra).toHaveAttribute('aria-valuenow', '1')
    await expect(barra).toHaveAttribute('aria-valuemax', '3')
    await expect(barra).toHaveAttribute('aria-valuetext', 'Llevas 1 de 3')
    const proporcion = () =>
      barra.evaluate((pista) => {
        const relleno = pista.firstElementChild!.getBoundingClientRect().width
        return relleno / pista.clientWidth
      })
    await expect.poll(proporcion).toBeCloseTo(1 / 3, 2)

    await catalogo.getByRole('button', { name: 'Contar otro' }).click()
    await expect(barra).toHaveAttribute('aria-valuenow', '2')
    await expect(barra).toHaveAttribute('aria-valuetext', 'Llevas 2 de 3')
    await expect.poll(proporcion).toBeCloseTo(2 / 3, 2)
  })
})

test.describe('RespuestaGrande', () => {
  test('RN-UX-15: al cambiar la respuesta, la nueva frase se anuncia en la región viva', async ({
    page,
  }) => {
    const catalogo = await abrirCatalogo(page, 360)
    const region = catalogo.locator('[data-prueba="anuncios-del-catalogo"]')
    await expect(region).toHaveText('Sí, compra ~12 unid.')
    await catalogo.getByRole('radio', { name: 'No compres' }).click()
    await expect(region).toHaveText('No compres: no se vende hace 45 días')
    await expect(catalogo.locator('.respuesta-grande')).toHaveClass(/respuesta-grande--peligro/)
  })

  test('a 320 px con letra Muy grande la frase va más grande que el texto normal', async ({
    page,
  }) => {
    const catalogo = await abrirCatalogo(page, 320)
    const tamanos = await catalogo.evaluate((raiz) => ({
      frase: parseFloat(getComputedStyle(raiz.querySelector('.respuesta-grande .texto')!).fontSize),
      base: parseFloat(getComputedStyle(document.documentElement).fontSize),
    }))
    expect(tamanos.frase).toBeGreaterThanOrEqual(tamanos.base * 1.25)
  })
})
