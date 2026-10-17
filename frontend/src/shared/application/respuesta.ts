/**
 * Resultado de un caso de uso que puede necesitar una decisión del usuario.
 * Las violaciones de reglas se lanzan como ErrorDeDominio, no viajan aquí.
 */
export type Respuesta<T> =
  | { tipo: 'hecho'; valor: T }
  | { tipo: 'confirmar'; mensaje: string }
  | { tipo: 'reactivar'; productoId: string; nombre: string }

export const hecho = <T>(valor: T): Respuesta<T> => ({ tipo: 'hecho', valor })
export const confirmar = <T = never>(mensaje: string): Respuesta<T> => ({
  tipo: 'confirmar',
  mensaje,
})
export const ofrecerReactivar = <T = never>(productoId: string, nombre: string): Respuesta<T> => ({
  tipo: 'reactivar',
  productoId,
  nombre,
})
