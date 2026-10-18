import type { Dinero } from '@/shared/domain/dinero'
import type { Dia } from '@/shared/domain/fecha'
import { formatearDinero } from '@/shared/domain/formato'

/** Lo que pregunta la tarjeta del alquiler mientras el local está sin configurar (RN-AN-19). */
export const PREGUNTA_DEL_ALQUILER = '¿Pagas alquiler por tu local?'
export const BOTON_CONFIGURAR_ALQUILER = 'Configurar'

/** RN-AN-19: cuánto del alquiler del próximo pago ya está cubierto. */
export interface AvanceDelAlquiler {
  proximoPago: Dia
  monto: Dinero
  /** Ganancia neta (RN-AN-02) del periodo actual: del último pago a hoy. */
  llevas: Dinero
  /** `llevas` ≥ `monto`. */
  cubierto: boolean
  /** 100 si está cubierto; si no, ⌊llevas × 100 ÷ monto⌋ y 0 con `llevas` negativo. */
  porcentaje: number
}

export function avanceDelAlquiler(
  monto: Dinero,
  llevas: Dinero,
  proximoPago: Dia,
): AvanceDelAlquiler {
  const cubierto = llevas.centimos >= monto.centimos
  const porcentaje = cubierto
    ? 100
    : Math.max(0, Math.floor((llevas.centimos * 100) / monto.centimos))
  return { proximoPago, monto, llevas, cubierto, porcentaje }
}

/** "2026-10-20" → "20/10". */
function diaYMes(dia: Dia): string {
  const [, mes, d] = dia.split('-')
  return `${d}/${mes}`
}

/** Las dos líneas de la tarjeta, con las palabras de RN-AN-19. */
export function textosDelAlquiler(avance: AvanceDelAlquiler): [string, string] {
  const { proximoPago, monto, llevas, cubierto } = avance
  const fecha = diaYMes(proximoPago)
  return cubierto
    ? [
        `✓ Ya cubriste el local del ${fecha}`,
        `Lo que ganes de más es tuyo: llevas ${formatearDinero(llevas.restar(monto))}`,
      ]
    : [
        `Para el pago del ${fecha} llevas ${formatearDinero(llevas)} de ${formatearDinero(monto)}`,
        `Te falta ${formatearDinero(monto.restar(llevas))}`,
      ]
}
