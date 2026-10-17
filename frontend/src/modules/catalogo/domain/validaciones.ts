import { Cantidad, type Unidad } from '@/shared/domain/cantidad'
import { Dinero } from '@/shared/domain/dinero'
import { ErrorDeDominio } from '@/shared/domain/errores'
import { formatearDinero } from '@/shared/domain/formato'

/** Precio máximo admitido, S/ 99 999.99 (RN-CAT-04). */
export const PRECIO_MAXIMO = Dinero.deCentimos(9_999_999)

/** RN-CAT-01: obligatorio, 2 a 80 caracteres tras recortar espacios exteriores. */
export function leerNombre(nombre: string): string {
  const recortado = nombre.trim()
  if (recortado === '') {
    throw new ErrorDeDominio('NOMBRE_VACIO', 'Escribe el nombre del producto')
  }
  if (recortado.length < 2 || recortado.length > 80) {
    throw new ErrorDeDominio('NOMBRE_INVALIDO', 'El nombre debe tener entre 2 y 80 letras')
  }
  return recortado
}

function verificarLimiteMaximo(precio: Dinero): void {
  if (precio.mayorQue(PRECIO_MAXIMO)) {
    throw new ErrorDeDominio(
      'PRECIO_MAXIMO',
      `El precio no puede pasar de ${formatearDinero(PRECIO_MAXIMO)}`,
    )
  }
}

/** RN-CAT-04: el precio de compra es ≥ S/ 0.00 y como máximo S/ 99 999.99. */
export function leerPrecioCompra(texto: string): Dinero {
  return verificarPrecioCompra(Dinero.deTexto(texto))
}

/** RN-CAT-04 sobre un Dinero ya construido (también lo usa actualizarPrecioCompra). */
export function verificarPrecioCompra(precio: Dinero): Dinero {
  if (precio.esNegativo()) {
    throw new ErrorDeDominio('PRECIO_COMPRA_NEGATIVO', 'El precio de compra no puede ser negativo')
  }
  verificarLimiteMaximo(precio)
  return precio
}

/** RN-CAT-04: el precio de venta es > S/ 0.00 y como máximo S/ 99 999.99. */
export function leerPrecioVenta(texto: string): Dinero {
  const precio = Dinero.deTexto(texto)
  if (!precio.esPositivo()) {
    throw new ErrorDeDominio(
      'PRECIO_VENTA_INVALIDO',
      `El precio de venta debe ser mayor que ${formatearDinero(Dinero.cero())}`,
    )
  }
  verificarLimiteMaximo(precio)
  return precio
}

/** RN-CAT-06: ≥ 0 y respeta la precisión de la unidad (Cantidad.deTexto, RN-OP-04). */
export function leerStockMinimo(texto: string, unidad: Unidad): Cantidad {
  const cantidad = Cantidad.deTexto(texto, unidad)
  if (cantidad.esNegativa()) {
    throw new ErrorDeDominio('STOCK_MINIMO_NEGATIVO', 'El stock mínimo no puede ser negativo')
  }
  return cantidad
}

/** RN-CAT-08: ≥ 0; vacío/indefinido es stock cero (no registra operación). */
export function leerStockInicial(texto: string | undefined, unidad: Unidad): Cantidad {
  const limpio = texto?.trim()
  if (!limpio) return Cantidad.cero()
  const cantidad = Cantidad.deTexto(limpio, unidad)
  if (cantidad.esNegativa()) {
    throw new ErrorDeDominio('STOCK_INICIAL_NEGATIVO', 'El stock inicial no puede ser negativo')
  }
  return cantidad
}
