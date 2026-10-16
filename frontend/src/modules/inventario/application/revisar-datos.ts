import { mensajeDeRevisionDeDatos } from '../domain/mensajes'
import { compararNormalizados, enOrdenDeRegistro } from '../domain/orden'
import {
  diferenciasDeExistencias,
  existenciasDelLibro,
  type DiferenciaDeExistencia,
} from '../domain/reglas'
import type { ContextoDeInventario } from './contexto'

export interface ResultadoDeRevision {
  mensaje: string
  corregidos: DiferenciaDeExistencia[]
}

/**
 * ADR-0002 / RN-OP-19: en una sola transacción, recalcula las existencias desde el libro,
 * corrige las que no cuadran y reconstruye cada proyección con todas las operaciones.
 */
async function reconstruir(ctx: ContextoDeInventario): Promise<DiferenciaDeExistencia[]> {
  return ctx.uow.ejecutar(async () => {
    const operaciones = enOrdenDeRegistro(await ctx.operaciones.todas())
    const delLibro = existenciasDelLibro(operaciones)
    const corregidos = diferenciasDeExistencias(await ctx.existencias.todas(), delLibro)
    if (corregidos.length > 0) await ctx.existencias.reemplazarTodas(delLibro)
    for (const proyeccion of ctx.proyecciones()) await proyeccion.reconstruir(operaciones)
    return corregidos
  })
}

/** RN-OP-19 (Ajustes → Revisar datos): corrige e informa qué cambió. */
export async function revisarDatos(ctx: ContextoDeInventario): Promise<ResultadoDeRevision> {
  const diferencias = await reconstruir(ctx)
  const productos = new Map((await ctx.catalogo().productos()).map((p) => [p.id, p]))
  const correcciones = diferencias
    .map((diferencia) => {
      const producto = productos.get(diferencia.productoId)
      return {
        diferencia,
        nombre: producto?.nombre ?? diferencia.productoId,
        unidad: producto?.unidad ?? ('UNIDAD' as const),
      }
    })
    .sort((a, b) => compararNormalizados(a.nombre, b.nombre))
  return {
    mensaje: mensajeDeRevisionDeDatos(
      correcciones.map(({ diferencia, nombre, unidad }) => ({ ...diferencia, nombre, unidad })),
    ),
    corregidos: correcciones.map((c) => c.diferencia),
  }
}

/** Recalcula existencias y proyecciones sin informar (p. ej. después de restaurar una copia). */
export async function reconstruirExistencias(ctx: ContextoDeInventario): Promise<void> {
  await reconstruir(ctx)
}
