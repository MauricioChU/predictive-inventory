/**
 * Agrupa escrituras en una transacción: o se guardan todas o ninguna (RN-OP-06).
 * Llamadas anidadas se unen a la transacción en curso. Las consultas que solo leen van en
 * `leer`, que no hace fila como una escritura (RN-SIS-09).
 */
export interface UnidadDeTrabajo {
  /**
   * Corre `consulta` en una transacción de SOLO LECTURA (RN-SIS-09): todo lo que lee sale de
   * la misma foto, la de lo confirmado; nunca ve a medias una escritura de otra transacción
   * (si esa escritura falla, no ve nada de ella).
   *
   * Contrato (lo cumplen la UoW en memoria y la de Dexie):
   * - Dentro de un `ejecutar` (o de otro `leer`) en curso, se UNE a esa transacción: no abre
   *   otra y ve lo que el trabajo ya escribió. Un `leer` dentro de un `ejecutar` es parte de
   *   una escritura, con sus reglas (ahí `ejecutar` y `alConfirmar` funcionan como siempre).
   * - En un `leer` de nivel superior NO se escribe: `ejecutar` rechaza y `alConfirmar` lanza
   *   (son errores de programación: el error llega a quien llamó a `leer`). Una consulta que a
   *   veces necesita escribir (p. ej. crear un registro que falta) lee con `leer` y, si hace
   *   falta, escribe DESPUÉS, con su propio `ejecutar` fuera de la lectura.
   * - Si la consulta falla, `leer` rechaza con su error; no hay nada que revertir.
   * - Una lectura en curso sigue viendo su foto aunque mientras tanto llegue una escritura de
   *   afuera; esa escritura espera a que la lectura termine (y la lectura que llega durante una
   *   escritura espera a que esta confirme o falle). En memoria lecturas y escrituras se turnan
   *   en la misma cola; en IndexedDB varias lecturas pueden correr a la vez.
   * - Una llamada que llega después de cerrar la transacción que la originó (una continuación
   *   "dispara y olvida", o una acción `alConfirmar`) es una lectura nueva e independiente.
   * - Igual que en `ejecutar`, dentro de la consulta solo se esperan promesas del almacén.
   */
  leer<T>(consulta: () => Promise<T>): Promise<T>
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

/** Escribir (o registrar una acción) dentro de un `leer` de nivel superior: ver `leer`. */
export function errorDeEscrituraEnLectura(): Error {
  return new Error(
    'Dentro de uow.leer() no se escribe ni se registran acciones: lee primero y escribe después con uow.ejecutar()',
  )
}
