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
  'Tus mejores productos',
  'Semana contra semana',
  'Mejor día de la semana',
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

  test('04-torre-de-control: las cinco secciones (con Alquiler del local sin configurar), en orden, muestran lo que calculan los casos de uso', async ({
    page,
  }) => {
    await abrirControlConHistoria(page)
    const esperado = await torreDelCasoDeUso(page)

    await expect(page.locator('section h2')).toHaveText(SECCIONES)

    // Resumen de hoy (RN-AN-02 / RN-AN-03) y otro periodo: mismos rótulos que Inicio.
    const resumen = seccion(page, 'Resumen')
    const cifra = resumen.locator('.cifras-principales')
    expect(await textoDe(cifra)).toBe(
      `Total vendido ${soles(esperado.resumen.ventas)} Ganancia real ${soles(esperado.resumen.gananciaNeta)}`,
    )
    await resumen.getByRole('radio', { name: '7 días' }).click()
    await expect(cifra).toContainText('Total vendido')
    await expect(cifra).toContainText('Ganancia real')

    // Lo que más rinde: la Lejía primero, y un selector alterna al top por ganancia.
    const mejores = seccion(page, 'Tus mejores productos')
    await expect(mejores.locator('ol')).toHaveCount(1)
    await expect(mejores.locator('ol li').first()).toContainText('Lejía Tradicional 1 L')
    await mejores.getByRole('radio', { name: 'Más ganancia' }).click()
    await expect(mejores.locator('ol')).toHaveCount(1)
    await expect(mejores.locator('h3')).toHaveText('Los que más ganancia dejan')

    // Semana contra semana (RN-AN-12): un selector (Ventas / Ganancia) alterna los dos gráficos, de a uno.
    const semana = seccion(page, 'Semana contra semana')
    expect(esperado.semana).toHaveLength(2)
    const cambio = async () =>
      (await semana.locator('.cambio').innerText()).replace(/\s+/g, ' ').trim()
    await expect(semana.locator('figure.grafico-barras')).toHaveCount(1)
    expect(await cambio()).toBe(esperado.semana[0])
    await semana.getByRole('radio', { name: 'Ganancia' }).click()
    await expect(semana.locator('figure.grafico-barras')).toHaveCount(1)
    expect(await cambio()).toBe(esperado.semana[1])
    await semana.getByRole('radio', { name: 'Ventas' }).click()
    expect(await cambio()).toBe(esperado.semana[0])

    // Mejor día (RN-AN-13): sábado, marcado en el gráfico de barras verticales.
    expect(esperado.mejorDia).toBe('sábado')
    const mejorDia = seccion(page, 'Mejor día de la semana')
    await expect(mejorDia).toContainText('Tu mejor día es el sábado')
    await expect(mejorDia.locator('.columna--destacada .etiqueta')).toHaveText('Sábado')
    await expect(mejorDia.locator('.grafico-columnas .columna')).toHaveCount(7)

    // Ayuda inteligente: el botón del final lleva a Atención, Para comprar y Productos parados.
    await page.getByRole('link', { name: /^Ayuda inteligente/ }).click()
    await expect(page.getByRole('heading', { level: 1, name: 'Ayuda inteligente' })).toBeVisible()

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
      await esperarSinDesplazamientoHorizontal(page)
      expect(await palabrasPartidas(page.locator('#contenido'))).toEqual([])
      await esperarObjetivosTactiles(page.locator('#contenido'))
      await esperarSinViolacionesGraves(page)
      // Ayuda inteligente, con las listas de Atención abiertas: también deben caber.
      await page.getByRole('link', { name: /^Ayuda inteligente/ }).click()
      await expect(page.getByRole('heading', { level: 1, name: 'Ayuda inteligente' })).toBeVisible()
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
