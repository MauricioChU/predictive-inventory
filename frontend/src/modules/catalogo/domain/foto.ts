import { ErrorDeDominio } from '@/shared/domain/errores'

/** RN-CAT-14: reduce a lo sumo a `maximo` px en el lado mayor; nunca agranda. */
export function dimensionesReducidas(
  anchoOriginal: number,
  altoOriginal: number,
  maximo = 512,
): { ancho: number; alto: number } {
  const ladoMayor = Math.max(anchoOriginal, altoOriginal)
  if (ladoMayor <= maximo) return { ancho: anchoOriginal, alto: altoOriginal }
  const factor = maximo / ladoMayor
  return {
    ancho: Math.max(1, Math.round(anchoOriginal * factor)),
    alto: Math.max(1, Math.round(altoOriginal * factor)),
  }
}

const CALIDADES = [0.85, 0.75, 0.65, 0.55, 0.45, 0.35] as const

/**
 * RN-CAT-14: prueba calidades decrecientes hasta que el resultado pese `maximoBytes` o
 * menos (100 KB por defecto) y devuelve la primera que sirve. Si ninguna sirve, lanza
 * `FOTO_PESADA`.
 */
export async function comprimirHasta(
  codificar: (calidad: number) => Promise<Blob>,
  maximoBytes = 102_400,
): Promise<Blob> {
  for (const calidad of CALIDADES) {
    const blob = await codificar(calidad)
    if (blob.size <= maximoBytes) return blob
  }
  throw new ErrorDeDominio('FOTO_PESADA', 'No pudimos achicar la foto. Prueba con otra.')
}
