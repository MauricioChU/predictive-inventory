import type { Instante } from '@/shared/domain/fecha'
import type { Reloj } from '@/shared/domain/reloj'
import type { ProductoResumido } from '@/shared/contratos/entre-modulos'
import type { DatosDeRegistro } from '../domain/operacion'
import {
  exigirProducto,
  exigirProductoActivo,
  normalizarInstante,
  validarFecha,
  type DatosDeProducto,
} from '../domain/reglas'
import type { DependenciasDeInventario } from './puertos'
import type { LibroDeOperaciones } from './registrar'

/** Lo que comparten los casos de uso del módulo. */
export interface ContextoDeInventario extends DependenciasDeInventario {
  libro: LibroDeOperaciones
}

export interface Momentos {
  ocurridaEn: Instante
  registradaEn: Instante
}

/**
 * RN-OP-09: por defecto ahora; si se indica, hasta 7 días atrás y nunca futura, guardada
 * como instante ISO en UTC.
 */
export function momentosDe(reloj: Reloj, ocurridaEn?: Instante): Momentos {
  const ahora = reloj.ahora()
  const cuando = ocurridaEn === undefined ? ahora : normalizarInstante(ocurridaEn)
  validarFecha(cuando, ahora)
  return { ocurridaEn: cuando, registradaEn: ahora }
}

/** Id nuevo, momentos y dispositivo que registra (spec 02, modelo de Operación). */
export async function datosDeRegistro(
  ctx: ContextoDeInventario,
  momentos: Momentos,
  nota?: string,
): Promise<DatosDeRegistro> {
  const { dispositivoId } = await ctx.tienda().estadoDelSistema()
  return { id: ctx.ids.nuevo(), ...momentos, dispositivoId, nota }
}

/** RN-OP-08: el producto existe y está activo. */
export async function productoActivo(
  ctx: ContextoDeInventario,
  productoId: string,
): Promise<ProductoResumido> {
  return exigirProductoActivo(await ctx.catalogo().producto(productoId))
}

/** El producto existe (activo o archivado). */
export async function productoExistente(
  ctx: ContextoDeInventario,
  productoId: string,
): Promise<ProductoResumido> {
  return exigirProducto(await ctx.catalogo().producto(productoId))
}

/** Nombre y unidad de cada producto, para el mensaje de RN-OP-05. */
export function datosDeProductos(
  productos: readonly ProductoResumido[],
): Map<string, DatosDeProducto> {
  return new Map(productos.map((p) => [p.id, { nombre: p.nombre, unidad: p.unidad }]))
}
