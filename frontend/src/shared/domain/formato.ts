import type { Cantidad, Unidad } from './cantidad'
import type { Dinero } from './dinero'
import type { Dia } from './fecha'

export const SIMBOLO_DE_UNIDAD: Record<Unidad, string> = { UNIDAD: 'unid.', KILO: 'kg', LITRO: 'L' }

function agrupar(entero: number, separador: string): string {
  return String(entero).replace(/\B(?=(\d{3})+(?!\d))/g, separador)
}

export function formatearDinero(dinero: Dinero): string {
  const absoluto = Math.abs(dinero.centimos)
  const texto = `S/ ${agrupar(Math.floor(absoluto / 100), ' ')}.${String(absoluto % 100).padStart(2, '0')}`
  return dinero.centimos < 0 ? `-${texto}` : texto
}

export function formatearNumero(cantidad: Cantidad): string {
  const absoluto = Math.abs(cantidad.milesimas)
  const entero = Math.floor(absoluto / 1000)
  const decimales = String(absoluto % 1000)
    .padStart(3, '0')
    .replace(/0+$/, '')
  const texto = decimales ? `${entero}.${decimales}` : String(entero)
  return cantidad.milesimas < 0 ? `-${texto}` : texto
}

export function formatearCantidad(cantidad: Cantidad, unidad: Unidad): string {
  return `${formatearNumero(cantidad)} ${SIMBOLO_DE_UNIDAD[unidad]}`
}

export function formatearEntero(n: number): string {
  return agrupar(n, ' ')
}

export function formatearDia(dia: Dia): string {
  const [anio, mes, d] = dia.split('-')
  return `${d}/${mes}/${anio}`
}

export function plural(n: number, singular: string, enPlural: string): string {
  return n === 1 ? singular : enPlural
}
