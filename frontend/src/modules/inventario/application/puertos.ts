import type { UnidadDeTrabajo } from '@/shared/application/unidad-de-trabajo'
import type { Cantidad } from '@/shared/domain/cantidad'
import type { Instante } from '@/shared/domain/fecha'
import type { BusDeEventos } from '@/shared/domain/eventos'
import type { GeneradorDeIds } from '@/shared/domain/ids'
import type { Reloj } from '@/shared/domain/reloj'
import type {
  AnalisisConsultable,
  CatalogoConsultable,
  ProyeccionDeOperaciones,
  TiendaConsultable,
} from '@/shared/contratos/entre-modulos'
import type { TipoDeOperacion } from '@/shared/contratos/operaciones'
import type { ConteoGuiadoRegistro, OperacionRegistro } from '@/shared/contratos/registros'

/** Plan 17: una página del Historial (lo más reciente primero), sin leer todo el libro. */
export interface ConsultaDeRecientes {
  tipo?: TipoDeOperacion
  /** El `siguiente` de la página anterior: solo las que ocurrieron antes de ese instante. */
  antesDe?: Instante
  cuantas: number
}

export interface PaginaDeOperaciones {
  /**
   * Las más recientes por `ocurridaEn`: al menos `cuantas` si las hay y nunca un grupo del mismo
   * `ocurridaEn` cortado entre dos páginas. En cualquier orden (lo ordena el caso de uso).
   */
  registros: OperacionRegistro[]
  /** Para pedir la página que sigue (`antesDe`); null si no hay más. */
  siguiente: Instante | null
}

/** El libro de operaciones (ADR-0002): solo se agregan registros, nunca se cambian. */
export interface RepositorioDeOperaciones {
  agregar(registro: OperacionRegistro): Promise<void>
  porId(id: string): Promise<OperacionRegistro | null>
  /** La ANULACION que revierte a `operacionId`, si existe. */
  anulacionDe(operacionId: string): Promise<OperacionRegistro | null>
  /** Ordenadas por `registradaEn` (a igual `registradaEn`, cualquier orden estable). */
  porProducto(productoId: string): Promise<OperacionRegistro[]>
  /** Ordenadas por `registradaEn` (a igual `registradaEn`, cualquier orden estable). */
  todas(): Promise<OperacionRegistro[]>
  /**
   * Plan 17: una página del libro, de lo más reciente a lo más antiguo según `ocurridaEn`.
   * Supone los instantes como los escribe la app (ISO UTC de `toISOString`; restaurar una copia
   * los deja así): en ese formato el orden del texto es el del tiempo, y Dexie usa su índice
   * sin leer todo el libro.
   */
  recientes(consulta: ConsultaDeRecientes): Promise<PaginaDeOperaciones>
  /** Plan 17: cuáles de esas operaciones tienen una ANULACION (RN-OP-17). */
  conAnulacion(operacionIds: readonly string[]): Promise<Set<string>>
}

/** Proyección `productoId → cantidad actual`. */
export interface RepositorioDeExistencias {
  /** 0 si no hay registro. */
  obtener(productoId: string): Promise<Cantidad>
  fijar(productoId: string, cantidad: Cantidad): Promise<void>
  todas(): Promise<Map<string, Cantidad>>
  reemplazarTodas(existencias: Map<string, Cantidad>): Promise<void>
}

/** El conteo guiado en curso (RN-OP-21): uno solo, con id "actual". */
export interface RepositorioDeConteo {
  obtener(): Promise<ConteoGuiadoRegistro | null>
  guardar(registro: ConteoGuiadoRegistro): Promise<void>
}

/** Lo que el módulo recibe en la composición. Los otros módulos llegan como funciones perezosas. */
export interface DependenciasDeInventario {
  operaciones: RepositorioDeOperaciones
  existencias: RepositorioDeExistencias
  conteo: RepositorioDeConteo
  uow: UnidadDeTrabajo
  reloj: Reloj
  ids: GeneradorDeIds
  bus: BusDeEventos
  catalogo: () => CatalogoConsultable
  analisis: () => Pick<AnalisisConsultable, 'situacion'>
  tienda: () => TiendaConsultable
  proyecciones: () => ProyeccionDeOperaciones[]
}
