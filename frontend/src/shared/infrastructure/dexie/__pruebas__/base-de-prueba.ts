import { IDBFactory, IDBKeyRange } from 'fake-indexeddb'
import { BaseDeDatos } from '../base-de-datos'

/**
 * Base de datos Dexie sobre fake-indexeddb, para los specs de `infrastructure/dexie`. Cada
 * llamada usa su propia fábrica de IndexedDB (una base nueva y aislada), salvo que se pase
 * una para reabrir la misma base. fake-indexeddb se inyecta en la instancia: no se instala
 * como global, así que no afecta a ningún otro spec.
 *
 * Los specs que guardan fotos corren con `// @vitest-environment node`: el Blob de jsdom no
 * sobrevive al structuredClone de fake-indexeddb (se lee de vuelta como un objeto vacío).
 */
export function crearBaseDePrueba(fabrica: IDBFactory = new IDBFactory()): BaseDeDatos {
  return new BaseDeDatos({ indexedDB: fabrica, IDBKeyRange })
}

export { IDBFactory }
