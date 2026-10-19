import {
  MONTO_MAXIMO_DEL_ALQUILER_CENTIMOS,
  type AlquilerDelLocal,
} from '../contratos/configuracion'
import { Dinero } from './dinero'
import { ErrorDeDominio } from './errores'

const esDiaDePagoValido = (dia: number) => Number.isInteger(dia) && dia >= 1 && dia <= 31

/**
 * Valida el costo del local (RN-AN-17). `null` (sin configurar) y `NO_PAGA` son válidos.
 * Devuelve el primer mensaje de error, o `null` si todo está bien.
 */
export function validarAlquilerDelLocal(alquiler: AlquilerDelLocal | null): string | null {
  if (alquiler === null || alquiler.tipo === 'NO_PAGA') return null

  const { montoCentimos, dias } = alquiler
  if (!Number.isInteger(montoCentimos) || montoCentimos <= 0) {
    return 'El monto debe ser mayor que S/ 0.00'
  }
  if (montoCentimos > MONTO_MAXIMO_DEL_ALQUILER_CENTIMOS) {
    return 'El monto no puede pasar de S/ 99 999.99'
  }

  const cantidadEsperada = alquiler.tipo === 'MENSUAL' ? 1 : 2
  if (dias.length !== cantidadEsperada || !dias.every(esDiaDePagoValido)) {
    return 'El día de pago va del 1 al 31'
  }
  if (alquiler.tipo === 'QUINCENAL' && alquiler.dias[0] === alquiler.dias[1]) {
    return 'Elige dos días distintos'
  }
  return null
}

/** Deja los dos días de pago de menor a mayor. No modifica el original. */
export function normalizarAlquilerDelLocal(
  alquiler: AlquilerDelLocal | null,
): AlquilerDelLocal | null {
  if (alquiler?.tipo !== 'QUINCENAL') return alquiler
  const [a, b] = alquiler.dias
  return { ...alquiler, dias: a <= b ? [a, b] : [b, a] }
}

/** Convierte el monto escrito en pantalla; los decimales de más dan el mensaje de RN-AN-17. */
export function montoDelAlquilerDeTexto(texto: string): Dinero {
  try {
    return Dinero.deTexto(texto)
  } catch (error) {
    if (error instanceof ErrorDeDominio && error.codigo === 'DINERO_DECIMALES') {
      throw new ErrorDeDominio('DINERO_DECIMALES', 'El monto puede tener hasta 2 decimales')
    }
    throw error
  }
}
