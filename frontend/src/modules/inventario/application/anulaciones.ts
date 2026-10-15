import type { ProductoResumido } from '@/shared/contratos/entre-modulos'
import { Operacion } from '../domain/operacion'
import { exigirOperacion, exigirSinAnular } from '../domain/reglas'
import {
  datosDeProductos,
  datosDeRegistro,
  momentosDe,
  type ContextoDeInventario,
} from './contexto'

export interface DatosDeAnulacion {
  operacionId: string
  motivo?: string
}

/**
 * RN-OP-02 / RN-OP-17: invierte todos los movimientos de la operación; una sola vez y nunca
 * sobre una ANULACION. Se rechaza si dejaría stock negativo (RN-OP-05). Vale también para
 * operaciones de productos ya archivados (excepción de RN-OP-08).
 */
export async function anularOperacion(
  ctx: ContextoDeInventario,
  datos: DatosDeAnulacion,
): Promise<{ anulacionId: string }> {
  const original = Operacion.desdeRegistro(
    exigirOperacion(await ctx.operaciones.porId(datos.operacionId)),
  )
  const anulacion = Operacion.anulacionDe(original, {
    ...(await datosDeRegistro(ctx, momentosDe(ctx.reloj))),
    motivo: datos.motivo,
  })
  const productos = await productosConocidos(ctx, original.productoIds)
  await ctx.libro.enTransaccion(async (escritura) => {
    exigirSinAnular(await ctx.operaciones.anulacionDe(original.id))
    await escritura.anular(original, anulacion, datosDeProductos(productos))
  })
  return { anulacionId: anulacion.id }
}

async function productosConocidos(
  ctx: ContextoDeInventario,
  productoIds: readonly string[],
): Promise<ProductoResumido[]> {
  const productos: ProductoResumido[] = []
  for (const productoId of productoIds) {
    const producto = await ctx.catalogo().producto(productoId)
    if (producto) productos.push(producto)
  }
  return productos
}
