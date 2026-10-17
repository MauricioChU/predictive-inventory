import type { Unidad } from '@/shared/domain/cantidad'
import type { Dinero } from '@/shared/domain/dinero'
import { diaDe, type Instante } from '@/shared/domain/fecha'
import { formatearDia, formatearDinero, plural, SIMBOLO_DE_UNIDAD } from '@/shared/domain/formato'
import type { CasoNecesitoComprar } from '../domain/necesito-comprar'
import type { NombreDeDia } from '../domain/observaciones'
import type { Periodo } from '../domain/periodos'

/** Textos de las pantallas de Control que no salen del dominio (04-torre-de-control, 06). */

/** RN-AN-03. */
export const OPCIONES_DE_PERIODO: readonly { valor: Periodo; etiqueta: string }[] = [
  { valor: 'HOY', etiqueta: 'Hoy' },
  { valor: 'AYER', etiqueta: 'Ayer' },
  { valor: '7_DIAS', etiqueta: '7 días' },
  { valor: '30_DIAS', etiqueta: '30 días' },
]

export type PeriodoDeMasVendidos = 7 | 30

/** RN-AN-09. */
export const OPCIONES_DE_MAS_VENDIDOS: readonly {
  valor: PeriodoDeMasVendidos
  etiqueta: string
}[] = [
  { valor: 7, etiqueta: '7 días' },
  { valor: 30, etiqueta: '30 días' },
]

const CUANDO: Record<Periodo, string> = {
  HOY: 'Hoy',
  AYER: 'Ayer',
  '7_DIAS': 'En 7 días',
  '30_DIAS': 'En 30 días',
}

/** "Hoy ganaste" (como Inicio); con ganancia neta negativa, "Hoy perdiste". */
export function tituloDeGanancia(periodo: Periodo, gananciaNeta: Dinero): string {
  return `${CUANDO[periodo]} ${gananciaNeta.esNegativo() ? 'perdiste' : 'ganaste'}`
}

const SIN_VENTAS: Record<Periodo, string> = {
  HOY: 'Todavía no hay ventas hoy',
  AYER: 'Ayer no hubo ventas',
  '7_DIAS': 'Todavía no hay ventas esta semana',
  '30_DIAS': 'Todavía no hay ventas en los últimos 30 días',
}

/** RN-UX-10: lo que se dice en vez de una lista o una cifra vacía. */
export function textoSinVentas(periodo: Periodo): string {
  return SIN_VENTAS[periodo]
}

export interface PartesDelCambio {
  /** Se dibuja pero no se lee: el texto ya dice "más" o "menos" (RN-UX-04). */
  flecha: string
  texto: string
  tono: 'sube' | 'baja' | 'igual'
}

/** RN-AN-12: "▲ 12 % más" → flecha "▲" y texto "12 % más". */
export function partesDelCambio(cambio: string): PartesDelCambio {
  const [flecha = '', ...resto] = cambio.split(' ')
  const tono = flecha === '▲' ? 'sube' : flecha === '▼' ? 'baja' : 'igual'
  return { flecha, texto: resto.join(' '), tono }
}

/** "miércoles" → "Miércoles" (etiqueta suelta del gráfico). */
export function textoDeDia(dia: NombreDeDia): string {
  return dia.charAt(0).toUpperCase() + dia.slice(1)
}

/** RN-AN-13. */
export function textoMejorDia(dia: NombreDeDia): string {
  return `Tu mejor día es el ${dia}`
}

/** RN-AN-09: número de líneas de venta. */
export function textoVeces(veces: number): string {
  return `${veces} ${plural(veces, 'vez', 'veces')}`
}

/** RN-AN-11. */
export function textoSinVender(dias: number): string {
  return `No se vende hace ${dias} ${plural(dias, 'día', 'días')}`
}

const POR_UNIDAD: Record<Unidad, string> = {
  UNIDAD: 'por unidad',
  KILO: 'por kilo',
  LITRO: 'por litro',
}

/** RN-AN-10: lo que se pierde en cada unidad vendida (o que no se gana nada). */
export function textoPerdidaPorUnidad(perdida: Dinero, unidad: Unidad): string {
  if (perdida.esCero()) return 'Lo vendes al precio que lo compras'
  return `Pierdes ${formatearDinero(perdida)} ${POR_UNIDAD[unidad]}`
}

/** RN-AN-08: el precio de compra de una línea de Para comprar ("Costo S/ 2.40 c/u"). */
export function textoCostoUnitario(precioCompra: Dinero, unidad: Unidad): string {
  const cada = unidad === 'UNIDAD' ? 'c/u' : `el ${SIMBOLO_DE_UNIDAD[unidad]}`
  return `Costo ${formatearDinero(precioCompra)} ${cada}`
}

const TONO_DE_RESPUESTA: Record<CasoNecesitoComprar, 'atencion' | 'exito' | 'peligro' | 'info'> = {
  COMPRAR: 'atencion',
  NO_HACE_FALTA: 'exito',
  NO_COMPRES: 'peligro',
  SIN_PREDICCION: 'info',
}

/** RN-AN-16: el tono de RespuestaGrande para cada caso. */
export function tonoDeRespuesta(
  caso: CasoNecesitoComprar,
): 'atencion' | 'exito' | 'peligro' | 'info' {
  return TONO_DE_RESPUESTA[caso]
}

/** RN-AN-16: "Debajo se muestra … la última vez que llegó mercadería de ese producto". */
export function textoUltimaLlegada(instante: Instante | null, diasDesde: number | null): string {
  if (instante === null || diasDesde === null)
    return 'Todavía no registras llegadas de este producto'
  if (diasDesde === 0) return 'Hoy'
  if (diasDesde === 1) return 'Ayer'
  return `${formatearDia(diaDe(instante))} (hace ${diasDesde} días)`
}
