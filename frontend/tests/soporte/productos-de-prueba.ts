import type { Aplicacion } from '@/app/composicion'
import type { Unidad } from '@/shared/domain/cantidad'

/** Un producto como lo escriben los `.feature` (tabla "Dado los productos"). */
export interface ProductoDePrueba {
  nombre: string
  /** Por defecto "Otros" (una de las categorías iniciales). Si no existe, se crea. */
  categoria?: string
  unidad?: Unidad
  compra: string
  venta: string
  minimo?: string
  stockInicial?: string
}

/** El id de la categoría con ese nombre; siembra las iniciales y crea la que falte. */
export async function categoriaDePrueba(app: Aplicacion, nombre = 'Otros'): Promise<string> {
  await app.catalogo.sembrarCategoriasIniciales()
  const existente = await app.catalogo.importacion.categoriaPorNombre(nombre)
  return existente ?? app.catalogo.crearCategoria(nombre)
}

/** Crea el producto por el caso de uso real de Catálogo (con su STOCK_INICIAL, RN-CAT-08). */
export async function crearProductoDePrueba(
  app: Aplicacion,
  producto: ProductoDePrueba,
): Promise<string> {
  const respuesta = await app.catalogo.crearProducto({
    nombre: producto.nombre,
    categoriaId: await categoriaDePrueba(app, producto.categoria),
    unidad: producto.unidad ?? 'UNIDAD',
    precioCompra: producto.compra,
    precioVenta: producto.venta,
    stockMinimo: producto.minimo ?? '0',
    ...(producto.stockInicial === undefined ? {} : { stockInicial: producto.stockInicial }),
    confirmado: true,
  })
  if (respuesta.tipo !== 'hecho') {
    throw new Error(`No se creó "${producto.nombre}": ${JSON.stringify(respuesta)}`)
  }
  return respuesta.valor.productoId
}
