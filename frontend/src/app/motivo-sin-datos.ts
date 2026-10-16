/**
 * Por qué la app no puede mostrar los datos (pantalla `PantallaSinDatos`):
 * - `sin-indexeddb`: el navegador no deja usar IndexedDB (p. ej. algunas ventanas privadas).
 * - `sin-espacio`: el celular no tiene espacio para guardar.
 * - `otro`: cualquier otra falla al abrir.
 * - `actualizada`: otra pestaña abrió una versión más nueva de la base y esta tuvo que cerrarla.
 */
export type MotivoSinDatos = 'sin-indexeddb' | 'sin-espacio' | 'otro' | 'actualizada'

/** Nombres de error del navegador (o de Dexie) que dicen que IndexedDB no se puede usar. */
const SIN_INDEXEDDB = new Set(['MissingAPIError', 'SecurityError', 'InvalidStateError'])

/** El error y los que envuelve: Dexie los guarda en `inner`; el estándar, en `cause`. */
function cadenaDe(error: unknown): { name?: unknown }[] {
  const cadena: { name?: unknown }[] = []
  let actual: unknown = error
  while (typeof actual === 'object' && actual !== null && cadena.length < 10) {
    const con = actual as { name?: unknown; inner?: unknown; cause?: unknown }
    cadena.push(con)
    actual = con.inner ?? con.cause
  }
  return cadena
}

/** El motivo que se le muestra a la persona cuando el arranque falla (RN-UX-07). */
export function motivoDelError(error: unknown): Exclude<MotivoSinDatos, 'actualizada'> {
  const nombres = cadenaDe(error).map((e) => e.name)
  if (nombres.includes('QuotaExceededError')) return 'sin-espacio'
  if (nombres.some((nombre) => typeof nombre === 'string' && SIN_INDEXEDDB.has(nombre))) {
    return 'sin-indexeddb'
  }
  return 'otro'
}
