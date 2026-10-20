import type { Page } from '@playwright/test'

/**
 * Plan 12: ayudantes para preparar datos de las E2E de operaciones por los casos de uso REALES
 * de la app (`window.__aplicacion`, solo en desarrollo o con un navegador automatizado; ver
 * src/app/ganchos-de-prueba.ts). Nada entra por los repositorios ni por Dexie.
 */
interface AplicacionEnLaPagina {
  catalogo: {
    listarCategorias(): Promise<{ id: string; nombre: string }[]>
    crearProducto(datos: Record<string, unknown>): Promise<{
      tipo: string
      valor?: { productoId: string }
    }>
    obtenerProducto(id: string): Promise<{ precioCompra: { centimos: number } } | null>
  }
  inventario: {
    registrarVenta(datos: { lineas: { productoId: string; cantidad: string }[] }): Promise<{
      operacionId: string
    }>
    consultable: { stockDe(productoId: string): Promise<{ milesimas: number }> }
  }
  analisis: { cambiarCantidadEnLista(productoId: string, cantidad: string): Promise<void> }
  esperarTareasPendientes(): Promise<void>
}
type VentanaConAplicacion = Window & { __aplicacion?: AplicacionEnLaPagina }

export interface ProductoNuevo {
  nombre: string
  unidad?: 'UNIDAD' | 'KILO' | 'LITRO'
  compra: string
  venta: string
  minimo?: string
  stock?: string
}

/** Crea un producto (con su stock inicial) en la categoría "Otros"; devuelve su id. */
export async function crearProducto(page: Page, producto: ProductoNuevo): Promise<string> {
  return page.evaluate(async (p) => {
    const aplicacion = (window as VentanaConAplicacion).__aplicacion
    if (!aplicacion) throw new Error('La app no expuso window.__aplicacion')
    const categorias = await aplicacion.catalogo.listarCategorias()
    const otros = categorias.find((c) => c.nombre === 'Otros') ?? categorias[0]
    const respuesta = await aplicacion.catalogo.crearProducto({
      nombre: p.nombre,
      categoriaId: otros!.id,
      unidad: p.unidad ?? 'UNIDAD',
      precioCompra: p.compra,
      precioVenta: p.venta,
      stockMinimo: p.minimo ?? '0',
      stockInicial: p.stock ?? '0',
      confirmado: true,
    })
    if (!respuesta.valor) throw new Error(`No se creó ${p.nombre}: ${JSON.stringify(respuesta)}`)
    await aplicacion.esperarTareasPendientes()
    return respuesta.valor.productoId
  }, producto)
}

export async function venderPorCasoDeUso(
  page: Page,
  productoId: string,
  cantidad: string,
): Promise<void> {
  await page.evaluate(
    async ({ id, n }) => {
      const aplicacion = (window as VentanaConAplicacion).__aplicacion
      if (!aplicacion) throw new Error('La app no expuso window.__aplicacion')
      await aplicacion.inventario.registrarVenta({ lineas: [{ productoId: id, cantidad: n }] })
      await aplicacion.esperarTareasPendientes()
    },
    { id: productoId, n: cantidad },
  )
}

/** RN-AN-08: un cambio en la lista Para comprar de hoy (se recuerda hasta el fin del día). */
export async function cambiarCantidadEnLista(
  page: Page,
  productoId: string,
  cantidad: string,
): Promise<void> {
  await page.evaluate(
    async ({ id, n }) => {
      const aplicacion = (window as VentanaConAplicacion).__aplicacion
      if (!aplicacion) throw new Error('La app no expuso window.__aplicacion')
      await aplicacion.analisis.cambiarCantidadEnLista(id, n)
    },
    { id: productoId, n: cantidad },
  )
}

/** Stock actual en milésimas → número de la unidad (10000 → 10). */
export async function stockDe(page: Page, productoId: string): Promise<number> {
  const milesimas = await page.evaluate(async (id) => {
    const aplicacion = (window as VentanaConAplicacion).__aplicacion
    if (!aplicacion) throw new Error('La app no expuso window.__aplicacion')
    return (await aplicacion.inventario.consultable.stockDe(id)).milesimas
  }, productoId)
  return milesimas / 1000
}

