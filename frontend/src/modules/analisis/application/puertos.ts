import type { ListaDeComprasRegistro, ResumenDiarioRegistro } from '@/shared/contratos/registros'
import type { Dia } from '@/shared/domain/fecha'

/** Proyección `ResumenDiario` por producto y día (tabla `resumenes`, clave `productoId|dia`). */
export interface RepositorioDeResumenes {
  obtener(productoId: string, dia: Dia): Promise<ResumenDiarioRegistro | null>
  guardar(r: ResumenDiarioRegistro): Promise<void>
  /** Filas de toda la tienda entre dos días (inclusive), por día y producto. */
  entre(desde: Dia, hasta: Dia): Promise<ResumenDiarioRegistro[]>
  /** Filas de un producto entre dos días (inclusive), por día (índice [productoId+dia]). */
  deProductoEntre(productoId: string, desde: Dia, hasta: Dia): Promise<ResumenDiarioRegistro[]>
  /** Día del primer movimiento del producto. */
  primerDiaDe(productoId: string): Promise<Dia | null>
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
