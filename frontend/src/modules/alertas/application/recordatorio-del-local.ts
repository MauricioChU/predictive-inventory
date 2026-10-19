import { diaDe } from '@/shared/domain/fecha'
import { recordatorioDelLocal, type RecordatorioDelLocal } from '../domain/recordatorio-del-local'
import type { DependenciasDeAlertas } from './modulo'

/**
 * RN-AL-10: la frase de pago del local de hoy, sin tener en cuenta que se cerró la tarjeta de
 * Inicio (el resumen del día y la notificación la usan igual).
 */
export async function recordatorioVigenteDelLocal(
  d: Pick<DependenciasDeAlertas, 'reloj' | 'tienda'>,
): Promise<RecordatorioDelLocal | null> {
  const configuracion = await d.tienda().configuracion()
  return recordatorioDelLocal(configuracion.alquilerDelLocal, diaDe(d.reloj.ahora()))
}

/** RN-AL-10: la tarjeta de Inicio, o `null` si no hay recordatorio o ya se cerró hoy. */
export async function recordatorioDelLocalDeHoy(
  d: Pick<DependenciasDeAlertas, 'reloj' | 'tienda'>,
): Promise<RecordatorioDelLocal | null> {
  const recordatorio = await recordatorioVigenteDelLocal(d)
  if (recordatorio === null) return null
  const estado = await d.tienda().estadoDelSistema()
  return estado.recordatorioDelLocalCerradoEl === diaDe(d.reloj.ahora()) ? null : recordatorio
}

/** RN-AL-10: *Entendido* cierra la tarjeta de Inicio hasta el día siguiente. */
export async function cerrarRecordatorioDelLocal(
  d: Pick<DependenciasDeAlertas, 'reloj' | 'tienda' | 'uow'>,
): Promise<void> {
  const hoy = diaDe(d.reloj.ahora())
  await d.uow.ejecutar(() =>
    d.tienda().actualizarEstadoDelSistema({ recordatorioDelLocalCerradoEl: hoy }),
  )
}
