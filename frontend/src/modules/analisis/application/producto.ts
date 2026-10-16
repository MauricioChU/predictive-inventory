import type { SituacionDeProducto } from '@/shared/contratos/entre-modulos'
import type { Cantidad, Unidad } from '@/shared/domain/cantidad'
import { ErrorDeDominio } from '@/shared/domain/errores'
import type { Instante } from '@/shared/domain/fecha'
import { respuestaNecesitoComprar } from '../domain/necesito-comprar'
import { tendencia } from '../domain/observaciones'
import { textoCobertura, textoVentaDiaria } from '../domain/prediccion'
import { cambiosDelDia, PRODUCTO_NO_ENCONTRADO } from './lista-de-compras'
import type { DependenciasDeAnalisis } from './puertos'
import { evaluarProducto } from './situaciones'

export interface RespuestaNecesitoComprar {
  /** RN-AN-16: una sola frase. */
  respuesta: string
  stock: Cantidad
  unidad: Unidad
  /** Última vez que llegó mercadería de ese producto. */
  ultimoIngreso: Instante | null
}

export interface DetalleDeProducto {
  situacion: SituacionDeProducto
  /** RN-AN-05. */
  textoCobertura: string | null
  /** "Vendes ~2 unid. al día". */
  textoVentaDiaria: string | null
  /** RN-AN-14: 8 valores, del bloque más antiguo al más reciente. */
  tendencia: Cantidad[]
}

/** RN-AN-16: "¿Necesito comprar?" para un producto activo, con la lista de hoy (RN-AN-08). */
export async function necesitoComprar(
  d: DependenciasDeAnalisis,
  productoId: string,
): Promise<RespuestaNecesitoComprar> {
  const evaluacion = await evaluarProducto(d, productoId)
  if (!evaluacion) throw new ErrorDeDominio('PRODUCTO_NO_ENCONTRADO', PRODUCTO_NO_ENCONTRADO)
  const { hoy, producto, situacion } = evaluacion
  const cambio = (await cambiosDelDia(d, hoy)).find((c) => c.productoId === productoId)
  return {
    respuesta: respuestaNecesitoComprar(situacion, producto.precioCompra, cambio),
    stock: situacion.stock,
    unidad: situacion.unidad,
    ultimoIngreso: await d.inventario().ultimoIngresoDe(productoId),
  }
}

/** Lo que el detalle del producto muestra del análisis; null si no existe o está archivado. */
export async function detalleDeProducto(
  d: DependenciasDeAnalisis,
  productoId: string,
): Promise<DetalleDeProducto | null> {
  const evaluacion = await evaluarProducto(d, productoId)
  if (!evaluacion) return null
  const { hoy, situacion, filas } = evaluacion
  return {
    situacion,
    textoCobertura: textoCobertura(situacion.prediccion, situacion.stock),
    textoVentaDiaria: textoVentaDiaria(situacion.prediccion, situacion.unidad),
    tendencia: tendencia(filas, hoy),
  }
}
