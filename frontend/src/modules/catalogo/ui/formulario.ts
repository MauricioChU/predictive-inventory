import type { Unidad } from '@/shared/domain/cantidad'
import { Dinero } from '@/shared/domain/dinero'
import { esErrorDeDominio } from '@/shared/domain/errores'
import { formatearDinero } from '@/shared/domain/formato'
import { MENSAJE_ELIGE_CATEGORIA, mensajePerdida, NOMBRE_DE_UNIDAD } from '../domain/mensajes'
import {
  leerNombre,
  leerPrecioCompra,
  leerPrecioVenta,
  leerStockInicial,
  leerStockMinimo,
} from '../domain/validaciones'

/** Los campos del formulario de producto, en el orden en que aparecen. */
export type CampoDeProducto =
  | 'nombre'
  | 'foto'
  | 'categoria'
  | 'unidad'
  | 'precioCompra'
  | 'precioVenta'
  | 'stockMinimo'
  | 'stockInicial'

export const ORDEN_DE_CAMPOS: readonly CampoDeProducto[] = [
  'nombre',
  'foto',
  'categoria',
  'unidad',
  'precioCompra',
  'precioVenta',
  'stockMinimo',
  'stockInicial',
]

/** Lo escrito en el formulario, tal cual (el dominio lo lee con sus reglas). */
export interface ValoresDeProducto {
  nombre: string
  categoriaId: string | null
  unidad: Unidad
  precioCompra: string
  precioVenta: string
  stockMinimo: string
  stockInicial: string
}

export type ErroresDeCampos = Partial<Record<CampoDeProducto, string>>

/** El mensaje del dominio si `leer` lo rechaza; cualquier otro fallo sigue de largo. */
function mensajeDe(leer: () => unknown): string | undefined {
  try {
    leer()
    return undefined
  } catch (error) {
    if (esErrorDeDominio(error)) return error.message
    throw error
  }
}

/**
 * RN-CAT-01/04/06/08: revisa CADA campo con las mismas reglas del dominio que usa el caso de
 * uso, para mostrar todos los errores a la vez y cada uno junto a su campo (el caso de uso se
 * detiene en el primero y no dice de qué campo es). La unicidad del nombre la revisa el caso
 * de uso al guardar (ver `campoDelError`).
 */
export function erroresDeCampos(
  valores: ValoresDeProducto,
  opciones: { conStockInicial: boolean },
): ErroresDeCampos {
  const errores: ErroresDeCampos = {
    nombre: mensajeDe(() => leerNombre(valores.nombre)),
    categoria: valores.categoriaId ? undefined : MENSAJE_ELIGE_CATEGORIA,
    precioCompra: mensajeDe(() => leerPrecioCompra(valores.precioCompra)),
    precioVenta: mensajeDe(() => leerPrecioVenta(valores.precioVenta)),
    stockMinimo: mensajeDe(() => leerStockMinimo(valores.stockMinimo, valores.unidad)),
    stockInicial: opciones.conStockInicial
      ? mensajeDe(() => leerStockInicial(valores.stockInicial, valores.unidad))
      : undefined,
  }
  return Object.fromEntries(
    Object.entries(errores).filter(([, mensaje]) => mensaje !== undefined),
  ) as ErroresDeCampos
}

const CAMPO_POR_CODIGO: Readonly<Record<string, CampoDeProducto>> = {
  NOMBRE_VACIO: 'nombre',
  NOMBRE_INVALIDO: 'nombre',
  NOMBRE_DUPLICADO: 'nombre',
  CATEGORIA_INEXISTENTE: 'categoria',
  UNIDAD_CON_MOVIMIENTOS: 'unidad',
  PRECIO_COMPRA_NEGATIVO: 'precioCompra',
  PRECIO_VENTA_INVALIDO: 'precioVenta',
  STOCK_MINIMO_NEGATIVO: 'stockMinimo',
  // Al cambiar la unidad a UNIDAD con un mínimo con decimales (editarProducto).
  CANTIDAD_ENTERA: 'stockMinimo',
  STOCK_INICIAL_NEGATIVO: 'stockInicial',
  FOTO_INVALIDA: 'foto',
  FOTO_PESADA: 'foto',
}

/** A qué campo pertenece un error que devolvió el caso de uso; null si es general. */
export function campoDelError(codigo: string): CampoDeProducto | null {
  return Object.hasOwn(CAMPO_POR_CODIGO, codigo) ? (CAMPO_POR_CODIGO[codigo] ?? null) : null
}

function leerMonto(texto: string): Dinero | null {
  try {
    return Dinero.deTexto(texto)
  } catch {
    return null
  }
}

/**
 * Lo que se gana con los precios escritos ("Ganas S/ 1.10 por cada unidad"); con pérdida o sin
 * ganancia, el mismo texto que pedirá confirmar al guardar (RN-CAT-05). Null si falta un precio
 * válido.
 */
export function textoDeGanancia(compra: string, venta: string, unidad: Unidad): string | null {
  const precioCompra = leerMonto(compra)
  const precioVenta = leerMonto(venta)
  if (!precioCompra || !precioVenta || precioCompra.esNegativo() || !precioVenta.esPositivo()) {
    return null
  }
  const ganancia = precioVenta.restar(precioCompra)
  if (ganancia.esPositivo()) {
    return `Ganas ${formatearDinero(ganancia)} por cada ${NOMBRE_DE_UNIDAD[unidad]}`
  }
  return mensajePerdida(precioCompra.restar(precioVenta), unidad)
}
