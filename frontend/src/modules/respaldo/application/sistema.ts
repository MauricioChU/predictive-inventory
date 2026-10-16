import { diaDe } from '../../../shared/domain/fecha'
import { mensajeDeRecordatorio } from '../domain/recordatorio'
import type { DependenciasDeRespaldo } from './puertos'

/** RN-RE-06/09: mensaje del recordatorio de copia, o `null` si todavía no toca avisar. */
export async function recordatorioDeCopia(deps: DependenciasDeRespaldo): Promise<string | null> {
  const estado = await deps.tienda().estadoDelSistema()
  return mensajeDeRecordatorio({
    ultimoRespaldoEn: estado.ultimoRespaldoEn,
    almacenamientoPersistente: estado.almacenamientoPersistente,
    hoy: diaDe(deps.reloj.ahora()),
  })
}

/** RN-RE-09: solo pregunta si todavía no se sabe la respuesta; guarda lo que conteste. */
export async function solicitarAlmacenamientoSiHaceFalta(
  deps: DependenciasDeRespaldo,
): Promise<void> {
  const estado = await deps.tienda().estadoDelSistema()
  if (estado.almacenamientoPersistente !== 'DESCONOCIDO') return

  const concedido = await deps.almacenamiento.solicitar()
  await deps.tienda().actualizarEstadoDelSistema({
    almacenamientoPersistente: concedido ? 'CONCEDIDO' : 'RECHAZADO',
  })
}
