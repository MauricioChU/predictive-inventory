import { diaDe, sumarDias } from '@/shared/domain/fecha'
import { lineasDelResumenDelDia, textoDeAtencion } from '../domain/atencion'
import type { DependenciasDeAlertas } from './modulo'

export interface ResumenDeAtencion {
  agotados: number
  porAcabarse: number
  contador: number
  texto: string
}

export interface ResumenDelDia {
  lineas: string[]
}

async function contarPorEstado(
  d: Pick<DependenciasDeAlertas, 'analisis'>,
): Promise<{ agotados: number; porAcabarse: number }> {
  const situaciones = await d.analisis().situaciones()
  return {
    agotados: situaciones.filter((s) => s.estado === 'AGOTADO').length,
    porAcabarse: situaciones.filter((s) => s.estado === 'POR_ACABARSE').length,
  }
}

/** RN-AL-06: cuántos productos necesitan atención ahora mismo (Inicio y el botón Control). */
export async function resumenDeAtencion(
  d: Pick<DependenciasDeAlertas, 'analisis'>,
): Promise<ResumenDeAtencion> {
  const { agotados, porAcabarse } = await contarPorEstado(d)
  return {
    agotados,
    porAcabarse,
    contador: agotados + porAcabarse,
    texto: textoDeAtencion(agotados, porAcabarse),
  }
}

/** RN-AL-09: la tarjeta del resumen del día, o `null` si ya se mostró hoy. */
export async function resumenDelDia(
  d: Pick<DependenciasDeAlertas, 'analisis' | 'reloj' | 'tienda'>,
): Promise<ResumenDelDia | null> {
  const estado = await d.tienda().estadoDelSistema()
  const hoy = diaDe(d.reloj.ahora())
  if (estado.ultimoResumenDelDiaMostrado === hoy) return null

  const { agotados, porAcabarse } = await contarPorEstado(d)
  const ayer = sumarDias(hoy, -1)
  const totalesDeAyer = await d.analisis().totalesDelDia(ayer)
  return { lineas: lineasDelResumenDelDia(agotados, porAcabarse, totalesDeAyer) }
}

/** RN-AL-09: cierra la tarjeta; no vuelve a salir hasta el siguiente día de negocio. */
export async function cerrarResumenDelDia(
  d: Pick<DependenciasDeAlertas, 'reloj' | 'tienda' | 'uow'>,
): Promise<void> {
  const hoy = diaDe(d.reloj.ahora())
  await d.uow.ejecutar(() =>
    d.tienda().actualizarEstadoDelSistema({ ultimoResumenDelDiaMostrado: hoy }),
  )
}
