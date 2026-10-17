import type { TotalesDeDia } from '@/shared/contratos/entre-modulos'
import { Dinero } from '@/shared/domain/dinero'
import { sumarDias, type Dia } from '@/shared/domain/fecha'
import type { ResumenDiario } from './resumen-diario'

/** RN-AN-03: Hoy · Ayer · Últimos 7 días (incluye hoy) · Últimos 30 días (incluye hoy). */
export type Periodo = 'HOY' | 'AYER' | '7_DIAS' | '30_DIAS'

/** Rango de días, ambos inclusive. */
export interface RangoDeDias {
  desde: Dia
  hasta: Dia
}

/** RN-AN-02. */
export interface ResumenDePeriodo {
  ventas: Dinero
  costoVendido: Dinero
  gananciaBruta: Dinero
  mermas: Dinero
  gananciaNeta: Dinero
  /** Se muestra aparte y no afecta la ganancia. */
  diferenciasDeConteo: Dinero
}

/** Los últimos `dias` días, incluido hoy. */
export function ultimosDias(hoy: Dia, dias: number): RangoDeDias {
  return { desde: sumarDias(hoy, -(dias - 1)), hasta: hoy }
}

export function rangoDePeriodo(periodo: Periodo, hoy: Dia): RangoDeDias {
  switch (periodo) {
    case 'HOY':
      return ultimosDias(hoy, 1)
    case 'AYER': {
      const ayer = sumarDias(hoy, -1)
      return { desde: ayer, hasta: ayer }
    }
    case '7_DIAS':
      return ultimosDias(hoy, 7)
    case '30_DIAS':
      return ultimosDias(hoy, 30)
  }
}

export function estaEnRango(dia: Dia, rango: RangoDeDias): boolean {
  return dia >= rango.desde && dia <= rango.hasta
}

/** RN-AN-02: suma las filas de todos los productos cuyo día cae en el rango. */
export function resumenDePeriodo(
  filas: readonly ResumenDiario[],
  rango: RangoDeDias,
): ResumenDePeriodo {
  let ventas = Dinero.cero()
  let costoVendido = Dinero.cero()
  let mermas = Dinero.cero()
  let diferenciasDeConteo = Dinero.cero()
  for (const fila of filas) {
    if (!estaEnRango(fila.dia, rango)) continue
    ventas = ventas.sumar(fila.ventas)
    costoVendido = costoVendido.sumar(fila.costoVendido)
    mermas = mermas.sumar(fila.costoMermas)
    diferenciasDeConteo = diferenciasDeConteo.sumar(fila.valorAjustes)
  }
  const gananciaBruta = ventas.restar(costoVendido)
  return {
    ventas,
    costoVendido,
    gananciaBruta,
    mermas,
    gananciaNeta: gananciaBruta.restar(mermas),
    diferenciasDeConteo,
  }
}

/** Totales de la tienda por día, en orden, solo de los días con alguna venta, merma o ajuste. */
export function totalesPorDia(filas: readonly ResumenDiario[]): TotalesDeDia[] {
  const porDia = new Map<Dia, ResumenDiario[]>()
  for (const fila of filas) {
    if (!fila.tieneVentasMermasOAjustes) continue
    const delDia = porDia.get(fila.dia)
    if (delDia) delDia.push(fila)
    else porDia.set(fila.dia, [fila])
  }
  return [...porDia]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([dia, delDia]) => ({ dia, ...resumenDePeriodo(delDia, { desde: dia, hasta: dia }) }))
}
