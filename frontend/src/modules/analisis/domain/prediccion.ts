import type { Prediccion } from '@/shared/contratos/entre-modulos'
import { Cantidad, type Unidad } from '@/shared/domain/cantidad'
import { redondearMitadLejosDeCero } from '@/shared/domain/dinero'
import { sumarDias, type Dia } from '@/shared/domain/fecha'
import { formatearCantidad } from '@/shared/domain/formato'
import type { ResumenDiario } from './resumen-diario'

/** RN-AN-04: se miran los 28 días completos anteriores a hoy. */
export const DIAS_DE_LA_VENTANA = 28
/** RN-AN-04: con menos días válidos no hay predicción. */
export const DIAS_VALIDOS_MINIMOS = 7

export interface DatosDePrediccion {
  hoy: Dia
  /** Stock actual (incluye lo de hoy). */
  stock: Cantidad
  /** Día del primer movimiento del producto. */
  primerDia: Dia | null
  /** Filas del producto; basta con las de los últimos 28 días y las de hoy en adelante. */
  filas: readonly ResumenDiario[]
}

/**
 * RN-AN-04. Reconstruye el stock de cada día hacia atrás desde el stock actual con el cambio
 * neto de cada día; un día es válido salvo que haya empezado y terminado en 0 sin ventas.
 */
export function calcularPrediccion(d: DatosDePrediccion): Prediccion | null {
  const hasta = sumarDias(d.hoy, -1)
  const inicioVentana = sumarDias(d.hoy, -DIAS_DE_LA_VENTANA)
  if (d.primerDia === null || d.primerDia > hasta) return null
  const desde = d.primerDia > inicioVentana ? d.primerDia : inicioVentana

  const cambioPorDia = new Map<Dia, number>()
  const vendidoPorDia = new Map<Dia, number>()
  let cambioDesdeHoy = 0
  for (const fila of d.filas) {
    if (fila.dia >= d.hoy) {
      cambioDesdeHoy += fila.cambioNeto.milesimas
      continue
    }
    cambioPorDia.set(fila.dia, (cambioPorDia.get(fila.dia) ?? 0) + fila.cambioNeto.milesimas)
    vendidoPorDia.set(fila.dia, (vendidoPorDia.get(fila.dia) ?? 0) + fila.cantidadVendida.milesimas)
  }

  let stockFin = d.stock.milesimas - cambioDesdeHoy
  let diasValidos = 0
  let vendido = 0
  for (let dia = hasta; dia >= desde; dia = sumarDias(dia, -1)) {
    const stockInicio = stockFin - (cambioPorDia.get(dia) ?? 0)
    const vendidoDelDia = vendidoPorDia.get(dia) ?? 0
    const agotadoTodoElDia = stockInicio <= 0 && stockFin <= 0 && vendidoDelDia === 0
    if (!agotadoTodoElDia) {
      diasValidos += 1
      vendido += vendidoDelDia
    }
    stockFin = stockInicio
  }
  if (diasValidos < DIAS_VALIDOS_MINIMOS) return null
  return { vendido: Cantidad.deMilesimas(vendido), diasValidos }
}

/** RN-AN-05: stock ÷ VPD hacia abajo, con la fracción exacta; null si la VPD es 0. */
export function diasDeCobertura(prediccion: Prediccion, stock: Cantidad): number | null {
  if (prediccion.vendido.esCero()) return null
  return Math.floor((stock.milesimas * prediccion.diasValidos) / prediccion.vendido.milesimas)
}

/** RN-AN-05: "Se acaba en ~N días"; null sin predicción. */
export function textoCobertura(prediccion: Prediccion | null, stock: Cantidad): string | null {
  if (prediccion === null) return null
  const dias = diasDeCobertura(prediccion, stock)
  if (dias === null) return 'Sin ventas en las últimas 4 semanas'
  if (dias === 0) return 'Se acaba hoy'
  return dias === 1 ? 'Se acaba en ~1 día' : `Se acaba en ~${dias} días`
}

/** VPD redondeada a un decimal (mitad lejos de cero), solo para mostrarla. */
export function ventaDiariaAproximada(prediccion: Prediccion): Cantidad {
  const decimas = redondearMitadLejosDeCero(
    prediccion.vendido.milesimas,
    prediccion.diasValidos * 100,
  )
  return Cantidad.deMilesimas(decimas * 100)
}

/** "Vendes ~2 unid. al día" (detalle del producto, RN-AN-14); null sin predicción. */
export function textoVentaDiaria(prediccion: Prediccion | null, unidad: Unidad): string | null {
  if (prediccion === null) return null
  return `Vendes ~${formatearCantidad(ventaDiariaAproximada(prediccion), unidad)} al día`
}
