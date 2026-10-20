import type { EstadoVisual } from './presentacion-estado'

/** Lo que muestra una TarjetaDeProducto. Los textos llegan ya formateados por quien la usa
 * (p. ej. con `@/shared/domain/formato`): el componente no calcula montos ni cantidades. */
export interface DatosDeTarjetaDeProducto {
  nombre: string
  imagen?: Blob | string
  categoria?: string
  /** "12 unid.", "Agotado", "2.5 kg"… */
  textoStock: string
  /** "S/ 4.50" */
  textoPrecio?: string
  estado?: EstadoVisual
  /** "Se acaba en ~4 días" */
  textoSecundario?: string
}

export interface ProductoDeLista extends DatosDeTarjetaDeProducto {
  id: string
}

/** RN-UX-10: por qué está vacía la lista y cuál es la acción siguiente. */
export interface EstadoVacioDeLista {
  titulo: string
  descripcion?: string
  accion?: string
}

export interface AccesoRapido {
  id: string
  nombre: string
  imagen?: Blob | string
  categoria?: string
}

/** Vender: accesos rápidos a los 8 productos más vendidos (06-experiencia-de-uso). */
export const MAXIMO_DE_ACCESOS_RAPIDOS = 8
