import { diaDe, diasEntre, type Dia, type Instante } from '../../../shared/domain/fecha'
import type { EstadoDeAlmacenamiento } from '../../../shared/contratos/configuracion'

export interface DatosParaRecordatorio {
  ultimoRespaldoEn: Instante | null
  almacenamientoPersistente: EstadoDeAlmacenamiento
  hoy: Dia
}

/**
 * RN-RE-06/RN-RE-09: mensaje del recordatorio de copia, o `null` si todavía no toca avisar.
 * El umbral es de 3 días si el almacenamiento persistente fue rechazado; si no, 7 días.
 */
export function mensajeDeRecordatorio(datos: DatosParaRecordatorio): string | null {
  if (datos.ultimoRespaldoEn === null) return 'Todavía no guardas una copia de tus datos'

  const umbral = datos.almacenamientoPersistente === 'RECHAZADO' ? 3 : 7
  const dias = diasEntre(diaDe(datos.ultimoRespaldoEn), datos.hoy)
  if (dias >= umbral) return `Hace ${dias} días que no guardas una copia`

  return null
}
