import type { Cantidad } from '@/shared/domain/cantidad'
import type { Dinero } from '@/shared/domain/dinero'
import { ErrorDeDominio } from '@/shared/domain/errores'
import type { Dia } from '@/shared/domain/fecha'
import {
  aplicarCambiosALista,
  armarListaParaComprar,
  cambiosARegistro,
  cambiosDesdeRegistro,
  cantidadDeLista,
  registrarCambio,
  textoParaCompartir as textoDeLaLista,
  type CambioEnLista,
  type ListaParaComprar,
} from '../domain/compras'
import type { DependenciasDeAnalisis } from './puertos'
import { cargarDatos, evaluarProductos, hoyDe, type EvaluacionDeProducto } from './situaciones'

export const PRODUCTO_NO_ENCONTRADO = 'No encontré ese producto'

/** RN-AN-07: la lista sugerida, sin los cambios del usuario. */
export function listaSugerida(evaluaciones: readonly EvaluacionDeProducto[]): ListaParaComprar {
  return armarListaParaComprar(
    evaluaciones.map((e) => ({ situacion: e.situacion, precioCompra: e.producto.precioCompra })),
  )
}

/** RN-AN-08: los cambios valen solo el día en que se hicieron. */
export async function cambiosDelDia(d: DependenciasDeAnalisis, dia: Dia): Promise<CambioEnLista[]> {
  return cambiosDesdeRegistro(await d.listaDeCompras.delDia(dia))
}

/** RN-AN-07 / RN-AN-08: la lista sugerida con los cambios del día. */
export async function listaParaComprar(d: DependenciasDeAnalisis): Promise<ListaParaComprar> {
  const datos = await cargarDatos(d)
  const [evaluaciones, cambios] = await Promise.all([
    evaluarProductos(d, datos),
    cambiosDelDia(d, datos.hoy),
  ])
  return aplicarCambiosALista(listaSugerida(evaluaciones), cambios)
}

async function guardarCambio(d: DependenciasDeAnalisis, cambio: CambioEnLista): Promise<void> {
  await d.uow.ejecutar(async () => {
    const hoy = hoyDe(d)
    const cambios = registrarCambio(await cambiosDelDia(d, hoy), cambio)
    await d.listaDeCompras.guardar(cambiosARegistro(hoy, cambios))
  })
}

/** RN-AN-08: el usuario cambia la cantidad de una línea (se recuerda hasta el final del día). */
export async function cambiarCantidadEnLista(
  d: DependenciasDeAnalisis,
  productoId: string,
  texto: string,
): Promise<void> {
  const producto = await d.catalogo().producto(productoId)
  if (!producto?.activo) throw new ErrorDeDominio('PRODUCTO_NO_ENCONTRADO', PRODUCTO_NO_ENCONTRADO)
  await guardarCambio(d, { productoId, cantidad: cantidadDeLista(texto, producto.unidad) })
}

/** RN-AN-08: el usuario quita un producto de la lista del día. */
export async function quitarDeLista(d: DependenciasDeAnalisis, productoId: string): Promise<void> {
  await guardarCambio(d, { productoId, cantidad: null })
}

/** RN-AN-08: la lista como texto para WhatsApp u otra app. */
export async function textoParaCompartir(d: DependenciasDeAnalisis): Promise<string> {
  const [lista, configuracion] = await Promise.all([
    listaParaComprar(d),
    d.tienda().configuracion(),
  ])
  return textoDeLaLista(lista, configuracion.nombreTienda, hoyDe(d))
}

/** RN-AN-08: "Registrar llegada" abre Llegó mercadería con estas líneas (editables allá). */
export async function lineasParaRegistrarLlegada(
  d: DependenciasDeAnalisis,
): Promise<{ productoId: string; cantidad: Cantidad; costo: Dinero }[]> {
  const lista = await listaParaComprar(d)
  return lista.lineas.map((l) => ({
    productoId: l.productoId,
    cantidad: l.cantidad,
    costo: l.precioCompra,
  }))
}
