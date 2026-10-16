/**
 * Agrupa escrituras en una transacción: o se guardan todas o ninguna (RN-OP-06).
 * Llamadas anidadas se unen a la transacción en curso.
 */
export interface UnidadDeTrabajo {
  /**
   * Corre `trabajo` en una transacción; si ya hay una en curso, se une a ella. El `ejecutar`
   * MÁS EXTERNO resuelve recién cuando terminaron todas sus acciones `alConfirmar` (quien hace
   * `await` de un caso de uso ya ve los eventos publicados y el Deshacer ofrecido).
   */
  ejecutar<T>(trabajo: () => Promise<T>): Promise<T>
  /**
   * Corre la acción tras el commit de la transacción MÁS EXTERNA (o enseguida si no hay
   * transacción). Se descarta si hay rollback.
   *
   * Contrato (Ola 3, ruling 1; lo cumplen la UoW en memoria y la de Dexie):
   * - Dentro de una transacción, la acción se encola. Tras el commit de la más externa, las
   *   acciones corren en orden, de a una (se espera cada una antes de la siguiente) y FUERA de
   *   la transacción: un `ejecutar()` dentro de una acción es una transacción nueva e
   *   independiente, nunca una anidada.
   * - Si la transacción más externa falla (rollback), se descartan todas sus acciones.
   * - Una llamada anidada que falla pero cuyo error atrapa la externa NO descarta sus acciones:
   *   si la externa confirma, también corren (no hay puntos de guardado).
   * - Una acción que lanza (o rechaza) se registra con `console.error` y no se propaga: las
   *   demás corren igual y `ejecutar` resuelve con su resultado.
   * - Fuera de una transacción, la acción corre enseguida (con el mismo manejo de errores).
   *
   * Como `BusDeEventos.publicar` espera a sus manejadores y el Deshacer se ofrece después de
   * publicar, los suscriptores del bus deben ser "dispara y olvida" (encolar y volver, como
   * Alertas): un manejador lento retrasaría el Deshacer y el `ejecutar` de quien publicó.
   */
  alConfirmar(accion: () => void | Promise<void>): void
}
