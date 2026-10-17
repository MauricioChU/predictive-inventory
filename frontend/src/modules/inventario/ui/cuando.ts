import { instanteLocal, sumarDias, type Dia, type Instante } from '@/shared/domain/fecha'
import { DIAS_HACIA_ATRAS, ELIGE_LA_FECHA_Y_LA_HORA } from '../domain/reglas'

/** RN-OP-09: cuándo ocurrió la operación, tal como lo eligió la persona. */
export interface Cuando {
  modo: 'ahora' | 'otro'
  /** "2026-10-14" (lo que da un <input type="date">). */
  dia: Dia
  /** "18:30" (lo que da un <input type="time">). */
  hora: string
}

/** Junto a qué campo va un error de la fecha. */
export type CampoDeLaFecha = 'dia' | 'hora'

export interface ErrorDeFecha {
  mensaje: string
  campo: CampoDeLaFecha
}

/** "Otro día" arranca en ayer: lo más común es anotar algo que se olvidó ayer (HU-OP-07). */
export function cuandoInicial(hoy: Dia): Cuando {
  return { modo: 'ahora', dia: sumarDias(hoy, -1), hora: '' }
}

/** r1 M6 (RN-OP-09): los días que se pueden elegir, de hace 7 días a hoy (hora de la tienda). */
export function diasPermitidos(hoy: Dia): { min: Dia; max: Dia } {
  return { min: sumarDias(hoy, -DIAS_HACIA_ATRAS), max: hoy }
}

/** Los códigos del dominio que se muestran junto a la fecha, y junto a qué campo. */
const CAMPO_DE_LOS_ERRORES_DE_FECHA: Readonly<Record<string, CampoDeLaFecha>> = {
  FECHA_FUTURA: 'dia',
  FECHA_ANTIGUA: 'dia',
  FECHA_INVALIDA: 'dia',
  FECHA_SIN_HORA: 'hora',
}

/** Si el error del caso de uso es de la fecha, dónde mostrarlo; si no, undefined. */
export function errorDeFechaDelDominio(
  codigo: string | undefined,
  mensaje: string,
): ErrorDeFecha | undefined {
  const campo = codigo ? CAMPO_DE_LOS_ERRORES_DE_FECHA[codigo] : undefined
  return campo ? { mensaje, campo } : undefined
}

/**
 * El instante en hora de la tienda (America/Lima) para `ocurridaEn`, o `undefined` si es ahora.
 * Sin día o sin hora, el mensaje de la spec ("Elige la fecha y la hora") junto al campo que
 * falta; los límites (7 días, nunca futura) los valida el caso de uso.
 */
export function instanteDe(cuando: Cuando): { instante?: Instante; error?: ErrorDeFecha } {
  if (cuando.modo === 'ahora') return {}
  if (!/^\d{4}-\d{2}-\d{2}$/.test(cuando.dia)) {
    return { error: { mensaje: ELIGE_LA_FECHA_Y_LA_HORA, campo: 'dia' } }
  }
  if (!/^\d{2}:\d{2}$/.test(cuando.hora)) {
    return { error: { mensaje: ELIGE_LA_FECHA_Y_LA_HORA, campo: 'hora' } }
  }
  try {
    return { instante: instanteLocal(`${cuando.dia} ${cuando.hora}`) }
  } catch {
    // Un día que no existe en el calendario.
    return { error: { mensaje: ELIGE_LA_FECHA_Y_LA_HORA, campo: 'dia' } }
  }
}
