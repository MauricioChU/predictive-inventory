import { instanteLocal, sumarDias, type Dia, type Instante } from '@/shared/domain/fecha'
import { ELIGE_LA_FECHA_Y_LA_HORA } from '../domain/reglas'

/** RN-OP-09: cuándo ocurrió la operación, tal como lo eligió la persona. */
export interface Cuando {
  modo: 'ahora' | 'otro'
  /** "2026-10-14" (lo que da un <input type="date">). */
  dia: Dia
  /** "18:30" (lo que da un <input type="time">). */
  hora: string
}

/** "Otro día" arranca en ayer: lo más común es anotar algo que se olvidó ayer (HU-OP-07). */
export function cuandoInicial(hoy: Dia): Cuando {
  return { modo: 'ahora', dia: sumarDias(hoy, -1), hora: '' }
}

/** Los códigos del dominio que se muestran junto a la fecha. */
export const ERRORES_DE_FECHA = new Set([
  'FECHA_FUTURA',
  'FECHA_ANTIGUA',
  'FECHA_SIN_HORA',
  'FECHA_INVALIDA',
])

/**
 * El instante en hora de la tienda (America/Lima) para `ocurridaEn`, o `undefined` si es ahora.
 * Sin día o sin hora, el mensaje de la spec ("Elige la fecha y la hora"); los límites (7 días,
 * nunca futura) los valida el caso de uso.
 */
export function instanteDe(cuando: Cuando): { instante?: Instante; error?: string } {
  if (cuando.modo === 'ahora') return {}
  if (!/^\d{4}-\d{2}-\d{2}$/.test(cuando.dia) || !/^\d{2}:\d{2}$/.test(cuando.hora)) {
    return { error: ELIGE_LA_FECHA_Y_LA_HORA }
  }
  try {
    return { instante: instanteLocal(`${cuando.dia} ${cuando.hora}`) }
  } catch {
    return { error: ELIGE_LA_FECHA_Y_LA_HORA } // un día que no existe en el calendario
  }
}
