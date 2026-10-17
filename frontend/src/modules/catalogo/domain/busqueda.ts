import { normalizar } from '@/shared/domain/texto'

/**
 * RN-CAT-12: coincide si CADA palabra escrita (normalizada) está contenida en el nombre
 * normalizado del producto, sin importar el orden. Texto vacío encuentra todo.
 */
export function coincide(nombreNormalizado: string, texto: string): boolean {
  const palabras = normalizar(texto).split(' ').filter(Boolean)
  return palabras.every((palabra) => nombreNormalizado.includes(palabra))
}

interface ResultadoDeBusqueda {
  id: string
  nombreNormalizado: string
}

/**
 * RN-CAT-12: ordena por veces vendido (desde hace 29 días hasta hoy) descendente y, en caso
 * de empate, por nombre normalizado con localeCompare('es'). No muta `items`.
 */
export function ordenarResultados<T extends ResultadoDeBusqueda>(
  items: readonly T[],
  vecesVendido: ReadonlyMap<string, number>,
): T[] {
  return [...items].sort((a, b) => {
    const diferencia = (vecesVendido.get(b.id) ?? 0) - (vecesVendido.get(a.id) ?? 0)
    if (diferencia !== 0) return diferencia
    return a.nombreNormalizado.localeCompare(b.nombreNormalizado, 'es')
  })
}
