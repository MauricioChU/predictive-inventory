/**
 * Agrupa escrituras en una transacción: o se guardan todas o ninguna (RN-OP-06).
 * Llamadas anidadas se unen a la transacción en curso.
 */
export interface UnidadDeTrabajo {
  ejecutar<T>(trabajo: () => Promise<T>): Promise<T>
}
