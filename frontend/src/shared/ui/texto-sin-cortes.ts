import { SIMBOLO_DE_UNIDAD } from '@/shared/domain/formato'

/** Espacio que no deja cortar la línea (U+00A0). */
const NBSP = '\u00A0'

const escapar = (texto: string): string => texto.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const UNIDADES = [...Object.values(SIMBOLO_DE_UNIDAD), 'días', 'día'].map(escapar).join('|')

/** "S/ 12" → el símbolo con su número. */
const MONEDA = /S\/ (?=\d)/g
/** "12 345" → los grupos de miles de formatearDinero/formatearEntero entre sí. */
const MILES = /(\d) (?=\d{3}(?!\d))/g
/** "12 unid.", "2.5 kg", "1 L", "~20 días" → el número con su unidad. */
const UNIDAD = new RegExp(`(\\d) (?=(?:${UNIDADES})(?![\\p{L}\\d]))`, 'gu')

/**
 * Los montos ("S/ 12 345.67") y las cantidades ("~12 unid.") usan espacios normales, así que
 * en una pantalla angosta con letra Muy grande podían partirse en dos líneas ("S/ 12" | "345.67"):
 * se lee otro número. Devuelve el mismo texto con esos espacios cambiados por espacios que no
 * cortan la línea; los demás espacios (entre palabras) quedan igual.
 */
export function pegarCifras(texto: string): string {
  return texto.replace(MONEDA, `S/${NBSP}`).replace(MILES, `$1${NBSP}`).replace(UNIDAD, `$1${NBSP}`)
}

/**
 * Largo (en letras) del trozo más largo de `pegarCifras(texto)` que no se puede partir: lo
 * usan los componentes de letra grande para achicarla lo justo y que ese trozo quepa entero
 * en el ancho disponible (ver `--caracteres` en TarjetaDeCifra y RespuestaGrande).
 */
export function largoSinCorte(texto: string): number {
  return Math.max(
    0,
    ...pegarCifras(texto)
      .split(/[ \t\n]+/)
      .map((trozo) => [...trozo].length),
  )
}
