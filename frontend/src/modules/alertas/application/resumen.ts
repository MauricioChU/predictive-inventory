import type { SituacionDeProducto } from '@/shared/contratos/entre-modulos'
import { textoDeAtencion } from '../domain/atencion'
import type { DependenciasDeAlertas } from './modulo'

export interface ResumenDeAtencion {
  agotados: number
  porAcabarse: number
  contador: number
  texto: string
}

function contarPorEstado(situaciones: readonly SituacionDeProducto[]): {
  agotados: number
  porAcabarse: number
} {
  return {
    agotados: situaciones.filter((s) => s.estado === 'AGOTADO').length,
    porAcabarse: situaciones.filter((s) => s.estado === 'POR_ACABARSE').length,
  }
}

/** RN-AL-06: el resumen de atención de unas situaciones ya leídas (lo comparte cada evaluación). */
export function resumenDeSituaciones(
  situaciones: readonly SituacionDeProducto[],
): ResumenDeAtencion {
  const { agotados, porAcabarse } = contarPorEstado(situaciones)
  return {
    agotados,
    porAcabarse,
    contador: agotados + porAcabarse,
    texto: textoDeAtencion(agotados, porAcabarse),
  }
}

/** RN-AL-06: cuántos productos necesitan atención ahora mismo (Inicio y el botón Control). */
export async function resumenDeAtencion(
  d: Pick<DependenciasDeAlertas, 'analisis'>,
): Promise<ResumenDeAtencion> {
  return resumenDeSituaciones(await d.analisis().situaciones())
}
