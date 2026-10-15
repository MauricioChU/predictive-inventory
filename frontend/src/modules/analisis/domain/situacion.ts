import type {
  Prediccion,
  ProductoResumido,
  SituacionDeProducto,
} from '@/shared/contratos/entre-modulos'
import type { Cantidad } from '@/shared/domain/cantidad'
import { cantidadSugerida, entraEnLista } from './compras'
import { estadoDeStock } from './estado'
import { diasDeCobertura } from './prediccion'

export interface DatosDeSituacion {
  producto: Pick<ProductoResumido, 'id' | 'nombre' | 'unidad' | 'stockMinimo'>
  stock: Cantidad
  prediccion: Prediccion | null
  diasEntreCompras: number
  diasAnticipacion: number
  /** RN-AN-11: días sin vender si el producto está parado. */
  parado?: { diasSinVender: number } | null
}

/** Junta en un solo lugar todo lo que se sabe de un producto activo (RN-AN-04 a RN-AN-07, RN-AL-01). */
export function evaluarSituacion(d: DatosDeSituacion): SituacionDeProducto {
  const { producto, stock, prediccion, diasEntreCompras } = d
  const cobertura = prediccion === null ? null : diasDeCobertura(prediccion, stock)
  const estado = estadoDeStock({
    stock,
    stockMinimo: producto.stockMinimo,
    diasDeCobertura: cobertura,
    diasAnticipacion: d.diasAnticipacion,
  })
  const datosDeCompra = { stock, stockMinimo: producto.stockMinimo, prediccion, diasEntreCompras }
  const enLista = entraEnLista({ ...datosDeCompra, estado })
  return {
    productoId: producto.id,
    nombre: producto.nombre,
    unidad: producto.unidad,
    stock,
    stockMinimo: producto.stockMinimo,
    prediccion,
    diasDeCobertura: cobertura,
    estado,
    enListaParaComprar: enLista,
    cantidadSugerida: enLista
      ? cantidadSugerida({ ...datosDeCompra, unidad: producto.unidad })
      : null,
    parado: d.parado ?? null,
  }
}
