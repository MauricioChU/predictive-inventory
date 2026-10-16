import type { Reloj } from '../../../shared/domain/reloj'
import type { UnidadDeTrabajo } from '../../../shared/application/unidad-de-trabajo'
import type {
  AnalisisConsultable,
  CatalogoConsultable,
  CatalogoParaImportacion,
  InventarioConsultable,
  TiendaConsultable,
} from '../../../shared/contratos/entre-modulos'
import type { DatosDelRespaldo } from '../domain/formato-de-respaldo'
import type { CeldaDeExcel, HojaDeExcel } from '../domain/hojas-de-excel'

export type { CeldaDeExcel, DatosDelRespaldo, HojaDeExcel }

/** Lee y reemplaza todo lo que guarda y restaura un respaldo (sin tocar el estado del
 * sistema, que vive aparte en el módulo Tienda). */
export interface AlmacenDeRespaldo {
  leerTodo(): Promise<DatosDelRespaldo>
  /**
   * Reemplaza configuración del negocio, categorías, productos, operaciones, avisos y
   * fotos. Vacía existencias, resúmenes, lista de compras y conteo. No toca el estado del
   * sistema.
   */
  reemplazarTodo(datos: DatosDelRespaldo): Promise<void>
}

/** Reconstruye existencias y resúmenes desde las operaciones, tras restaurar una copia. La
 * composición real (Ola 3) la arma combinando los módulos Inventario y Análisis. */
export interface Reconstructor {
  reconstruirTodo(): Promise<void>
}

export interface GeneradorDeExcel {
  generar(hojas: readonly HojaDeExcel[]): Promise<Blob>
}

/** Celdas como texto (RN-RE-07/08): la interpretación de esos textos es del dominio. */
export interface LectorDeExcel {
  leerPrimeraHoja(archivo: Blob): Promise<string[][]>
}

export interface AlmacenamientoPersistente {
  solicitar(): Promise<boolean>
}

export interface ArchivoGenerado {
  nombre: string
  tipo: string
  contenido: Blob
}

export interface DependenciasDeRespaldo {
  almacen: AlmacenDeRespaldo
  reconstructor: Reconstructor
  generadorDeExcel: GeneradorDeExcel
  lectorDeExcel: LectorDeExcel
  almacenamiento: AlmacenamientoPersistente
  uow: UnidadDeTrabajo
  reloj: Reloj
  catalogo: () => CatalogoConsultable & { importacion: CatalogoParaImportacion }
  inventario: () => InventarioConsultable
  analisis: () => Pick<AnalisisConsultable, 'situaciones' | 'resumenesDeTienda'>
  tienda: () => TiendaConsultable
}
