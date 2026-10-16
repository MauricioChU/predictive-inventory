import { ErrorDeDominio } from '@/shared/domain/errores'
import type { ProductoRegistro } from '@/shared/contratos/registros'
import { Producto } from '../domain/producto'
import type { DependenciasDeCatalogo } from './modulo'

async function obtenerRegistro(
  deps: DependenciasDeCatalogo,
  productoId: string,
): Promise<ProductoRegistro> {
  const registro = await deps.productos.porId(productoId)
  if (!registro) throw new ErrorDeDominio('PRODUCTO_NO_ENCONTRADO', 'No encontramos ese producto')
  return registro
}

/** RN-CAT-14: reduce y comprime la foto antes de guardarla, y marca el producto con foto. */
export async function guardarFoto(
  productoId: string,
  imagen: Blob,
  deps: DependenciasDeCatalogo,
): Promise<void> {
  await obtenerRegistro(deps, productoId) // falla temprano si el producto no existe
  // Lo lento (decodificar y comprimir) va FUERA de la unidad de trabajo.
  const reducida = await deps.procesadorDeFotos.reducir(imagen)

  await deps.uow.ejecutar(async () => {
    // Se relee dentro: no se pisa una edición concurrente con una copia vieja.
    const producto = Producto.desdeRegistro(await obtenerRegistro(deps, productoId))
    producto.marcarFoto(true, deps.reloj.ahora())
    await deps.fotos.guardar({ productoId, imagen: reducida })
    await deps.productos.guardar(producto.aRegistro())
  })
}

export async function obtenerFoto(
  productoId: string,
  deps: DependenciasDeCatalogo,
): Promise<Blob | null> {
  return deps.fotos.obtener(productoId)
}

/** Quita la foto del producto (vuelve a mostrarse el ícono de su categoría). */
export async function quitarFoto(productoId: string, deps: DependenciasDeCatalogo): Promise<void> {
  await obtenerRegistro(deps, productoId) // falla temprano si el producto no existe

  await deps.uow.ejecutar(async () => {
    const producto = Producto.desdeRegistro(await obtenerRegistro(deps, productoId))
    producto.marcarFoto(false, deps.reloj.ahora())
    await deps.fotos.eliminar(productoId)
    await deps.productos.guardar(producto.aRegistro())
  })
}
