import type { Prediccion, SituacionDeProducto } from '@/shared/contratos/entre-modulos'
import type { ListaDeComprasRegistro } from '@/shared/contratos/registros'
import { GRAVEDAD_DE_ESTADO, type EstadoDeStock } from '@/shared/contratos/estado-de-stock'
import { Cantidad, type Unidad } from '@/shared/domain/cantidad'
import { Dinero } from '@/shared/domain/dinero'
import { ErrorDeDominio } from '@/shared/domain/errores'
import type { Dia } from '@/shared/domain/fecha'
import { formatearCantidad, formatearDia, formatearDinero } from '@/shared/domain/formato'

export interface LineaParaComprar {
  productoId: string
  nombre: string
  unidad: Unidad
  estado: EstadoDeStock
  diasDeCobertura: number | null
  cantidad: Cantidad
  /** Precio de compra del producto: base del costo estimado y del costo en "Registrar llegada". */
  precioCompra: Dinero
  costoEstimado: Dinero
}

export interface ListaParaComprar {
  lineas: LineaParaComprar[]
  total: Dinero
}

/** Cambio del usuario a la lista del día: otra cantidad, o `null` si lo quitó (RN-AN-08). */
export interface CambioEnLista {
  productoId: string
  cantidad: Cantidad | null
}

export interface DatosDeCompra {
  stock: Cantidad
  stockMinimo: Cantidad
  prediccion: Prediccion | null
  diasEntreCompras: number
}

function dividirHaciaArriba(numerador: number, divisor: number): number {
  return Math.ceil(numerador / divisor)
}

/**
 * RN-AN-06, con enteros en milésimas. Con predicción (v vendido en n días válidos):
 * faltante·n = (mínimo·n + v·f) − stock·n; sin predicción (n = 1): faltante = 2·mínimo − stock.
 * Se redondea hacia arriba al incremento de la unidad y nunca es menor que un incremento.
 */
export function cantidadSugerida(d: DatosDeCompra & { unidad: Unidad }): Cantidad {
  const incremento = Cantidad.incrementoDe(d.unidad).milesimas
  const minimo = d.stockMinimo.milesimas
  const stock = d.stock.milesimas
  const n = d.prediccion?.diasValidos ?? 1
  const faltantePorN =
    d.prediccion === null
      ? 2 * minimo - stock
      : minimo * n + d.prediccion.vendido.milesimas * d.diasEntreCompras - stock * n
  if (faltantePorN <= 0) return Cantidad.deMilesimas(incremento)
  return Cantidad.deMilesimas(dividirHaciaArriba(faltantePorN, n * incremento) * incremento)
}

/** RN-AN-07: agotado o por acabarse, o con predicción no le alcanza hasta la próxima compra. */
export function entraEnLista(d: DatosDeCompra & { estado: EstadoDeStock }): boolean {
  if (d.estado !== 'NORMAL') return true
  if (d.prediccion === null) return false
  const n = d.prediccion.diasValidos
  const alLlegarLaProximaCompra =
    d.stock.milesimas * n - d.prediccion.vendido.milesimas * d.diasEntreCompras
  return alLlegarLaProximaCompra < d.stockMinimo.milesimas * n
}

function compararCobertura(a: number | null, b: number | null): number {
  if (a === b) return 0
  if (a === null) return 1
  if (b === null) return -1
  return a - b
}

/** RN-AN-07: agotados, por acabarse y el resto; menos cobertura primero (null al final); nombre. */
export function ordenarLista(lineas: readonly LineaParaComprar[]): LineaParaComprar[] {
  return [...lineas].sort(
    (a, b) =>
      GRAVEDAD_DE_ESTADO[b.estado] - GRAVEDAD_DE_ESTADO[a.estado] ||
      compararCobertura(a.diasDeCobertura, b.diasDeCobertura) ||
      a.nombre.localeCompare(b.nombre, 'es'),
  )
}

function conCantidad(linea: LineaParaComprar, cantidad: Cantidad): LineaParaComprar {
  return { ...linea, cantidad, costoEstimado: linea.precioCompra.multiplicarPor(cantidad) }
}

