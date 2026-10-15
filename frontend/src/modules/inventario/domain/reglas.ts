import { Cantidad, type Unidad } from '@/shared/domain/cantidad'
import { Dinero } from '@/shared/domain/dinero'
import { ErrorDeDominio } from '@/shared/domain/errores'
import { diaDe, inicioDelDia, sumarDias, type Instante } from '@/shared/domain/fecha'
import { MOTIVOS_DE_MERMA, type MotivoDeMerma } from '@/shared/contratos/operaciones'
import type { OperacionRegistro } from '@/shared/contratos/registros'
import { mensajeStockInsuficiente } from './mensajes'

/** RN-OP-03: ningún movimiento pasa de 99 999 (en la unidad del producto). */
export const CANTIDAD_MAXIMA = Cantidad.deEntero(99_999)
/** RN-CAT-04: ningún precio pasa de S/ 99 999.99. */
export const PRECIO_MAXIMO = Dinero.deCentimos(9_999_999)
/** RN-OP-09: se puede anotar hasta 7 días atrás. */
export const DIAS_HACIA_ATRAS = 7
/** Spec 02, modelo de Operación: nota de hasta 200 caracteres. */
export const LARGO_MAXIMO_DE_NOTA = 200

/** RN-OP-03: mayor que 0 (antes de aplicar el signo) y no mayor a 99 999. */
export function validarCantidad(cantidad: Cantidad): Cantidad {
  if (!cantidad.esPositiva()) {
    throw new ErrorDeDominio('CANTIDAD_NO_POSITIVA', 'La cantidad debe ser mayor que 0')
  }
  if (cantidad.mayorQue(CANTIDAD_MAXIMA)) {
    throw new ErrorDeDominio('CANTIDAD_MAXIMA', 'La cantidad no puede pasar de 99 999')
  }
  return cantidad
}

/** Lee lo que escribió el usuario con la unidad del producto (RN-OP-04) y valida RN-OP-03. */
export function leerCantidad(texto: string, unidad: Unidad): Cantidad {
  return validarCantidad(Cantidad.deTexto(texto, unidad))
}

/** RN-OP-16: lo que hay realmente en el estante (puede ser 0, nunca negativo). */
export function leerContado(texto: string, unidad: Unidad): Cantidad {
  const contado = Cantidad.deTexto(texto, unidad)
  if (contado.esNegativa()) {
    throw new ErrorDeDominio('CONTADO_NEGATIVO', 'La cantidad contada no puede ser negativa')
  }
  if (contado.mayorQue(CANTIDAD_MAXIMA)) {
    throw new ErrorDeDominio('CANTIDAD_MAXIMA', 'La cantidad no puede pasar de 99 999')
  }
  return contado
}

/** RN-OP-09: ahora o hasta 7 días atrás (desde el inicio de ese día de negocio), nunca futura. */
export function validarFecha(ocurridaEn: Instante, ahora: Instante): void {
  const momento = Date.parse(ocurridaEn)
  if (Number.isNaN(momento)) throw new Error(`Fecha inválida: ${ocurridaEn}`)
  if (momento > Date.parse(ahora)) {
    throw new ErrorDeDominio('FECHA_FUTURA', 'La fecha no puede ser futura')
  }
  const limite = inicioDelDia(sumarDias(diaDe(ahora), -DIAS_HACIA_ATRAS))
  if (momento < Date.parse(limite)) {
    throw new ErrorDeDominio('FECHA_ANTIGUA', 'Solo puedes anotar hasta 7 días atrás')
  }
}

export interface DatosDeProducto {
  nombre: string
  unidad: Unidad
}

interface MovimientoConCantidad {
  productoId: string
  cantidad: Cantidad
}

/**
 * RN-OP-05: el stock nunca es negativo. Devuelve el stock resultante por producto o lanza
 * con el mensaje del PRIMER producto que falla, en el orden de las líneas. Un producto sin
 * registro de existencia tiene stock 0.
 */
export function validarStock(
  movimientos: readonly MovimientoConCantidad[],
  stockActual: ReadonlyMap<string, Cantidad>,
  productos: ReadonlyMap<string, DatosDeProducto>,
): Map<string, Cantidad> {
  const resultantes = new Map<string, Cantidad>()
  for (const movimiento of movimientos) {
    const actual = stockActual.get(movimiento.productoId) ?? Cantidad.cero()
    const resultante = actual.sumar(movimiento.cantidad)
    if (resultante.esNegativa()) {
      const producto = productos.get(movimiento.productoId)
      if (!producto) throw new Error(`Faltan los datos del producto ${movimiento.productoId}`)
      throw new ErrorDeDominio(
        'STOCK_INSUFICIENTE',
        mensajeStockInsuficiente(producto.nombre, producto.unidad, actual),
      )
    }
    resultantes.set(movimiento.productoId, resultante)
  }
  return resultantes
}

/**
 * RN-OP-07: suma en una sola línea las cantidades del mismo producto, en el orden en que
 * aparece cada producto por primera vez. Los demás datos (precio, costo) son los de la
 * primera línea de ese producto.
 */
export function fusionarLineas<T extends MovimientoConCantidad>(lineas: readonly T[]): T[] {
  const porProducto = new Map<string, T>()
  for (const linea of lineas) {
    const previa = porProducto.get(linea.productoId)
    porProducto.set(
      linea.productoId,
      previa ? { ...previa, cantidad: previa.cantidad.sumar(linea.cantidad) } : linea,
    )
  }
  return [...porProducto.values()]
}

