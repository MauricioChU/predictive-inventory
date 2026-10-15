import type { InventarioParaCatalogo } from '@/shared/contratos/entre-modulos'
import type { ContextoDeInventario } from './contexto'
import { registrarIngreso, type DatosDeIngreso, type RespuestaDeIngreso } from './ingresos'
import {
  contarStock,
  registrarMerma,
  registrarStockInicial,
  retirarStock,
  type DatosDeConteo,
  type DatosDeMerma,
  type RespuestaDeConteo,
} from './mermas-y-ajustes'
import type { DependenciasDeInventario } from './puertos'
import { LibroDeOperaciones } from './registrar'
import { registrarVenta, type DatosDeVenta } from './ventas'

export type { DependenciasDeInventario } from './puertos'
export type { DatosDeVenta, LineaPedida } from './ventas'
export type { DatosDeIngreso, RespuestaDeIngreso } from './ingresos'
export type { DatosDeConteo, DatosDeMerma, RespuestaDeConteo } from './mermas-y-ajustes'

export interface ModuloInventario {
  registrarVenta(datos: DatosDeVenta): Promise<{ operacionId: string }>
  registrarIngreso(datos: DatosDeIngreso): Promise<RespuestaDeIngreso>
  registrarMerma(datos: DatosDeMerma): Promise<{ operacionId: string }>
  contarStock(datos: DatosDeConteo): Promise<RespuestaDeConteo>
  consultable: InventarioParaCatalogo
}

export function crearModuloInventario(d: DependenciasDeInventario): ModuloInventario {
  const libro = new LibroDeOperaciones({ ...d, alConfirmarRegistro: () => undefined })
  const ctx: ContextoDeInventario = { ...d, libro }

  const consultable: InventarioParaCatalogo = {
    stockDe: (productoId) => d.existencias.obtener(productoId),
    existencias: () => d.existencias.todas(),
    tieneOperaciones: async (productoId) =>
      (await d.operaciones.porProducto(productoId)).length > 0,
    ultimoIngresoDe: async () => null,
    operaciones: () => d.operaciones.todas(),
    registrarStockInicial: (productoId, cantidad, costo) =>
      registrarStockInicial(ctx, productoId, cantidad, costo),
    retirarStock: (productoId) => retirarStock(ctx, productoId),
  }

  return {
    registrarVenta: (datos) => registrarVenta(ctx, datos),
    registrarIngreso: (datos) => registrarIngreso(ctx, datos),
    registrarMerma: (datos) => registrarMerma(ctx, datos),
    contarStock: (datos) => contarStock(ctx, datos),
    consultable,
  }
}
