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

export interface Billete {
  /** Lo que dice el botón: "S/ 20". */
  etiqueta: string
  /** Lo que pasa a "Paga con" al tocarlo, como lo escribiría la persona: "20". */
  valor: string
}

/** Billetes de la pantalla Cobrar (06-experiencia-de-uso, Vender paso 4). */
export const BILLETES_DE_SOLES: readonly Billete[] = [
  { etiqueta: 'S/ 10', valor: '10' },
  { etiqueta: 'S/ 20', valor: '20' },
  { etiqueta: 'S/ 50', valor: '50' },
  { etiqueta: 'S/ 100', valor: '100' },
]
