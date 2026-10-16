import type { ConfiguracionDeNegocio } from '@/shared/contratos/configuracion'
import type { ProductoResumido, SituacionDeProducto } from '@/shared/contratos/entre-modulos'
import { Cantidad } from '@/shared/domain/cantidad'
import { diaDe, sumarDias, type Dia } from '@/shared/domain/fecha'
import { diasSinVender, podriaEstarParado, ultimoDiaConVenta } from '../domain/observaciones'
import { calcularPrediccion } from '../domain/prediccion'
import { ResumenDiario } from '../domain/resumen-diario'
import { evaluarSituacion } from '../domain/situacion'
import type { DependenciasDeAnalisis } from './puertos'

/**
 * Días que se leen de la proyección de una vez (RN-SIS-09): cubren los 56 días del mejor día,
 * los 30 de productos parados, los 28 de la predicción y los 8 bloques de la tendencia.
 */
export const DIAS_DE_LA_VENTANA_DE_ANALISIS = 60

export function hoyDe(d: Pick<DependenciasDeAnalisis, 'reloj'>): Dia {
  return diaDe(d.reloj.ahora())
}

/** Inicio de la ventana de lectura para `hoy`. */
export function inicioDeLaVentana(hoy: Dia): Dia {
  return sumarDias(hoy, -DIAS_DE_LA_VENTANA_DE_ANALISIS)
}

/** Lo que la Torre de control necesita leer, en una sola pasada. */
export interface DatosDeAnalisis {
  hoy: Dia
  configuracion: ConfiguracionDeNegocio
  /** Todos los productos, activos y archivados. */
  productos: ProductoResumido[]
  existencias: Map<string, Cantidad>
  /** Filas de toda la tienda en la ventana de análisis, hasta hoy. */
  filas: ResumenDiario[]
}

export async function cargarDatos(d: DependenciasDeAnalisis): Promise<DatosDeAnalisis> {
  const hoy = hoyDe(d)
  const [configuracion, productos, [existencias, registros]] = await Promise.all([
    d.tienda().configuracion(),
    d.catalogo().productos(),
    // El stock y las filas salen de la misma foto (una transacción): una venta confirmada a
    // mitad de la lectura no puede aparecer en uno y no en el otro (ADR-0002).
    d.uow.ejecutar(() =>
      Promise.all([d.inventario().existencias(), d.resumenes.entre(inicioDeLaVentana(hoy), hoy)]),
    ),
  ])
  return {
    hoy,
    configuracion,
    productos,
    existencias,
    filas: registros.map(ResumenDiario.desdeRegistro),
  }
}

/** Un producto activo con su situación y las filas de la ventana con que se calculó. */
export interface EvaluacionDeProducto {
  hoy: Dia
  producto: ProductoResumido
  situacion: SituacionDeProducto
  filas: ResumenDiario[]
}

async function evaluar(
  d: DependenciasDeAnalisis,
  datos: {
    hoy: Dia
    configuracion: ConfiguracionDeNegocio
    producto: ProductoResumido
    stock: Cantidad
    filas: ResumenDiario[]
  },
): Promise<EvaluacionDeProducto> {
  const { hoy, producto, stock, filas } = datos
  const primerDia = await d.resumenes.primerDiaDe(producto.id)
  let ultimaVenta = ultimoDiaConVenta(filas, hoy)
  // La última venta puede ser anterior a la ventana: solo se busca si podría estar parado.
  if (ultimaVenta === null && podriaEstarParado({ hoy, stock, primerDia })) {
    ultimaVenta = await d.resumenes.ultimoDiaConVentaDe(producto.id)
  }
  const dias = diasSinVender({ hoy, stock, primerDia, ultimoDiaConVenta: ultimaVenta })
  const situacion = evaluarSituacion({
    producto,
    stock,
    prediccion: calcularPrediccion({ hoy, stock, primerDia, filas }),
    diasEntreCompras: datos.configuracion.diasEntreCompras,
    diasAnticipacion: datos.configuracion.diasAnticipacion,
    parado: dias === null ? null : { diasSinVender: dias },
  })
  return { hoy, producto, situacion, filas }
}

/** Situación de cada producto activo, con los datos ya leídos (RN-AL-01: sin archivados). */
export async function evaluarProductos(
  d: DependenciasDeAnalisis,
  datos: DatosDeAnalisis,
): Promise<EvaluacionDeProducto[]> {
  const filasPorProducto = new Map<string, ResumenDiario[]>()
  for (const fila of datos.filas) {
    const delProducto = filasPorProducto.get(fila.productoId)
    if (delProducto) delProducto.push(fila)
    else filasPorProducto.set(fila.productoId, [fila])
  }
  return Promise.all(
    datos.productos
      .filter((p) => p.activo)
      .map((producto) =>
        evaluar(d, {
          hoy: datos.hoy,
          configuracion: datos.configuracion,
          producto,
          stock: datos.existencias.get(producto.id) ?? Cantidad.cero(),
          filas: filasPorProducto.get(producto.id) ?? [],
        }),
      ),
  )
}

/** Evalúa un solo producto leyendo solo sus filas; null si no existe o está archivado. */
export async function evaluarProducto(
  d: DependenciasDeAnalisis,
  productoId: string,
): Promise<EvaluacionDeProducto | null> {
  const producto = await d.catalogo().producto(productoId)
  if (!producto?.activo) return null
  const hoy = hoyDe(d)
  const [configuracion, stock, registros] = await Promise.all([
    d.tienda().configuracion(),
    d.inventario().stockDe(productoId),
    d.resumenes.deProductoEntre(productoId, inicioDeLaVentana(hoy), hoy),
  ])
  return evaluar(d, {
    hoy,
    configuracion,
    producto,
    stock,
    filas: registros.map(ResumenDiario.desdeRegistro),
  })
}
