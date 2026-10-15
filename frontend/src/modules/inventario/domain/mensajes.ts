import type { Cantidad, Unidad } from '@/shared/domain/cantidad'
import type { Dinero } from '@/shared/domain/dinero'
import {
  formatearCantidad,
  formatearDinero,
  formatearEntero,
  plural,
} from '@/shared/domain/formato'

/** RN-OP-05: "Solo quedan 10 unid. de Lejía 1 L", "Solo queda 1 kg de …", "Ya no queda …". */
export function mensajeStockInsuficiente(nombre: string, unidad: Unidad, stock: Cantidad): string {
  if (!stock.esPositiva()) return `Ya no queda ${nombre}`
  const cantidad = formatearCantidad(stock, unidad)
  return stock.esUno()
    ? `Solo queda ${cantidad} de ${nombre}`
    : `Solo quedan ${cantidad} de ${nombre}`
}

const POR_UNIDAD_DE_MEDIDA: Record<Unidad, string> = {
  UNIDAD: 'por unidad',
  KILO: 'por kilo',
  LITRO: 'por litro',
}

/** RN-OP-14: pregunta si se actualiza el precio de compra y muestra el nuevo margen. */
export function mensajeCambioDePrecio(
  nuevoCosto: Dinero,
  precioVenta: Dinero,
  unidad: Unidad,
): string {
  const margen = precioVenta.restar(nuevoCosto)
  const por = POR_UNIDAD_DE_MEDIDA[unidad]
  const efecto = margen.esPositivo()
    ? `Ganarás ${formatearDinero(margen)} ${por}`
    : margen.esNegativo()
      ? `Perderás ${formatearDinero(margen.negar())} ${por}`
      : `No ganarás nada ${por}`
  return `¿Actualizar el precio de compra a ${formatearDinero(nuevoCosto)}? ${efecto}`
}

const dias = (n: number) => `${formatearEntero(n)} ${plural(n, 'día', 'días')}`

/** RN-OP-20 (b). Sin punto final: el de "4 unid." es el de la abreviatura. */
export function mensajeProductoParado(
  nombre: string,
  diasSinVender: number,
  stock: Cantidad,
  unidad: Unidad,
): string {
  return `${nombre} no se vende hace ${dias(diasSinVender)} y aún tienes ${formatearCantidad(stock, unidad)}`
}

/** RN-OP-20 (a). `sugerida` solo si el producto está en Para comprar. */
export function mensajeCompraExcesiva(
  nombre: string,
  diasDeCobertura: number,
  unidad: Unidad,
  sugerida: Cantidad | null,
): string {
  const consejo = sugerida
    ? `Te sugerimos ~${formatearCantidad(sugerida, unidad)}`
    : 'Ahora no necesitabas comprar.'
  return `Con esto tendrías ${nombre} para ~${dias(diasDeCobertura)}. ${consejo}`
}

export interface CorreccionDeStock {
  nombre: string
  unidad: Unidad
  antes: Cantidad
  despues: Cantidad
}

/** RN-OP-19. */
export function mensajeDeRevisionDeDatos(correcciones: readonly CorreccionDeStock[]): string {
  if (correcciones.length === 0) return 'Todo está en orden'
  const n = correcciones.length
  const detalle = correcciones
    .map(
      (c) =>
        `${c.nombre} (${formatearCantidad(c.antes, c.unidad)} → ${formatearCantidad(c.despues, c.unidad)})`,
    )
    .join(', ')
  return `Corregimos el stock de ${formatearEntero(n)} ${plural(n, 'producto', 'productos')}: ${detalle}`
}

/** RN-OP-21: "Llevas 1 de 3". */
export function progresoDelConteo(posicion: number, total: number): string {
  return `Llevas ${formatearEntero(posicion)} de ${formatearEntero(total)}`
}

export interface DatosDelResumenDelConteo {
  contados: number
  conDiferencia: number
  valorDeDiferencias: Dinero
  /** Nombres de los productos saltados, en el orden del recorrido. */
  faltantes: readonly string[]
}

/** RN-OP-21: resumen al terminar el conteo guiado. */
export function resumenDelConteo(datos: DatosDelResumenDelConteo): string[] {
  const { contados, conDiferencia, valorDeDiferencias, faltantes } = datos
  const resultado =
    conDiferencia === 0
      ? 'Todo cuadraba.'
      : `${formatearEntero(conDiferencia)} con diferencia: ${formatearDinero(valorDeDiferencias)}`
  const lineas = [
    `Contaste ${formatearEntero(contados)} ${plural(contados, 'producto', 'productos')}. ${resultado}`,
  ]
  if (faltantes.length > 0) {
    lineas.push(`Te faltó contar ${formatearEntero(faltantes.length)}: ${faltantes.join(', ')}`)
  }
  return lineas
}
