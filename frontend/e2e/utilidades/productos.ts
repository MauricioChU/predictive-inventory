import type { Page } from '@playwright/test'

/**
 * Plan 11: ayudantes de las E2E de Productos. Preparan datos con los casos de uso reales de la
 * app (window.__aplicacion, src/app/ganchos-de-prueba.ts), nunca tocando la base directo.
 */

export interface ProductoParaPrueba {
  nombre: string
  /** Una de las categorías iniciales; por defecto "Otros". */
  categoria?: string
  unidad?: 'UNIDAD' | 'KILO' | 'LITRO'
  compra: string
  venta: string
  minimo?: string
  stockInicial?: string
  /** Se archiva después de crearlo (RN-CAT-11: confirmando el retiro si tiene stock). */
  archivado?: boolean
}

/** Lo que estas pruebas usan de la aplicación real. */
interface AplicacionEnLaPagina {
  catalogo: {
    importacion: { categoriaPorNombre(nombre: string): Promise<string | null> }
    crearProducto(
      datos: Record<string, unknown>,
    ): Promise<{ tipo: string; valor?: { productoId: string } }>
    archivarProducto(datos: { productoId: string; confirmado: boolean }): Promise<unknown>
  }
  inventario: {
    registrarVenta(datos: { lineas: { productoId: string; cantidad: string }[] }): Promise<unknown>
  }
  esperarTareasPendientes(): Promise<void>
}
type VentanaConAplicacion = Window & { __aplicacion?: AplicacionEnLaPagina }

/**
 * Crea los productos (después de `abrir`, con la app ya montada) y devuelve sus ids por nombre.
 * Recargar o volver a abrir la pantalla muestra los datos nuevos.
 */
export async function crearProductos(
  page: Page,
  productos: readonly ProductoParaPrueba[],
): Promise<Record<string, string>> {
  return page.evaluate(async (lista) => {
    const app = (window as VentanaConAplicacion).__aplicacion
    if (!app) throw new Error('La app no expuso window.__aplicacion')
    const ids: Record<string, string> = {}
    for (const p of lista) {
      const categoriaId = await app.catalogo.importacion.categoriaPorNombre(p.categoria ?? 'Otros')
      if (!categoriaId) throw new Error(`No existe la categoría ${p.categoria}`)
      const respuesta = await app.catalogo.crearProducto({
        nombre: p.nombre,
        categoriaId,
        unidad: p.unidad ?? 'UNIDAD',
        precioCompra: p.compra,
        precioVenta: p.venta,
        stockMinimo: p.minimo ?? '0',
        stockInicial: p.stockInicial ?? '0',
        confirmado: true,
      })
      const id = respuesta.valor?.productoId
      if (respuesta.tipo !== 'hecho' || !id) throw new Error(`No se creó ${p.nombre}`)
      if (p.archivado) await app.catalogo.archivarProducto({ productoId: id, confirmado: true })
      ids[p.nombre] = id
    }
    await app.esperarTareasPendientes()
    return ids
  }, productos)
}

const MS_POR_DIA = 24 * 60 * 60 * 1000

/**
 * Un producto con historia de ventas (para la tendencia y la cobertura del detalle): se crea
 * `creadoHaceDias` días atrás y se vende en los días indicados, moviendo el reloj de la página
 * (requiere `page.clock.install()` antes de abrir la app). Al terminar, el reloj vuelve a `ahora`.
 */
export async function crearConHistoria(
  page: Page,
  producto: ProductoParaPrueba,
  creadoHaceDias: number,
  ventas: readonly { haceDias: number; cantidad: string }[],
  ahora: number,
): Promise<string> {
  await page.clock.setSystemTime(ahora - creadoHaceDias * MS_POR_DIA)
  const { [producto.nombre]: id } = await crearProductos(page, [producto])
  for (const venta of ventas) {
    await page.clock.setSystemTime(ahora - venta.haceDias * MS_POR_DIA)
    await page.evaluate(
      async ({ productoId, cantidad }) => {
        const app = (window as VentanaConAplicacion).__aplicacion
        if (!app) throw new Error('La app no expuso window.__aplicacion')
        await app.inventario.registrarVenta({ lineas: [{ productoId, cantidad }] })
        await app.esperarTareasPendientes()
      },
      { productoId: id!, cantidad: venta.cantidad },
    )
  }
  await page.clock.setSystemTime(ahora)
  return id!
}

/** Un PNG de 1 × 1 px: una foto de verdad que el navegador puede decodificar y reducir. */
export const FOTO_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64',
)

/** Mide, dentro de #contenido, lo tocable que es más chico de lo que pide RN-UX-02. */
export async function objetivosChicos(
  page: Page,
): Promise<{ chicos: string[]; principalesBajos: string[] }> {
  return page.locator('#contenido').evaluate((raiz) => {
    const visibles = (selector: string) =>
      [...raiz.querySelectorAll(selector)]
        .map((el) => ({ el, r: el.getBoundingClientRect() }))
        .filter(({ r }) => r.width > 0 && r.height > 0)
    const describir = ({ el, r }: { el: Element; r: DOMRect }) =>
      `${el.tagName.toLowerCase()}.${[...el.classList].join('.')} "${(el.textContent ?? '').trim().slice(0, 30)}" ${Math.round(r.width)}×${Math.round(r.height)}`
    return {
      chicos: visibles('button, input:not([type="file"]), a')
        .filter(({ r }) => r.width < 47.5 || r.height < 47.5)
        .map(describir),
      principalesBajos: visibles('.boton-principal, .buscador-grande .caja')
        .filter(({ r }) => r.height < 55.5)
        .map(describir),
    }
  })
}
