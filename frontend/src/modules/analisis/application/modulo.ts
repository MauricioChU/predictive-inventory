import type {
  AnalisisConsultable,
  ProyeccionDeOperaciones,
  TotalesDeDia,
} from '@/shared/contratos/entre-modulos'
import type { Cantidad } from '@/shared/domain/cantidad'
import type { Dinero } from '@/shared/domain/dinero'
import type { Dia } from '@/shared/domain/fecha'
import type { ListaParaComprar } from '../domain/compras'
import { vecesVendido } from '../domain/observaciones'
import {
  resumenDePeriodo,
  totalesPorDia,
  type Periodo,
  type ResumenDePeriodo,
} from '../domain/periodos'
import { ResumenDiario } from '../domain/resumen-diario'
import {
  cambiarCantidadEnLista,
  lineasParaRegistrarLlegada,
  listaParaComprar,
  quitarDeLista,
  textoParaCompartir,
} from './lista-de-compras'
import {
  detalleDeProducto,
  necesitoComprar,
  type DetalleDeProducto,
  type RespuestaNecesitoComprar,
} from './producto'
import { ProyeccionDeResumenes } from './proyeccion'
import type { DependenciasDeAnalisis } from './puertos'
import { cargarDatos, evaluarProducto, evaluarProductos } from './situaciones'
import {
  consultarResumen,
  consultarTorre,
  type OpcionesDeTorre,
  type TorreDeControl,
} from './torre'

export type { DependenciasDeAnalisis } from './puertos'

export interface ModuloAnalisis {
  /** Inventario la llama en la misma unidad de trabajo que cada operación (ADR-0002). */
  proyeccion: ProyeccionDeOperaciones
  /** Lo que Alertas, Inventario, Catálogo y Respaldo consultan. */
  consultable: AnalisisConsultable
  consultarResumen(periodo: Periodo): Promise<ResumenDePeriodo>
  consultarTorre(opciones?: OpcionesDeTorre): Promise<TorreDeControl>
  listaParaComprar(): Promise<ListaParaComprar>
  cambiarCantidadEnLista(productoId: string, cantidad: string): Promise<void>
  quitarDeLista(productoId: string): Promise<void>
  textoParaCompartir(): Promise<string>
  lineasParaRegistrarLlegada(): Promise<{ productoId: string; cantidad: Cantidad; costo: Dinero }[]>
  necesitoComprar(productoId: string): Promise<RespuestaNecesitoComprar>
  detalleDeProducto(productoId: string): Promise<DetalleDeProducto | null>
}

async function filasEntre(d: DependenciasDeAnalisis, desde: Dia, hasta: Dia) {
  return (await d.resumenes.entre(desde, hasta)).map(ResumenDiario.desdeRegistro)
}

function crearConsultable(d: DependenciasDeAnalisis): AnalisisConsultable {
  return {
    async situacion(productoId) {
      return (await evaluarProducto(d, productoId))?.situacion ?? null
    },
    async situaciones() {
      const evaluaciones = await evaluarProductos(d, await cargarDatos(d))
      return evaluaciones.map((e) => e.situacion)
    },
    async vecesVendido(desde, hasta) {
      return vecesVendido(await filasEntre(d, desde, hasta), { desde, hasta })
    },
    async totalesDelDia(dia): Promise<TotalesDeDia> {
      return { dia, ...resumenDePeriodo(await filasEntre(d, dia, dia), { desde: dia, hasta: dia }) }
    },
    async resumenesDeTienda(desde, hasta) {
      return totalesPorDia(await filasEntre(d, desde, hasta))
    },
  }
}

/** Módulo Análisis: la proyección ResumenDiario y la Torre de control (RN-AN). */
export function crearModuloAnalisis(d: DependenciasDeAnalisis): ModuloAnalisis {
  return {
    proyeccion: new ProyeccionDeResumenes(d.resumenes, d.uow),
    consultable: crearConsultable(d),
    consultarResumen: (periodo) => consultarResumen(d, periodo),
    consultarTorre: (opciones) => consultarTorre(d, opciones),
    listaParaComprar: () => listaParaComprar(d),
    cambiarCantidadEnLista: (productoId, cantidad) =>
      cambiarCantidadEnLista(d, productoId, cantidad),
    quitarDeLista: (productoId) => quitarDeLista(d, productoId),
    textoParaCompartir: () => textoParaCompartir(d),
    lineasParaRegistrarLlegada: () => lineasParaRegistrarLlegada(d),
    necesitoComprar: (productoId) => necesitoComprar(d, productoId),
    detalleDeProducto: (productoId) => detalleDeProducto(d, productoId),
  }
}
