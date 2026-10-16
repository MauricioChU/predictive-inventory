import { diaDeLaSemana, diasEntre, type Dia } from '@/shared/domain/fecha'
import { formatearDia } from '@/shared/domain/formato'

/** Índice 1 = lunes … 7 = domingo, como `diaDeLaSemana`. Con mayúscula: van solos de encabezado. */
const NOMBRES = ['', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']

/** Hasta cuántos días atrás se nombra el día ("Lunes 12"); más atrás va la fecha completa. */
const DIAS_CON_NOMBRE = 7

/**
 * Encabezado de un día en las listas agrupadas (Historial): "Hoy", "Ayer", "Lunes 12" dentro
 * de los últimos 7 días, y "08/10/2026" más atrás (o si el día es posterior a `hoy`).
 *
 * Los dos son días de negocio de la tienda (`diaDe(instante)`, America/Lima), no del reloj del
 * celular: la cuenta usa solo aritmética de calendario en UTC (shared/domain/fecha), así que
 * el resultado no cambia con la zona horaria del sistema.
 */
export function etiquetaDeDia(dia: Dia, hoy: Dia): string {
  const atras = diasEntre(dia, hoy)
  if (atras === 0) return 'Hoy'
  if (atras === 1) return 'Ayer'
  if (atras > 1 && atras <= DIAS_CON_NOMBRE) {
    return `${NOMBRES[diaDeLaSemana(dia)]} ${Number(dia.slice(8, 10))}`
  }
  return formatearDia(dia)
}