export function exigirProducto<T>(producto: T | null): T {
  if (!producto) throw new ErrorDeDominio('PRODUCTO_INEXISTENTE', 'No encontramos ese producto')
  return producto
}

/** RN-OP-08: solo se operan productos activos. */
export function exigirProductoActivo<T extends { nombre: string; activo: boolean }>(
  producto: T | null,
): T {
  const existente = exigirProducto(producto)
  if (!existente.activo) {
    throw new ErrorDeDominio(
      'PRODUCTO_ARCHIVADO',
      `${existente.nombre} está archivado. Reactívalo para usarlo`,
    )
  }
  return existente
}

function validarTope(precio: Dinero): Dinero {
  if (precio.mayorQue(PRECIO_MAXIMO)) {
    throw new ErrorDeDominio('PRECIO_MAXIMO', 'El precio no puede pasar de S/ 99 999.99')
  }
  return precio
}

/** RN-OP-11: el precio de una línea de venta es mayor que S/ 0.00. */
export function validarPrecioDeVenta(precio: Dinero): Dinero {
  if (!precio.esPositivo()) {
    throw new ErrorDeDominio(
      'PRECIO_VENTA_NO_POSITIVO',
      'El precio de venta debe ser mayor que S/ 0.00',
    )
  }
  return validarTope(precio)
}

export function leerPrecioDeVenta(texto: string): Dinero {
  return validarPrecioDeVenta(Dinero.deTexto(texto))
}

/** RN-OP-14 con los límites de RN-CAT-04: el costo es el precio de compra de esa mercadería. */
export function validarCosto(costo: Dinero): Dinero {
  if (costo.esNegativo()) {
    throw new ErrorDeDominio('PRECIO_COMPRA_NEGATIVO', 'El precio de compra no puede ser negativo')
  }
  return validarTope(costo)
}

export function leerCosto(texto: string): Dinero {
  return validarCosto(Dinero.deTexto(texto))
}

function esMotivoDeMerma(motivo: string): motivo is MotivoDeMerma {
  return (MOTIVOS_DE_MERMA as readonly string[]).includes(motivo)
}

/** RN-OP-15: motivo obligatorio de la lista; "Otro" exige nota. */
export function validarMotivoDeMerma(
  motivo: string,
  nota: string | null | undefined,
): MotivoDeMerma {
  const elegido = motivo.trim()
  if (!esMotivoDeMerma(elegido)) {
    throw new ErrorDeDominio('MOTIVO_REQUERIDO', 'Elige qué pasó con el producto')
  }
  if (elegido === 'Otro' && !nota?.trim()) {
    throw new ErrorDeDominio('NOTA_REQUERIDA', 'Cuéntanos qué pasó')
  }
  return elegido
}

/** Nota opcional: recortada, null si queda vacía, máximo 200 caracteres. */
export function normalizarNota(nota: string | null | undefined): string | null {
  const recortada = nota?.trim() ?? ''
  if (recortada === '') return null
  if (recortada.length > LARGO_MAXIMO_DE_NOTA) {
    throw new ErrorDeDominio('NOTA_MUY_LARGA', 'La nota puede tener hasta 200 caracteres')
  }
  return recortada
}

/** RN-OP-17. */
export function exigirOperacion<T>(registro: T | null): T {
  if (!registro) {
    throw new ErrorDeDominio('OPERACION_INEXISTENTE', 'No encontramos esa operación')
  }
  return registro
}

/** RN-OP-17: cualquier operación se anula una sola vez. */
export function exigirSinAnular(anulacionExistente: unknown): void {
  if (anulacionExistente) {
    throw new ErrorDeDominio('OPERACION_YA_ANULADA', 'Esta operación ya fue anulada')
  }
}

/** RN-OP-19 / ADR-0002: la existencia de cada producto es la suma de sus movimientos. */
export function existenciasDelLibro(
  operaciones: readonly OperacionRegistro[],
): Map<string, Cantidad> {
  const existencias = new Map<string, Cantidad>()
  for (const movimiento of operaciones.flatMap((o) => o.movimientos)) {
    const actual = existencias.get(movimiento.productoId) ?? Cantidad.cero()
    existencias.set(movimiento.productoId, actual.sumar(Cantidad.deMilesimas(movimiento.cantidad)))
  }
  return existencias
}

export interface DiferenciaDeExistencia {
  productoId: string
  antes: Cantidad
  despues: Cantidad
}

/**
 * RN-OP-19: productos cuya existencia guardada no es la del libro (sin registro = 0), primero
 * los que tienen existencia guardada.
 */
export function diferenciasDeExistencias(
  guardadas: ReadonlyMap<string, Cantidad>,
  delLibro: ReadonlyMap<string, Cantidad>,
): DiferenciaDeExistencia[] {
  const productos = new Set([...guardadas.keys(), ...delLibro.keys()])
  return [...productos]
    .map((productoId) => ({
      productoId,
      antes: guardadas.get(productoId) ?? Cantidad.cero(),
      despues: delLibro.get(productoId) ?? Cantidad.cero(),
    }))
    .filter((d) => !d.antes.igualA(d.despues))
}
