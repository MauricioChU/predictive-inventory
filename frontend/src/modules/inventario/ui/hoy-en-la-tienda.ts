import { diaDe, type Dia } from '@/shared/domain/fecha'

/**
 * El día de negocio de hoy en la tienda (America/Lima), según el reloj del celular: lo usan
 * las pantallas para "Hoy" / "Ayer" y los límites de la fecha (RN-OP-09). Los casos de uso
 * usan su propio reloj.
 */
export function hoyEnLaTienda(): Dia {
  return diaDe(new Date().toISOString())
}
