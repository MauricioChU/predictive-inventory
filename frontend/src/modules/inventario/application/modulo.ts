import type { InventarioParaCatalogo } from '@/shared/contratos/entre-modulos'
import { enOrdenDeRegistro } from '../domain/orden'
import { anularOperacion, type DatosDeAnulacion } from './anulaciones'
import {
  conteoActual,
  iniciarConteoGuiado,
  responderConteo,
  saltarEnConteo,
  type EstadoDelConteo,
} from './conteo'
import type { ContextoDeInventario } from './contexto'
import { ServicioDeDeshacer } from './deshacer'
import {
  historial,
  ultimoIngresoDe,
  type FiltroDeHistorial,
  type OperacionVista,
} from './historial'
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
import { reconstruirExistencias, revisarDatos, type ResultadoDeRevision } from './revisar-datos'
import { registrarVenta, type DatosDeVenta } from './ventas'

export type { DependenciasDeInventario } from './puertos'
export type { DatosDeVenta, LineaPedida } from './ventas'
export type { DatosDeIngreso, RespuestaDeIngreso } from './ingresos'
export type { DatosDeConteo, DatosDeMerma, RespuestaDeConteo } from './mermas-y-ajustes'
export type { DatosDeAnulacion } from './anulaciones'
export type { FiltroDeHistorial, LineaDeOperacionVista, OperacionVista } from './historial'
export type { ResultadoDeRevision } from './revisar-datos'
export type { EstadoDelConteo } from './conteo'

export interface ModuloInventario {
  registrarVenta(datos: DatosDeVenta): Promise<{ operacionId: string }>
  registrarIngreso(datos: DatosDeIngreso): Promise<RespuestaDeIngreso>
  registrarMerma(datos: DatosDeMerma): Promise<{ operacionId: string }>
  contarStock(datos: DatosDeConteo): Promise<RespuestaDeConteo>
  anularOperacion(datos: DatosDeAnulacion): Promise<{ anulacionId: string }>
  deshacer: ServicioDeDeshacer
  historial(filtro?: FiltroDeHistorial): Promise<OperacionVista[]>
  revisarDatos(): Promise<ResultadoDeRevision>
  reconstruirExistencias(): Promise<void>
  iniciarConteoGuiado(): Promise<EstadoDelConteo>
  conteoActual(): Promise<EstadoDelConteo | null>
  responderConteo(contado: string): Promise<EstadoDelConteo>
  saltarEnConteo(): Promise<EstadoDelConteo>
  consultable: InventarioParaCatalogo
}

export function crearModuloInventario(d: DependenciasDeInventario): ModuloInventario {
  // RN-OP-18: deshacer = anular sin motivo. `ctx` se usa recién cuando alguien deshace.
  const deshacer = new ServicioDeDeshacer(d.reloj, (operacionId) =>
    anularOperacion(ctx, { operacionId }),
  )
  const libro = new LibroDeOperaciones({
    ...d,
    alConfirmarRegistro: (operacionId, registradaEn) => deshacer.ofrecer(operacionId, registradaEn),
  })
  const ctx: ContextoDeInventario = { ...d, libro }

  const consultable: InventarioParaCatalogo = {
    stockDe: (productoId) => d.existencias.obtener(productoId),
    existencias: () => d.existencias.todas(),
    tieneOperaciones: async (productoId) =>
      (await d.operaciones.porProducto(productoId)).length > 0,
    ultimoIngresoDe: (productoId) => ultimoIngresoDe(ctx, productoId),
    operaciones: async () => enOrdenDeRegistro(await d.operaciones.todas()),
    registrarStockInicial: (productoId, cantidad, costo) =>
      registrarStockInicial(ctx, productoId, cantidad, costo),
    retirarStock: (productoId) => retirarStock(ctx, productoId),
  }

  return {
    registrarVenta: (datos) => registrarVenta(ctx, datos),
    registrarIngreso: (datos) => registrarIngreso(ctx, datos),
    registrarMerma: (datos) => registrarMerma(ctx, datos),
    contarStock: (datos) => contarStock(ctx, datos),
    anularOperacion: (datos) => anularOperacion(ctx, datos),
    deshacer,
    historial: (filtro) => historial(ctx, filtro),
    revisarDatos: () => revisarDatos(ctx),
    reconstruirExistencias: () => reconstruirExistencias(ctx),
    iniciarConteoGuiado: () => iniciarConteoGuiado(ctx),
    conteoActual: () => conteoActual(ctx),
    responderConteo: (contado) => responderConteo(ctx, contado),
    saltarEnConteo: () => saltarEnConteo(ctx),
    consultable,
  }
}
