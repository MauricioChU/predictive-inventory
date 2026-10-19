import type { AlquilerDelLocal } from '@/shared/contratos/configuracion'
import { diasEntre, type Dia } from '@/shared/domain/fecha'
import { siguientePagoDesde } from '@/shared/domain/fechas-de-pago'
import { Dinero } from '@/shared/domain/dinero'
import { formatearDinero } from '@/shared/domain/formato'

export interface RecordatorioDelLocal {
  fechaDePago: Dia
  texto: string
}

/** RN-AL-11: tocar la notificación del pago abre Control. Su `url` es también su etiqueta propia. */
export const RUTA_DE_CONTROL = '/control'

const VENTANA_EN_DIAS = 2

const ANTICIPOS = ['Hoy', 'Mañana', 'Pasado mañana'] as const

/**
 * RN-AL-10: `null` si no hay pago configurado o la siguiente fecha de pago (igual o posterior
 * a hoy) está a más de 2 días; si no, la frase de Inicio, del resumen del día y de la notificación.
 */
export function recordatorioDelLocal(
  alquiler: AlquilerDelLocal | null,
  hoy: Dia,
): RecordatorioDelLocal | null {
  if (alquiler === null || alquiler.tipo === 'NO_PAGA') return null
  const fechaDePago = siguientePagoDesde(alquiler.dias, hoy)
  const faltan = diasEntre(hoy, fechaDePago)
  if (faltan > VENTANA_EN_DIAS) return null
  const monto = formatearDinero(Dinero.deCentimos(alquiler.montoCentimos))
  return { fechaDePago, texto: `${ANTICIPOS[faltan]} pagas el local: ${monto}` }
}
