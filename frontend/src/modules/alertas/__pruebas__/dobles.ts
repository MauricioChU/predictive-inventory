import type {
  AnalisisConsultable,
  SituacionDeProducto,
  TotalesDeDia,
} from '@/shared/contratos/entre-modulos'
import {
  CONFIGURACION_INICIAL,
  type ConfiguracionDeNegocio,
  type EstadoDelSistema,
} from '@/shared/contratos/configuracion'
import type { TiendaConsultable } from '@/shared/contratos/entre-modulos'
import type { UnidadDeTrabajo } from '@/shared/application/unidad-de-trabajo'
import { Cantidad } from '@/shared/domain/cantidad'
import { Dinero } from '@/shared/domain/dinero'
import { BusEnMemoria } from '@/shared/domain/eventos'
import { RelojFijo } from '@/shared/domain/reloj'
import { AlmacenEnMemoria } from '@/shared/infrastructure/memoria/almacen-en-memoria'
import type { DependenciasDeAlertas } from '../application/modulo'
import {
  NotificadorEnMemoria,
  RepositorioDeAvisosEnMemoria,
} from '../infrastructure/memoria/repositorios'

/** Fábrica de `SituacionDeProducto` con valores por defecto razonables para los tests. */
export function crearSituacion(
  datos: Partial<SituacionDeProducto> & Pick<SituacionDeProducto, 'productoId' | 'nombre'>,
): SituacionDeProducto {
  return {
    unidad: 'UNIDAD',
    stock: Cantidad.cero(),
    stockMinimo: Cantidad.cero(),
    prediccion: null,
    diasDeCobertura: null,
    estado: 'NORMAL',
    enListaParaComprar: false,
    cantidadSugerida: null,
    parado: null,
    ...datos,
  }
}

function totalesDeDiaVacios(dia: string): TotalesDeDia {
  return {
    dia,
    ventas: Dinero.cero(),
    costoVendido: Dinero.cero(),
    gananciaBruta: Dinero.cero(),
    mermas: Dinero.cero(),
    gananciaNeta: Dinero.cero(),
    diferenciasDeConteo: Dinero.cero(),
  }
}

/** Doble de prueba de Análisis: solo lo que Alertas consume (RN-AL-02 lo re-evalúa). */
export class AnalisisFalso implements Pick<AnalisisConsultable, 'situaciones' | 'totalesDelDia'> {
  situacionesActuales: SituacionDeProducto[] = []
  private readonly totalesPorDia = new Map<string, TotalesDeDia>()

  fijarTotalesDeDia(totales: TotalesDeDia): void {
    this.totalesPorDia.set(totales.dia, totales)
  }

  async situaciones(): Promise<SituacionDeProducto[]> {
    return this.situacionesActuales
  }

  async totalesDelDia(dia: string): Promise<TotalesDeDia> {
    return this.totalesPorDia.get(dia) ?? totalesDeDiaVacios(dia)
  }
}

/** Doble de prueba de Tienda: configuración y estado del sistema en memoria. */
export class TiendaFalsa implements TiendaConsultable {
  configuracionActual: ConfiguracionDeNegocio = {
    ...CONFIGURACION_INICIAL,
    notificacionesActivas: true,
  }
  estadoActual: EstadoDelSistema = {
    dispositivoId: 'dispositivo-de-prueba',
    primeraVezCompletada: true,
    ultimoRespaldoEn: null,
    almacenamientoPersistente: 'DESCONOCIDO',
    ultimoResumenDelDiaMostrado: null,
  }

  async configuracion(): Promise<ConfiguracionDeNegocio> {
    return this.configuracionActual
  }

  async estadoDelSistema(): Promise<EstadoDelSistema> {
    return this.estadoActual
  }

  async actualizarEstadoDelSistema(cambios: Partial<EstadoDelSistema>): Promise<void> {
    this.estadoActual = { ...this.estadoActual, ...cambios }
  }
}

export interface ContextoDePrueba {
  dependencias: DependenciasDeAlertas
  avisosAlmacen: AlmacenEnMemoria
  notificador: NotificadorEnMemoria
  analisisFalso: AnalisisFalso
  tiendaFalsa: TiendaFalsa
  reloj: RelojFijo
  bus: BusEnMemoria
}

/**
 * Arma unas `DependenciasDeAlertas` completas con adaptadores en memoria y dobles de los
 * otros módulos, para probar los casos de uso de punta a punta (igual que en `alertas.feature`).
 *
 * Recibe la unidad de trabajo YA CONSTRUIDA (en vez de construir una `UnidadDeTrabajoEnMemoria`
 * aquí mismo) para que este archivo, que no termina en ".spec.ts", nunca importe esa clase: usa
 * node:async_hooks, y eslint-rules/fronteras.ts solo permite importarla desde un ".spec.ts" o
 * desde tests. Además, tsconfig.app.json incluye cualquier archivo bajo src/ salvo los
 * ".spec.ts" y "__tests__/", así que un import directo aquí haría que `vue-tsc --build`
 * intentara type-chequear este archivo (sin tipos de Node) como si fuera código de la app.
 */
export function crearContextoDePrueba(
  uow: UnidadDeTrabajo,
  avisosAlmacen: AlmacenEnMemoria,
  ahora = '2026-10-15T15:00:00.000Z',
): ContextoDePrueba {
  const notificador = new NotificadorEnMemoria()
  const reloj = new RelojFijo(ahora)
  const bus = new BusEnMemoria()
  const analisisFalso = new AnalisisFalso()
  const tiendaFalsa = new TiendaFalsa()
  const dependencias: DependenciasDeAlertas = {
    avisos: new RepositorioDeAvisosEnMemoria(avisosAlmacen),
    notificador,
    uow,
    reloj,
    bus,
    analisis: () => analisisFalso,
    tienda: () => tiendaFalsa,
  }
  return { dependencias, avisosAlmacen, notificador, analisisFalso, tiendaFalsa, reloj, bus }
}