function conTotal(lineas: LineaParaComprar[]): ListaParaComprar {
  return { lineas, total: Dinero.sumarTodos(lineas.map((l) => l.costoEstimado)) }
}

/** RN-AN-07 / RN-AN-08: la lista sugerida, con el costo estimado de cada línea y el total. */
export function armarListaParaComprar(
  entradas: readonly { situacion: SituacionDeProducto; precioCompra: Dinero }[],
): ListaParaComprar {
  const lineas = entradas.flatMap(({ situacion: s, precioCompra }): LineaParaComprar[] =>
    s.enListaParaComprar && s.cantidadSugerida
      ? [
          {
            productoId: s.productoId,
            nombre: s.nombre,
            unidad: s.unidad,
            estado: s.estado,
            diasDeCobertura: s.diasDeCobertura,
            cantidad: s.cantidadSugerida,
            precioCompra,
            costoEstimado: precioCompra.multiplicarPor(s.cantidadSugerida),
          },
        ]
      : [],
  )
  return conTotal(ordenarLista(lineas))
}

/** RN-AN-08: los cambios del día reemplazan la cantidad o quitan la línea. */
export function aplicarCambiosALista(
  lista: ListaParaComprar,
  cambios: readonly CambioEnLista[],
): ListaParaComprar {
  const porProducto = new Map(cambios.map((c) => [c.productoId, c.cantidad]))
  const lineas = lista.lineas.flatMap((linea) => {
    if (!porProducto.has(linea.productoId)) return [linea]
    const cantidad = porProducto.get(linea.productoId)
    return cantidad ? [conCantidad(linea, cantidad)] : []
  })
  return conTotal(lineas)
}

/** RN-OP-03: lo que se pide se registrará como llegada de mercadería. */
const CANTIDAD_MAXIMA = Cantidad.deEntero(99_999)

/** RN-AN-08: valida la cantidad que el usuario escribe en una línea de la lista. */
export function cantidadDeLista(texto: string, unidad: Unidad): Cantidad {
  const cantidad = Cantidad.deTexto(texto, unidad)
  if (!cantidad.esPositiva()) {
    throw new ErrorDeDominio('CANTIDAD_NO_POSITIVA', 'La cantidad debe ser mayor que 0')
  }
  if (cantidad.mayorQue(CANTIDAD_MAXIMA)) {
    throw new ErrorDeDominio('CANTIDAD_MAXIMA', 'La cantidad no puede pasar de 99 999')
  }
  return cantidad
}

export function cambiosDesdeRegistro(registro: ListaDeComprasRegistro | null): CambioEnLista[] {
  return (registro?.cambios ?? []).map((c) => ({
    productoId: c.productoId,
    cantidad: c.cantidad === null ? null : Cantidad.deMilesimas(c.cantidad),
  }))
}

export function cambiosARegistro(
  dia: Dia,
  cambios: readonly CambioEnLista[],
): ListaDeComprasRegistro {
  return {
    dia,
    cambios: cambios.map((c) => ({
      productoId: c.productoId,
      cantidad: c.cantidad === null ? null : c.cantidad.milesimas,
    })),
  }
}

/** Agrega un cambio a los del día; reemplaza el anterior del mismo producto. */
export function registrarCambio(
  cambios: readonly CambioEnLista[],
  cambio: CambioEnLista,
): CambioEnLista[] {
  return [...cambios.filter((c) => c.productoId !== cambio.productoId), cambio]
}

/** RN-AN-08: texto para WhatsApp u otra app. */
export function textoParaCompartir(
  lista: ListaParaComprar,
  nombreTienda: string,
  hoy: Dia,
): string {
  const nombre = nombreTienda.trim()
  const titulo = nombre
    ? `Lista de compras – ${nombre} – ${formatearDia(hoy)}`
    : `Lista de compras – ${formatearDia(hoy)}`
  return [
    titulo,
    ...lista.lineas.map((l) => `• ${l.nombre}: ${formatearCantidad(l.cantidad, l.unidad)}`),
    `Total estimado: ${formatearDinero(lista.total)}`,
  ].join('\n')
}
