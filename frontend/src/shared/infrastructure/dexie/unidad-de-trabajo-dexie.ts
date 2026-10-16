import Dexie, { type Table, type Transaction } from 'dexie'
import type { UnidadDeTrabajo } from '../../application/unidad-de-trabajo'
import type { BaseDeDatos } from './base-de-datos'

type Accion = () => void | Promise<void>

/**
 * Acciones `alConfirmar` pendientes de cada transacción, indexadas por la transacción NATIVA
 * (la comparten la transacción de Dexie y cualquier subtransacción suya). Al nivel del
 * módulo: todas las unidades de trabajo sobre la misma base se ven.
 */
const accionesPorTransaccion = new WeakMap<IDBTransaction, Accion[]>()

/** La transacción de `db` en la que corre este código, si sigue activa. */
export function transaccionEnCurso(db: Dexie): Transaction | null {
  const actual: Transaction | undefined = Dexie.currentTransaction
  return actual && actual.active && actual.db === db ? actual : null
}

async function correrEnOrden(acciones: readonly Accion[]): Promise<void> {
  for (const accion of acciones) {
    try {
      await accion()
    } catch (error) {
      console.error('Falló una acción posterior a confirmar la transacción:', error)
    }
  }
}

/**
 * Corre `trabajo` en la transacción de `db` en curso o, si no hay, en una nueva de lectura y
 * escritura sobre `tablas`; en ese caso, al confirmarla corre (y espera) sus acciones
 * `alConfirmar`. Se UNE a la transacción en curso en vez de abrir una subtransacción de
 * Dexie: en Dexie, el fallo de una subtransacción aborta la transacción padre aunque quien
 * llama atrape el error; así, un error atrapado no revierte nada por sí solo, igual que en la
 * unidad de trabajo en memoria.
 */
export async function enTransaccion<T>(
  db: Dexie,
  tablas: Table[],
  trabajo: () => Promise<T>,
): Promise<T> {
  if (transaccionEnCurso(db)) return trabajo()

  const acciones: Accion[] = []
  // '!': siempre una transacción nueva, aunque el código corra en la zona de una que ya
  // terminó (p. ej. una continuación "dispara y olvida" de un trabajo anterior).
  const resultado = await db.transaction('rw!', tablas, async (transaccion) => {
    accionesPorTransaccion.set(transaccion.idbtrans, acciones)
    return trabajo()
  })
  // Aquí la transacción ya se confirmó (Dexie resuelve tras el evento "complete").
  await correrEnOrden(acciones)
  return resultado
}

/**
 * Unidad de trabajo sobre IndexedDB (ADR-0002, RN-OP-06): cada `ejecutar` de nivel superior
 * es UNA transacción 'rw' de Dexie sobre todas las tablas; si el trabajo falla (o IndexedDB
 * aborta), no queda nada. Las llamadas anidadas se unen a la transacción en curso
 * (`Dexie.currentTransaction`, que Dexie propaga a través de los `await`).
 *
 * REGLA DE INTEGRIDAD DE DATOS: dentro de `ejecutar` solo se esperan promesas de IndexedDB.
 * Esperar otra cosa (un temporizador, `fetch`, `blob.arrayBuffer()`, decodificar una imagen)
 * deja la transacción sin peticiones pendientes y el navegador la CONFIRMA en ese momento,
 * con lo escrito hasta ahí. Dexie lo detecta después: `ejecutar` rechaza con
 * PrematureCommitError (o la escritura siguiente, con TransactionInactiveError), pero lo
 * escrito antes de la espera YA quedó guardado (confirmación parcial: se rompe RN-OP-06), lo
 * de después no, y las acciones `alConfirmar` se descartan como en un rollback. Lo lento que
 * no es IndexedDB va antes o después de `ejecutar` (como `guardarFoto` o `leerTodo`).
 *
 * `alConfirmar` cumple el contrato documentado en `UnidadDeTrabajo` (el mismo spec de contrato
 * corre contra esta clase y la de memoria: shared/infrastructure/__pruebas__). Cómo lo hace
 * aquí: la acción se encola en la lista de la transacción NATIVA más externa (las anidadas la
 * comparten, también si fallaron y la externa atrapó el error); `enTransaccion` corre la lista
 * después de que Dexie confirma, en orden y de a una, fuera de la zona de la transacción (un
 * `ejecutar()` dentro de una acción abre una transacción nueva), y recién entonces resuelve.
 * Si hay rollback, la lista se pierde con la transacción. Fuera de una transacción, o desde
 * una continuación tardía cuya transacción ya cerró, la acción corre enseguida. Una acción que
 * lanza o rechaza se registra con `console.error` y no afecta a las demás ni a `ejecutar`.
 */
export class UnidadDeTrabajoDexie implements UnidadDeTrabajo {
  /** Acciones que nadie espera: las de fuera de una transacción y las de una ajena. */
  private readonly accionesSueltas = new Set<Promise<void>>()

  constructor(private readonly db: BaseDeDatos) {}

  ejecutar<T>(trabajo: () => Promise<T>): Promise<T> {
    return enTransaccion(this.db, this.db.tables, trabajo)
  }

  alConfirmar(accion: Accion): void {
    const transaccion = transaccionEnCurso(this.db)
    if (!transaccion) {
      this.seguir(correrEnOrden([accion]))
      return
    }
    let pendientes = accionesPorTransaccion.get(transaccion.idbtrans)
    if (!pendientes) {
      // Una transacción que no abrió `enTransaccion` (p. ej. un `db.transaction` directo):
      // sus acciones corren cuando IndexedDB la confirma; si aborta, nunca.
      const lista: Accion[] = []
      transaccion.idbtrans.addEventListener('complete', () => this.seguir(correrEnOrden(lista)))
      accionesPorTransaccion.set(transaccion.idbtrans, lista)
      pendientes = lista
    }
    pendientes.push(accion)
  }

  /** Para pruebas y la composición: espera las acciones que nadie más espera. */
  async esperarAcciones(): Promise<void> {
    while (this.accionesSueltas.size > 0) await Promise.all(this.accionesSueltas)
  }

  private seguir(enCurso: Promise<void>): void {
    this.accionesSueltas.add(enCurso)
    void enCurso.finally(() => this.accionesSueltas.delete(enCurso))
  }
}
