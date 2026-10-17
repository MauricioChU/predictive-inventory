import { aplicarCambiosALista, type ListaParaComprar } from '../domain/compras'
import {
  masVendidos,
  mejorDiaDeLaSemana,
  preciosParaRevisar,
  productosEnAtencion,
  productosParados,
  semanaContraSemana,
  type ComparacionSemanal,
  type MasVendidos,
  type MejorDia,
  type PrecioParaRevisar,
  type ProductosEnAtencion,
  type ProductosParados,
} from '../domain/observaciones'
import {
  rangoDePeriodo,
  resumenDePeriodo,
  ultimosDias,
  type Periodo,
  type ResumenDePeriodo,
} from '../domain/periodos'
import { ResumenDiario } from '../domain/resumen-diario'
import { cambiosDelDia, listaSugerida } from './lista-de-compras'
import type { DependenciasDeAnalisis } from './puertos'
import { cargarDatos, evaluarProductos, hoyDe } from './situaciones'

/** Secciones de la vista Control, en el orden de 04-torre-de-control. */
export interface TorreDeControl {
  resumen: ResumenDePeriodo
  atencion: { agotados: number; porAcabarse: number; preciosParaRevisar: number }
  /** Lo que abre cada fila de Atención (los precios para revisar van en `preciosParaRevisar`). */
  productosEnAtencion: ProductosEnAtencion
  paraComprar: ListaParaComprar
  masVendidos: MasVendidos
  semana: ComparacionSemanal
  mejorDia: MejorDia
  parados: ProductosParados
  preciosParaRevisar: PrecioParaRevisar[]
}

export interface OpcionesDeTorre {
  /** RN-AN-03; por defecto, hoy. */
  periodo?: Periodo
  /** RN-AN-09; por defecto, 7 días. */
  periodoMasVendidos?: 7 | 30
}

/** RN-AN-02 / RN-AN-03: ventas, ganancias y pérdidas de un periodo (Inicio usa HOY). */
export async function consultarResumen(
  d: DependenciasDeAnalisis,
  periodo: Periodo,
): Promise<ResumenDePeriodo> {
  const rango = rangoDePeriodo(periodo, hoyDe(d))
  const registros = await d.resumenes.entre(rango.desde, rango.hasta)
  return resumenDePeriodo(registros.map(ResumenDiario.desdeRegistro), rango)
}

/** Todo lo de la Torre de control con una sola lectura de la proyección (RN-SIS-09, RN-AN-15). */
export async function consultarTorre(
  d: DependenciasDeAnalisis,
  opciones: OpcionesDeTorre = {},
): Promise<TorreDeControl> {
  const datos = await cargarDatos(d)
  const { hoy, filas, productos } = datos
  const [evaluaciones, cambios, primerDiaDeLaTienda] = await Promise.all([
    evaluarProductos(d, datos),
    cambiosDelDia(d, hoy),
    d.resumenes.primerDiaDeLaTienda(),
  ])
  const situaciones = evaluaciones.map((e) => e.situacion)
  const precios = preciosParaRevisar(productos)
  return {
    resumen: resumenDePeriodo(filas, rangoDePeriodo(opciones.periodo ?? 'HOY', hoy)),
    atencion: {
      agotados: situaciones.filter((s) => s.estado === 'AGOTADO').length,
      porAcabarse: situaciones.filter((s) => s.estado === 'POR_ACABARSE').length,
      preciosParaRevisar: precios.length,
    },
    productosEnAtencion: productosEnAtencion(situaciones),
    paraComprar: aplicarCambiosALista(listaSugerida(evaluaciones), cambios),
    masVendidos: masVendidos(filas, productos, ultimosDias(hoy, opciones.periodoMasVendidos ?? 7)),
    semana: semanaContraSemana(filas, hoy),
    mejorDia: mejorDiaDeLaSemana(filas, hoy, primerDiaDeLaTienda),
    parados: productosParados(
      evaluaciones.flatMap(({ producto, situacion }) =>
        situacion.parado
          ? [{ producto, stock: situacion.stock, diasSinVender: situacion.parado.diasSinVender }]
          : [],
      ),
    ),
    preciosParaRevisar: precios,
  }
}
