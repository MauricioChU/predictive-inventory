import { normalizar } from '@/shared/domain/texto'

/** Compara dos textos ignorando tildes, mayúsculas y espacios repetidos (como RN-CAT-01). */
export function compararNormalizados(a: string, b: string): number {
  const x = normalizar(a)
  const y = normalizar(b)
  return Number(x > y) - Number(x < y)
}
