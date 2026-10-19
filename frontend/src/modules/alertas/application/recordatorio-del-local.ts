import { diaDe } from '@/shared/domain/fecha'
import { recordatorioDelLocal, type RecordatorioDelLocal } from '../domain/recordatorio-del-local'
import type { DependenciasDeAlertas } from './modulo'

/**
 * RN-AL-10: la frase de pago del local de hoy (la línea de la tarjeta *Alquiler del local* de
 * Control; la notificación de RN-AL-11 usa la misma).
 */
export async function recordatorioVigenteDelLocal(
  d: Pick<DependenciasDeAlertas, 'reloj' | 'tienda'>,
): Promise<RecordatorioDelLocal | null> {
  const configuracion = await d.tienda().configuracion()
  return recordatorioDelLocal(configuracion.alquilerDelLocal, diaDe(d.reloj.ahora()))
}
