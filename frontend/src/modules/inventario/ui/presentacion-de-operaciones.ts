import { Dinero } from '@/shared/domain/dinero'
import type { TipoDeOperacion } from '@/shared/contratos/operaciones'
import { MOTIVO_PRODUCTO_RETIRADO } from '@/shared/contratos/operaciones'
import { formatearCantidad, formatearDinero, formatearEntero } from '@/shared/domain/formato'
import type { LineaDeOperacionVista, OperacionVista } from '../application/historial'

/** Filtro "Mostrar" del Historial: todo o un tipo (el stock inicial solo aparece en "Todo"). */
export type FiltroDeTipo = 'TODO' | Exclude<TipoDeOperacion, 'STOCK_INICIAL'>

export const FILTROS_DEL_HISTORIAL: readonly { valor: FiltroDeTipo; etiqueta: string }[] = [
  { valor: 'TODO', etiqueta: 'Todo' },
  { valor: 'VENTA', etiqueta: 'Ventas' },
  { valor: 'INGRESO', etiqueta: 'Llegó mercadería' },
  { valor: 'MERMA', etiqueta: 'Pérdidas' },
  { valor: 'AJUSTE', etiqueta: 'Conteos' },
  { valor: 'ANULACION', etiqueta: 'Anulados' },
]

const cantidadDe = (linea: LineaDeOperacionVista) =>
  formatearCantidad(linea.cantidad.abs(), linea.unidad)

/** "+3 unid." / "-2 unid.": en conteos y anulaciones importa hacia dónde fue. */
function conSigno(linea: LineaDeOperacionVista): string {
  const texto = formatearCantidad(linea.cantidad, linea.unidad)
  return linea.cantidad.esPositiva() ? `+${texto}` : texto
}

/** Lo que costó la mercadería de la operación (costo × cantidad, por línea al céntimo). */
function costoTotal(operacion: OperacionVista): Dinero {
  return Dinero.sumarTodos(
    operacion.lineas.map((l) => l.costoUnitario.multiplicarPor(l.cantidad.abs())),
  )
}

/** "Lejía 1 L (2 unid.)" o "Lejía 1 L (2 unid.) y 2 más". */
export function resumenDeProductos(operacion: OperacionVista): string {
  const [primera, ...resto] = operacion.lineas
  if (!primera) return ''
  const texto = `${primera.nombre} (${cantidadDe(primera)})`
  return resto.length > 0 ? `${texto} y ${formatearEntero(resto.length)} más` : texto
}

/** El monto que se ve en la lista: lo vendido, lo que costó la llegada o lo que se perdió. */
export function montoDe(operacion: OperacionVista): string | null {
  switch (operacion.tipo) {
    case 'VENTA':
      return operacion.total ? formatearDinero(operacion.total) : null
    case 'INGRESO':
      return `Costo ${formatearDinero(costoTotal(operacion))}`
    case 'MERMA':
      return `Pérdida ${formatearDinero(costoTotal(operacion))}`
    default:
      return null
  }
}

/** La cuenta de una línea en el detalle: "2 unid. × S/ 3.50 = S/ 7.00". */
export function cuentaDeLinea(operacion: OperacionVista, linea: LineaDeOperacionVista): string {
  switch (operacion.tipo) {
    case 'VENTA':
      return linea.precioUnitario && linea.importe
        ? `${cantidadDe(linea)} × ${formatearDinero(linea.precioUnitario)} = ${formatearDinero(linea.importe)}`
        : cantidadDe(linea)
    case 'INGRESO':
      return `${cantidadDe(linea)} × ${formatearDinero(linea.costoUnitario)} = ${formatearDinero(linea.costoUnitario.multiplicarPor(linea.cantidad.abs()))}`
    case 'MERMA':
      return `${cantidadDe(linea)} · pérdida ${formatearDinero(linea.costoUnitario.multiplicarPor(linea.cantidad.abs()))}`
    case 'AJUSTE':
    case 'ANULACION':
      return conSigno(linea)
    default:
      return cantidadDe(linea)
  }
}

/** Los totales del detalle, según el tipo. */
export function totalesDe(operacion: OperacionVista): { etiqueta: string; valor: string }[] {
  switch (operacion.tipo) {
    case 'VENTA':
      return [
        { etiqueta: 'Total', valor: formatearDinero(operacion.total ?? Dinero.cero()) },
        { etiqueta: 'Ganancia', valor: formatearDinero(operacion.ganancia ?? Dinero.cero()) },
      ]
    case 'INGRESO':
      return [{ etiqueta: 'Valor total', valor: formatearDinero(costoTotal(operacion)) }]
    case 'MERMA':
      return [{ etiqueta: 'Pérdida', valor: formatearDinero(costoTotal(operacion)) }]
    default:
      return []
  }
}

/** "esta venta", "este conteo"… para "¿Anular esta venta?". */
export function nombreConArticulo(operacion: OperacionVista): string {
  switch (operacion.tipo) {
    case 'VENTA':
      return 'esta venta'
    case 'INGRESO':
      return 'esta llegada de mercadería'
    case 'MERMA':
      return 'esta pérdida'
    case 'AJUSTE':
      return operacion.motivo === MOTIVO_PRODUCTO_RETIRADO ? 'este retiro' : 'este conteo'
    case 'STOCK_INICIAL':
      return 'este stock inicial'
    default:
      return 'esta operación'
  }
}
