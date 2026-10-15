import type { Cantidad, Unidad } from '@/shared/domain/cantidad'
import type { Dinero } from '@/shared/domain/dinero'
import type { SituacionDeProducto } from '@/shared/contratos/entre-modulos'
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

export type SituacionParaSobrecompra = Pick<
  SituacionDeProducto,
  'stock' | 'prediccion' | 'enListaParaComprar' | 'cantidadSugerida' | 'parado'
>

/**
 * RN-OP-20: aviso de sobrecompra de una línea de ingreso, con la situación del producto
 * ANTES del ingreso, o null si no hay que avisar. (b) Un producto parado avisa siempre.
 * (a) Si no, con predicción: días = ⌊(stock + compra) ÷ VPD⌋, con VPD = vendido ÷ días
 * válidos (RN-AN-04); avisa si SUPERA el límite configurado.
 */
export function mensajeDeSobrecompra(
  producto: { nombre: string; unidad: Unidad },
  situacion: SituacionParaSobrecompra,
  compra: Cantidad,
  diasMaximosDeCompra: number,
): string | null {
  const { nombre, unidad } = producto
  if (situacion.parado) {
    return mensajeProductoParado(nombre, situacion.parado.diasSinVender, situacion.stock, unidad)
  }
  const prediccion = situacion.prediccion
  if (!prediccion?.vendido.esPositiva()) return null
  const cobertura = Math.floor(
    ((situacion.stock.milesimas + compra.milesimas) * prediccion.diasValidos) /
      prediccion.vendido.milesimas,
  )
  if (cobertura <= diasMaximosDeCompra) return null
  const sugerida = situacion.enListaParaComprar ? situacion.cantidadSugerida : null
  return mensajeCompraExcesiva(nombre, cobertura, unidad, sugerida)
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
