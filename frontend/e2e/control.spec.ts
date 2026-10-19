import { expect, test, type Page } from '@playwright/test'
import {
  esperarSinDesplazamientoHorizontal,
  esperarSinViolacionesGraves,
} from './utilidades/calidad'
import { esperarObjetivosTactiles, palabrasPartidas, soles, textoDe } from './utilidades/control'
import { prepararHistoriaDeDemostracion } from './utilidades/historia-de-demostracion'
import { usarLetra } from './utilidades/navegacion'

/** Plan 13: la Torre de control con ocho semanas de demostración (reloj de Playwright + casos de uso). */

const SECCIONES = [
  'Resumen',
  'Alquiler del local',
  'Atención',
  'Para comprar',
  'Más vendidos',
  'Semana contra semana',
  'Mejor día de la semana',
  'Productos parados',
]

/** Lo que la pantalla debe mostrar, calculado por el caso de uso real en la misma página. */
interface TorreEnLaPagina {
  resumen: { ventas: number; gananciaNeta: number }
  atencion: { agotados: number; porAcabarse: number; preciosParaRevisar: number }
  paraComprar: { lineas: number; total: number }
  semana: string[]
  mejorDia: string | null
  parados: { nombres: string[]; total: number }
}

async function torreDelCasoDeUso(page: Page): Promise<TorreEnLaPagina> {
  return page.evaluate(async () => {
    interface Dinero {
      centimos: number
    }
    interface Torre {
      resumen: { ventas: Dinero; gananciaNeta: Dinero }
      atencion: { agotados: number; porAcabarse: number; preciosParaRevisar: number }
      paraComprar: { lineas: unknown[]; total: Dinero }
      semana: { tipo: string; filas?: { cambio: string }[] }
      mejorDia: { tipo: string; mejor?: string }
      parados: { productos: { nombre: string }[]; total: Dinero }
    }
    const app = (
      window as Window & { __aplicacion?: { analisis: { consultarTorre(): Promise<Torre> } } }
    ).__aplicacion
    if (!app) throw new Error('La app no expuso window.__aplicacion')
    const t = await app.analisis.consultarTorre()
    return {
      resumen: { ventas: t.resumen.ventas.centimos, gananciaNeta: t.resumen.gananciaNeta.centimos },
      atencion: t.atencion,
      paraComprar: { lineas: t.paraComprar.lineas.length, total: t.paraComprar.total.centimos },
      semana: (t.semana.filas ?? []).map((f) => f.cambio),
      mejorDia: t.mejorDia.mejor ?? null,
      parados: {
        nombres: t.parados.productos.map((p) => p.nombre),
        total: t.parados.total.centimos,
      },
    }
  })
}

/** Arma la historia y entra a Control desde la navegación (sin recargar: el reloj ya es "hoy"). */
async function abrirControlConHistoria(page: Page): Promise<void> {
  await prepararHistoriaDeDemostracion(page)
  await page.getByRole('link', { name: 'Control' }).click()
  await expect(page.getByRole('heading', { level: 2, name: 'Resumen' })).toBeVisible()
}

function seccion(page: Page, titulo: string) {
  return page.getByRole('region', { name: titulo, exact: true })
}