export async function precioDeCompraDe(page: Page, productoId: string): Promise<number> {
  return page.evaluate(async (id) => {
    const aplicacion = (window as VentanaConAplicacion).__aplicacion
    if (!aplicacion) throw new Error('La app no expuso window.__aplicacion')
    return (await aplicacion.catalogo.obtenerProducto(id))?.precioCompra.centimos ?? -1
  }, productoId)
}

/** Los tres productos del Antecedente de operaciones.feature. */
export const LEJIA: ProductoNuevo = {
  nombre: 'Lejía 1 L',
  compra: '2.40',
  venta: '3.50',
  minimo: '3',
  stock: '10',
}
export const CARBON: ProductoNuevo = {
  nombre: 'Carbón',
  unidad: 'KILO',
  compra: '2.75',
  venta: '4.00',
  minimo: '3',
  stock: '10',
}
export const DETERGENTE: ProductoNuevo = {
  nombre: 'Detergente a granel',
  unidad: 'KILO',
  compra: '5.30',
  venta: '7.90',
  minimo: '2',
  stock: '5',
}

/**
 * Trozos de texto (separados por espacios normales) de los elementos de `selector` que quedaron
 * partidos entre dos líneas: "Vo|lver", "S/ 2|.60" o "1|L". Un monto con espacios duros
 * ("S/ 2.60", "12 unid.") es UN trozo. Mismo criterio que la E2E del kit B.
 */
export async function trozosPartidos(page: Page, selector: string): Promise<string[]> {
  return page.evaluate((sel) => {
    const partidos: string[] = []
    for (const elemento of document.querySelectorAll(sel)) {
      const textos = document.createTreeWalker(elemento, NodeFilter.SHOW_TEXT)
      for (let nodo = textos.nextNode(); nodo; nodo = textos.nextNode()) {
        let inicio = 0
        for (const trozo of (nodo.textContent ?? '').split(' ')) {
          const rango = document.createRange()
          rango.setStart(nodo, inicio)
          rango.setEnd(nodo, inicio + trozo.length)
          const lineas = new Set([...rango.getClientRects()].map((r) => Math.round(r.top)))
          if (lineas.size > 1) partidos.push(trozo)
          inicio += trozo.length + 1
        }
      }
    }
    return partidos
  }, selector)
}

/**
 * RN-UX-02: todo lo tocable dentro de la pantalla mide al menos 48 × 48 px (los campos, 48 de
 * alto) y las acciones principales al menos 56 de alto. Devuelve lo que no cumple, legible.
 */
export async function tocablesChicos(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const chicos: string[] = []
    const visible = (el: Element) => {
      const caja = el.getBoundingClientRect()
      return caja.width > 0 && caja.height > 0 && !el.closest('dialog:not([open])')
    }
    const nombre = (el: Element) =>
      `${el.tagName.toLowerCase()}.${[...el.classList].join('.')} "${(el.textContent ?? '').trim().slice(0, 30)}"`
    const contenido = document.getElementById('contenido')!
    const dialogos = [...document.querySelectorAll('dialog[open]')]
    const raices = [contenido, ...dialogos]
    for (const raiz of raices) {
      for (const el of raiz.querySelectorAll('button, a[href], [role="radio"]')) {
        if (!visible(el)) continue
        const caja = el.getBoundingClientRect()
        if (caja.width < 47.5 || caja.height < 47.5) {
          chicos.push(`${nombre(el)} ${Math.round(caja.width)}×${Math.round(caja.height)}`)
        }
      }
      for (const el of raiz.querySelectorAll('input')) {
        if (!visible(el)) continue
        const caja = el.getBoundingClientRect()
        if (caja.height < 47.5) chicos.push(`${nombre(el)} alto ${Math.round(caja.height)}`)
      }
      for (const el of raiz.querySelectorAll(
        '.boton-principal, .botones-de-opcion .opcion',
      )) {
        if (!visible(el)) continue
        const caja = el.getBoundingClientRect()
        if (caja.height < 55.5)
          chicos.push(`principal ${nombre(el)} alto ${Math.round(caja.height)}`)
      }
    }
    return chicos
  })
}
