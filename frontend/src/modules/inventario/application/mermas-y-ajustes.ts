import type { Cantidad } from '@/shared/domain/cantidad'
import type { Dinero } from '@/shared/domain/dinero'
import type { Instante } from '@/shared/domain/fecha'
import type { ProductoResumido } from '@/shared/contratos/entre-modulos'
import { MOTIVO_CONTEO, MOTIVO_PRODUCTO_RETIRADO } from '@/shared/contratos/operaciones'
import { Operacion } from '../domain/operacion'
import { leerCantidad, leerContado } from '../domain/reglas'
import {
  datosDeProductos,
  datosDeRegistro,
  momentosDe,
  productoActivo,
  productoExistente,
  type ContextoDeInventario,
} from './contexto'
import type { EscrituraEnLibro } from './registrar'

export interface DatosDeMerma {
  productoId: string
  cantidad: string
  motivo: string
  nota?: string
  ocurridaEn?: Instante
}

export interface DatosDeConteo {
  productoId: string
  contado: string
}

export type RespuestaDeConteo =
  | { tipo: 'sin-cambios'; mensaje: 'El stock ya estaba correcto' }
  | { tipo: 'ajustado'; operacionId: string; diferencia: Cantidad }

/** HU-OP-04, RN-OP-15: con el costo vigente del producto (ADR-0004). */
export async function registrarMerma(
  ctx: ContextoDeInventario,
  datos: DatosDeMerma,
): Promise<{ operacionId: string }> {
  const momentos = momentosDe(ctx.reloj, datos.ocurridaEn)
  const producto = await productoActivo(ctx, datos.productoId)
  const cantidad = leerCantidad(datos.cantidad, producto.unidad)
  const merma = Operacion.merma(
    { ...(await datosDeRegistro(ctx, momentos, datos.nota)), motivo: datos.motivo },
    { productoId: producto.id, cantidad, costoUnitario: producto.precioCompra },
  )
  await ctx.libro.registrar(merma, datosDeProductos([producto]))
  return { operacionId: merma.id }
}

/** HU-OP-05, RN-OP-16. */
export async function contarStock(
  ctx: ContextoDeInventario,
  datos: DatosDeConteo,
): Promise<RespuestaDeConteo> {
  const producto = await productoActivo(ctx, datos.productoId)
  const contado = leerContado(datos.contado, producto.unidad)
  return ctx.libro.enTransaccion((escritura) => contarEn(ctx, escritura, producto, contado))
}

/**
 * RN-OP-16 dentro de una transacción abierta (también la usa el conteo guiado, RN-OP-21):
 * la diferencia se calcula contra el stock que hay en ESTA transacción.
 */
export async function contarEn(
  ctx: ContextoDeInventario,
  escritura: EscrituraEnLibro,
  producto: ProductoResumido,
  contado: Cantidad,
): Promise<RespuestaDeConteo> {
  const diferencia = contado.restar(await ctx.existencias.obtener(producto.id))
  if (diferencia.esCero()) return { tipo: 'sin-cambios', mensaje: 'El stock ya estaba correcto' }
  const ajuste = Operacion.ajuste(
    { ...(await datosDeRegistro(ctx, momentosDe(ctx.reloj))), motivo: MOTIVO_CONTEO },
    { productoId: producto.id, diferencia, costoUnitario: producto.precioCompra },
  )
  await escritura.registrar(ajuste, datosDeProductos([producto]))
  return { tipo: 'ajustado', operacionId: ajuste.id, diferencia }
}

/** Ola 3, ruling 2: lo que registra Catálogo (stock inicial y retiro) no ofrece Deshacer. */
const SIN_DESHACER = { ofrecerDeshacer: false } as const

/** RN-CAT-08: lo llama Catálogo al crear un producto con stock inicial (sin Deshacer). */
export async function registrarStockInicial(
  ctx: ContextoDeInventario,
  productoId: string,
  cantidad: Cantidad,
  costoUnitario: Dinero,
): Promise<void> {
  const inicial = Operacion.stockInicial(await datosDeRegistro(ctx, momentosDe(ctx.reloj)), {
    productoId,
    cantidad,
    costoUnitario,
  })
  await ctx.libro.registrar(inicial, undefined, SIN_DESHACER)
}

/**
 * RN-CAT-11: AJUSTE hasta 0 con motivo "Producto retirado"; con stock 0 no registra nada. No
 * exige que el producto esté activo: es parte de archivarlo. Sin Deshacer (ruling 2).
 */
export async function retirarStock(ctx: ContextoDeInventario, productoId: string): Promise<void> {
  const producto = await productoExistente(ctx, productoId)
  const momentos = momentosDe(ctx.reloj)
  await ctx.libro.enTransaccion(async (escritura) => {
    const stock = await ctx.existencias.obtener(productoId)
    if (!stock.esPositiva()) return
    const retiro = Operacion.ajuste(
      { ...(await datosDeRegistro(ctx, momentos)), motivo: MOTIVO_PRODUCTO_RETIRADO },
      { productoId, diferencia: stock.negar(), costoUnitario: producto.precioCompra },
    )
    await escritura.registrar(retiro, datosDeProductos([producto]), SIN_DESHACER)
  })
}
