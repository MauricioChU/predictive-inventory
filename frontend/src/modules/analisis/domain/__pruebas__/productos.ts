import type { ProductoResumido } from '@/shared/contratos/entre-modulos'
import { Cantidad, type Unidad } from '@/shared/domain/cantidad'
import { Dinero } from '@/shared/domain/dinero'

/** Producto de prueba con los datos tal como aparecen en los `.feature`. */
export function producto(
  id: string,
  nombre: string,
  unidad: Unidad,
  compra: string,
  venta: string,
  minimo: string,
  opciones: { activo?: boolean } = {},
): ProductoResumido {
  return {
    id,
    nombre,
    unidad,
    categoriaId: 'otros',
    categoriaNombre: 'Otros',
    precioCompra: Dinero.deTexto(compra),
    precioVenta: Dinero.deTexto(venta),
    stockMinimo: Cantidad.deTexto(minimo, unidad),
    activo: opciones.activo ?? true,
    tieneFoto: false,
  }
}

// Antecedentes de torre-de-control.feature
export const LEJIA = producto('lejia', 'Lejía 1 L', 'UNIDAD', '2.40', '3.50', '3')
export const CARBON = producto('carbon', 'Carbón', 'KILO', '2.75', '4.00', '3')
export const JABON = producto('jabon', 'Jabón', 'UNIDAD', '1.20', '2.00', '3')
export const BOLSAS = producto('bolsas', 'Bolsas', 'UNIDAD', '0.05', '0.10', '0')
export const DETERGENTE = producto('detergente', 'Detergente a granel', 'KILO', '5.30', '7.90', '2')

// Escenarios de precios para revisar y productos parados
export const CERA_ROJA = producto('cera', 'Cera roja', 'UNIDAD', '5.00', '4.50', '2')
export const DESATORADOR = producto('desatorador', 'Desatorador', 'UNIDAD', '3.00', '3.00', '2')
export const ESCOBA = producto('escoba', 'Escoba', 'UNIDAD', '6.00', '9.00', '1')
export const TRAPEADOR = producto('trapeador', 'Trapeador', 'UNIDAD', '8.00', '12.00', '1')
export const RECOGEDOR = producto('recogedor', 'Recogedor', 'UNIDAD', '3.00', '5.00', '1')

/** Cantidad escrita como en los `.feature` ("5", "1.5"). */
export function cant(texto: string): Cantidad {
  return Cantidad.deTexto(texto, 'KILO')
}

/** Monto escrito como en los `.feature` ("S/ 2.40", "2.40"). */
export function soles(texto: string): Dinero {
  return Dinero.deTexto(texto)
}
