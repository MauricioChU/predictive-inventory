import type { UnidadDeTrabajo } from '@/shared/application/unidad-de-trabajo'
import type {
  CatalogoConsultable,
  InventarioConsultable,
  TiendaConsultable,
} from '@/shared/contratos/entre-modulos'
import type { ListaDeComprasRegistro, ResumenDiarioRegistro } from '@/shared/contratos/registros'
import type { Dia } from '@/shared/domain/fecha'
import type { Reloj } from '@/shared/domain/reloj'

/** Proyección `ResumenDiario` por producto y día (tabla `resumenes`, clave `productoId|dia`). */
export interface RepositorioDeResumenes {
  obtener(productoId: string, dia: Dia): Promise<ResumenDiarioRegistro | null>
  guardar(r: ResumenDiarioRegistro): Promise<void>
  /** Escritura masiva (reconstruir la proyección): reemplaza las filas con la misma clave. */
  guardarVarios(registros: readonly ResumenDiarioRegistro[]): Promise<void>
  /** Filas de toda la tienda entre dos días (inclusive), por día y producto. */
  entre(desde: Dia, hasta: Dia): Promise<ResumenDiarioRegistro[]>
  /** Filas de un producto entre dos días (inclusive), por día (índice [productoId+dia]). */
  deProductoEntre(productoId: string, desde: Dia, hasta: Dia): Promise<ResumenDiarioRegistro[]>
  /** Día del primer movimiento del producto; ignora las filas sin movimiento (`esFilaSinMovimiento`). */
  primerDiaDe(productoId: string): Promise<Dia | null>
  /**
   * RN-SIS-09: `primerDiaDe` de TODOS los productos, en una sola consulta (misma regla). Los
   * productos sin primer día (sin filas, o solo con filas sin movimiento) no aparecen.
   */
  primerosDias(): Promise<Map<string, Dia>>
  /** Día de la primera operación de la tienda. */
  primerDiaDeLaTienda(): Promise<Dia | null>
  /** Último día con alguna línea vendida del producto (RN-AN-11, cuando cae fuera de la ventana). */
  ultimoDiaConVentaDe(productoId: string): Promise<Dia | null>
  vaciar(): Promise<void>
}

/** Cambios del usuario a la lista para comprar, uno por día (RN-AN-08). */
export interface RepositorioDeListaDeCompras {
  delDia(dia: Dia): Promise<ListaDeComprasRegistro | null>
  guardar(r: ListaDeComprasRegistro): Promise<void>
}

/** Todo lo que el módulo necesita; los otros módulos llegan como funciones perezosas. */
export interface DependenciasDeAnalisis {
  resumenes: RepositorioDeResumenes
  listaDeCompras: RepositorioDeListaDeCompras
  uow: UnidadDeTrabajo
  reloj: Reloj
  catalogo: () => CatalogoConsultable
  inventario: () => InventarioConsultable
  tienda: () => TiendaConsultable
}
