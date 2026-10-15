import type { Dinero } from '@/shared/domain/dinero'
import { formatearDinero, plural } from '@/shared/domain/formato'

/** RN-AL-06: texto del aviso de atención en Inicio ("1 agotado y 1 por acabarse", etc.). */
export function textoDeAtencion(agotados: number, porAcabarse: number): string {
  const partes: string[] = []
  if (agotados > 0) partes.push(`${agotados} ${plural(agotados, 'agotado', 'agotados')}`)
  if (porAcabarse > 0) partes.push(`${porAcabarse} por acabarse`)
  if (partes.length === 0) return 'Todo bien: no falta nada'
  return partes.join(' y ')
}

function lineaAgotados(n: number): string {
  if (n === 0) return 'Nada agotado'
  return `${n} ${plural(n, 'agotado', 'agotados')}`
}

function lineaPorAcabarse(n: number): string {
  if (n === 0) return 'Nada por acabarse'
  return `${n} por acabarse`
}

/** Solo se necesitan estos dos campos de `TotalesDeDia` para la línea de "ayer" (RN-AL-09). */
export interface TotalesDeAyer {
  ventas: Dinero
  gananciaNeta: Dinero
}

function lineaDeAyer(totales: TotalesDeAyer): string {
  if (totales.ventas.esCero()) return 'Ayer no hubo ventas'
  if (totales.gananciaNeta.esNegativo()) {
    return `Ayer perdiste ${formatearDinero(totales.gananciaNeta.negar())}`
  }
  return `Ayer ganaste ${formatearDinero(totales.gananciaNeta)}`
}

/** RN-AL-09: las tres líneas exactas de la tarjeta "Resumen del día". */
export function lineasDelResumenDelDia(
  agotados: number,
  porAcabarse: number,
  totalesDeAyer: TotalesDeAyer,
): string[] {
  return [lineaAgotados(agotados), lineaPorAcabarse(porAcabarse), lineaDeAyer(totalesDeAyer)]
}
