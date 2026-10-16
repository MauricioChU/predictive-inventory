import { normalizar } from '@/shared/domain/texto'
import type { OperacionRegistro } from '@/shared/contratos/registros'

/** Compara dos textos ignorando tildes, mayúsculas y espacios repetidos (como RN-CAT-01). */
export function compararNormalizados(a: string, b: string): number {
  const x = normalizar(a)
  const y = normalizar(b)
  return Number(x > y) - Number(x < y)
}

/**
 * El libro en orden de registro (por `registradaEn`; a igual momento, el orden recibido). Se
 * aplica por las dudas: un repositorio (p. ej. Dexie con ids UUID) puede no garantizarlo.
 */
export function enOrdenDeRegistro(registros: readonly OperacionRegistro[]): OperacionRegistro[] {
  return [...registros].sort((a, b) => Date.parse(a.registradaEn) - Date.parse(b.registradaEn))
}