test.describe('Torre de control con datos de demostración', () => {
  test.setTimeout(90_000)

  test('04-torre-de-control: las ocho secciones (con Alquiler del local sin configurar), en orden, muestran lo que calculan los casos de uso', async ({
    page,
  }) => {
    await abrirControlConHistoria(page)
    const esperado = await torreDelCasoDeUso(page)

    await expect(page.locator('section h2')).toHaveText(SECCIONES)

    // Resumen de hoy (RN-AN-02 / RN-AN-03) y otro periodo.
    const resumen = seccion(page, 'Resumen')
    const cifra = resumen.locator('.tarjeta-de-cifra')
    expect(await textoDe(cifra)).toBe(
      `Hoy ganaste ${soles(esperado.resumen.gananciaNeta)} Vendiste ${soles(esperado.resumen.ventas)}`,
    )
    await resumen.getByRole('radio', { name: '7 días' }).click()
    await expect(cifra).toContainText('En 7 días ganaste')

    // Atención: cada grupo con su cantidad, y abre su lista.
    const atencion = seccion(page, 'Atención')
    const agotados = atencion.getByRole('button', { name: /^Agotados/ })
    await expect(agotados).toHaveText(new RegExp(`${esperado.atencion.agotados} producto`))
    await expect(atencion.getByRole('button', { name: /^Queda poco/ })).toHaveText(
      new RegExp(`${esperado.atencion.porAcabarse} productos?`),
    )
    await agotados.click()
    await expect(agotados).toHaveAttribute('aria-expanded', 'true')
    await expect(atencion.getByText('Bolsas de basura x10')).toBeVisible()

    // Para comprar: el total de la lista de hoy.
    const paraComprar = seccion(page, 'Para comprar')
    await expect(paraComprar.locator('.cuantos')).toHaveText(
      `${esperado.paraComprar.lineas} productos`,
    )
    expect(await textoDe(paraComprar.locator('.fila-de-dato--destacado'))).toBe(
      `Total estimado ${soles(esperado.paraComprar.total)}`,
    )

    // Más vendidos: la Lejía primero.
    const masVendidos = seccion(page, 'Más vendidos')
    await expect(masVendidos.locator('ol').first().locator('li').first()).toContainText(
      'Lejía Tradicional 1 L',
    )

    // Semana contra semana (RN-AN-12): los mismos textos que el dominio.
    const cambios = seccion(page, 'Semana contra semana').locator('.cambio')
    expect(esperado.semana).toHaveLength(2)
    expect((await cambios.allInnerTexts()).map((t) => t.replace(/\s+/g, ' ').trim())).toEqual(
      esperado.semana,
    )

    // Mejor día (RN-AN-13): sábado, marcado en el gráfico.
    expect(esperado.mejorDia).toBe('sábado')
    const mejorDia = seccion(page, 'Mejor día de la semana')
    await expect(mejorDia).toContainText('Tu mejor día es el sábado')
    await expect(mejorDia.locator('.fila--destacada .etiqueta')).toHaveText('Sábado')
    await expect(mejorDia.locator('.grafico-barras .fila')).toHaveCount(7)

    // Productos parados (RN-AN-11).
    const parados = seccion(page, 'Productos parados')
    expect(esperado.parados.nombres).toEqual(['Ambientador Glade', 'Escoba de paja'])
    for (const nombre of esperado.parados.nombres) {
      await expect(parados.getByText(nombre)).toBeVisible()
    }
    expect(await textoDe(parados.locator('.total'))).toBe(
      `Total de dinero parado ${soles(esperado.parados.total)}`,
    )
    await expect(parados).toContainText('Ponlo a la vista u ofrécelo con descuento')
  })

  test('06-experiencia-de-uso: desde 768 px, dos columnas; por debajo, una', async ({ page }) => {
    await abrirControlConHistoria(page)
    const columnas = page.locator('.tablero > .columna')
    async function cajasA(ancho: number) {
      await page.setViewportSize({ width: ancho, height: 800 })
      const a = await columnas.nth(0).boundingBox()
      const b = await columnas.nth(1).boundingBox()
      expect(a && b, `columnas a ${ancho} px`).toBeTruthy()
      return { a: a!, b: b! }
    }
    for (const ancho of [768, 1280]) {
      const { a, b } = await cajasA(ancho)
      expect(b.x, `a ${ancho} px la segunda columna va a la derecha`).toBeGreaterThan(
        a.x + a.width - 1,
      )
      expect(Math.abs(b.y - a.y), `a ${ancho} px las dos empiezan arriba`).toBeLessThan(2)
    }
    for (const ancho of [767, 360]) {
      const { a, b } = await cajasA(ancho)
      expect(b.y, `a ${ancho} px la segunda columna va debajo`).toBeGreaterThan(a.y + a.height - 1)
    }
  })

  for (const ancho of [320, 360, 768, 1280]) {
    test(`RN-UX-09 / RN-SIS-07, ${ancho} px con letra Muy grande: nada se sale, ninguna palabra se parte y axe no encuentra violaciones graves`, async ({
      page,
    }) => {
      await usarLetra(page, 'MUY_GRANDE')
      await page.setViewportSize({ width: ancho, height: 800 })
      await abrirControlConHistoria(page)
      // Con las listas de Atención abiertas: también deben caber.
      for (const boton of await page.locator('.fila-de-atencion button').all()) {
        await boton.click()
        await expect(boton).toHaveAttribute('aria-expanded', 'true')
      }
      await esperarSinDesplazamientoHorizontal(page)
      expect(await palabrasPartidas(page.locator('#contenido'))).toEqual([])
      await esperarObjetivosTactiles(page.locator('#contenido'))
      await esperarSinViolacionesGraves(page)
    })
  }
})
