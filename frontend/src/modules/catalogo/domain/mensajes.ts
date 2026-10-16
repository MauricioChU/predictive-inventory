import type { Cantidad } from '@/shared/domain/cantidad'
import type { Unidad } from '@/shared/domain/cantidad'
import type { Dinero } from '@/shared/domain/dinero'
import { formatearCantidad, formatearDinero } from '@/shared/domain/formato'

/** Sin categoría (o con una que ya no existe) al crear o editar un producto. */
export const MENSAJE_ELIGE_CATEGORIA = 'Elige una categoría'

/** "unidad", "kilo" o "litro": cómo se nombra la unidad en "por cada …" (RN-CAT-05). */
export const NOMBRE_DE_UNIDAD: Record<Unidad, string> = {
  UNIDAD: 'unidad',
  KILO: 'kilo',
  LITRO: 'litro',
}

/**
 * RN-CAT-05: pide confirmar antes de guardar un precio con pérdida (venta < compra) o sin
 * ganancia (venta = compra). `perdida` es `precioCompra - precioVenta`, que es S/ 0.00 cuando
 * no hay ganancia.
 */
export function mensajePerdida(perdida: Dinero, unidad: Unidad): string {
  const nombreUnidad = NOMBRE_DE_UNIDAD[unidad]
  if (perdida.esCero()) {
    return `Con este precio no ganas nada por cada ${nombreUnidad}`
  }
  return `Vas a perder ${formatearDinero(perdida)} por cada ${nombreUnidad}`
}

/**
 * RN-CAT-11: ofrece retirar el stock restante antes de archivar. Singular solo si la
 * cantidad es exactamente 1; UNIDAD usa pronombres femeninos ("la"/"las"), KILO y LITRO
 * masculinos ("lo"/"los").
 */
export function mensajeRetiro(stock: Cantidad, unidad: Unidad): string {
  const esUna = stock.esUno()
  const verbo = esUna ? 'queda' : 'quedan'
  const femenino = unidad === 'UNIDAD'
  const pronombre = esUna ? (femenino ? 'La' : 'Lo') : femenino ? 'Las' : 'Los'
  const medida = formatearCantidad(stock, unidad)
  // SIMBOLO_DE_UNIDAD ya termina en "." para UNIDAD ("unid."); no se duplica el punto.
  const punto = medida.endsWith('.') ? '' : '.'
  return `Aún ${verbo} ${medida}${punto} ¿${pronombre} retiramos del stock?`
}
