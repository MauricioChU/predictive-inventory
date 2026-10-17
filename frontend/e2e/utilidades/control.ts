import { expect, type Locator, type Page } from '@playwright/test'

/** U+00A0, el espacio de pegarCifras (escrito así para que se vea en el código). */
const ESPACIO_QUE_NO_CORTA = String.fromCharCode(0xa0)

/**
 * Plan 13: ayudantes de las E2E de Control, Para comprar y ¿Necesito comprar?
 */

/** "S/ 12 345.67" como lo escribe formatearDinero (src/shared/domain/formato.ts). */
export function soles(centimos: number): string {
  const absoluto = Math.abs(centimos)
  const enteros = String(Math.floor(absoluto / 100)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ')
  const texto = `S/ ${enteros}.${String(absoluto % 100).padStart(2, '0')}`
  return centimos < 0 ? `-${texto}` : texto
}

/** El texto de un elemento como se lee: espacios que no cortan como espacios, sin dobles. */
export async function textoDe(locator: Locator): Promise<string> {
  const texto = await locator.innerText()
  return texto.replaceAll(ESPACIO_QUE_NO_CORTA, ' ').replace(/\s+/g, ' ').trim()
}

/**
 * Palabras (separadas por espacios normales) que se ven dentro de `raiz` y quedaron partidas
 * entre dos líneas ("descuent|o", "Compa|rtir", "V|o|l|v|e|r"). Un monto o una cantidad
 * ("S/ 12.50", "2 unid.") usan espacios que no cortan: cuentan como UNA palabra.
 */
export async function palabrasPartidas(raiz: Locator): Promise<string[]> {
  return raiz.evaluate((elemento) => {
    const partidas: string[] = []
    const textos = document.createTreeWalker(elemento, NodeFilter.SHOW_TEXT)
    for (let nodo = textos.nextNode(); nodo; nodo = textos.nextNode()) {
      // Lo oculto o solo para el lector de pantalla (p. ej. la tabla del gráfico) no se dibuja.
      const padre = nodo.parentElement
      if (!padre || padre.closest('.solo-lector') || padre.getClientRects().length === 0) continue
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

/** RN-UX-02: todo lo tocable de `raiz` mide al menos 48 × 48 px; lo de `principales`, 56 px de alto. */
export async function esperarObjetivosTactiles(
  raiz: Locator,
  principales = '.boton-principal',
): Promise<void> {
  const medidas = await raiz.evaluate((elemento, sel) => {
    const tocables = elemento.querySelectorAll('button, a[href], input, textarea, [role="radio"]')
    return [...tocables]
      .filter((t) => t.getClientRects().length > 0 && !t.closest('.solo-lector'))
      .map((t) => {
        const caja = t.getBoundingClientRect()
        return {
          que: `${t.tagName.toLowerCase()} "${(t.textContent ?? '').trim().slice(0, 30)}"`,
          ancho: caja.width,
          alto: caja.height,
          principal: t.matches(sel),
        }
      })
  }, principales)
  expect(medidas.length).toBeGreaterThan(0)
  for (const m of medidas) {
    expect(m.alto, `${m.que} mide al menos 48 px de alto`).toBeGreaterThanOrEqual(47.5)
    expect(m.ancho, `${m.que} mide al menos 48 px de ancho`).toBeGreaterThanOrEqual(47.5)
    if (m.principal) {
      expect(m.alto, `${m.que} (principal) mide al menos 56 px`).toBeGreaterThanOrEqual(55.5)
    }
  }
}

/** Espera a que la app termine las tareas encoladas (avisos, acciones tras confirmar). */
export async function esperarTareasDeLaApp(page: Page): Promise<void> {
  await page.evaluate(async () => {
    const app = (window as Window & { __aplicacion?: { esperarTareasPendientes(): Promise<void> } })
      .__aplicacion
    await app?.esperarTareasPendientes()
  })
}

export interface ProductoParaPrueba {
  nombre: string
  categoria?: string
  unidad?: 'UNIDAD' | 'KILO' | 'LITRO'
  compra: string
  venta: string
  minimo: string
  stockInicial?: string
}

/**
 * Deja la tienda lista con los casos de uso reales (`window.__aplicacion`): primera vez completa
 * (con la letra que ya tenía) con el nombre de la tienda, y los productos creados hoy. Devuelve
 * los ids por nombre. La app ya debe estar abierta (`abrir`).
 */
export async function prepararTienda(
  page: Page,
  productos: ProductoParaPrueba[],
  nombreTienda = 'Bodega Rosita',
): Promise<Record<string, string>> {
  return page.evaluate(
    async ({ productos, nombreTienda }) => {
      interface App {
        tienda: {
          obtenerConfiguracion(): Promise<{ tamanoDeLetra: string }>
          completarPrimeraVez(d: { nombreTienda: string; tamanoDeLetra: string }): Promise<void>
        }
        catalogo: {
          listarCategorias(): Promise<{ id: string; nombre: string }[]>
          crearProducto(
            d: Record<string, unknown>,
          ): Promise<{ tipo: string; valor?: { productoId: string } }>
        }
        esperarTareasPendientes(): Promise<void>
      }
      const app = (window as Window & { __aplicacion?: App }).__aplicacion
      if (!app) throw new Error('La app no expuso window.__aplicacion')
      const { tamanoDeLetra } = await app.tienda.obtenerConfiguracion()
      await app.tienda.completarPrimeraVez({ nombreTienda, tamanoDeLetra })
      const categorias = await app.catalogo.listarCategorias()
      const ids: Record<string, string> = {}
      for (const p of productos) {
        const categoria = categorias.find((c) => c.nombre === (p.categoria ?? 'Otros'))
        if (!categoria) throw new Error(`Falta la categoría de "${p.nombre}"`)
        const respuesta = await app.catalogo.crearProducto({
          nombre: p.nombre,
          categoriaId: categoria.id,
          unidad: p.unidad ?? 'UNIDAD',
          precioCompra: p.compra,
          precioVenta: p.venta,
          stockMinimo: p.minimo,
          ...(p.stockInicial === undefined ? {} : { stockInicial: p.stockInicial }),
          confirmado: true,
        })
        if (respuesta.tipo !== 'hecho' || !respuesta.valor) {
          throw new Error(`No se creó "${p.nombre}": ${JSON.stringify(respuesta)}`)
        }
        ids[p.nombre] = respuesta.valor.productoId
      }
      await app.esperarTareasPendientes()
      return ids
    },
    { productos, nombreTienda },
  )
}

/** "15/10/2026": el día de hoy en la tienda (America/Lima, UTC−5), como en la lista compartida. */
export function hoyEnLaTienda(): string {
  const [anio, mes, dia] = new Date(Date.now() - 5 * 3_600_000)
    .toISOString()
    .slice(0, 10)
    .split('-')
  return `${dia}/${mes}/${anio}`
}
