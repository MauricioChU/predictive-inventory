import Dexie, { type DexieOptions, type Table } from 'dexie'
import type { NombreDeTabla, TablasDeLaApp } from '../../contratos/registros'

/** Base de datos local de la app (00-plan-maestro: "Base de datos local: predictive-inventory"). */
export const NOMBRE_DE_LA_BASE = 'predictive-inventory'
export const VERSION_DE_LA_BASE = 1

/**
 * Esquema de la versión 1: la primera columna es la clave primaria (igual que
 * `CLAVE_DE_TABLA`); las demás, índices. `*productoIds` es multiEntry (una operación se
 * encuentra por cualquiera de sus productos) y `[productoId+dia]` es compuesto (filas de un
 * producto en orden de día).
 */
export const ESQUEMA_V1: { readonly [K in NombreDeTabla]: string } = {
  productos: 'id, nombreNormalizado, categoriaId, estado',
  categorias: 'id, nombreNormalizado',
  operaciones: 'id, tipo, ocurridaEn, registradaEn, anulaA, *productoIds',
  existencias: 'productoId',
  resumenes: 'clave, dia, productoId, [productoId+dia]',
  configuracion: 'clave',
  avisos: 'productoId',
  listaDeCompras: 'dia',
  conteo: 'id',
  fotos: 'productoId',
}

export interface OpcionesDeBaseDeDatos {
  /** Para pruebas: otra implementación de IndexedDB (fake-indexeddb). Por defecto, la del entorno. */
  indexedDB?: DexieOptions['indexedDB']
  IDBKeyRange?: DexieOptions['IDBKeyRange']
}

type TablaDe<K extends NombreDeTabla> = Table<TablasDeLaApp[K], string>

/**
 * Durabilidad de cada transacción: 'strict' (el commit se informa recién cuando los datos
 * están en disco). Los datos de la tienda primero; la composición mide su costo contra el
 * presupuesto de 300 ms de una venta (RN-SIS-09).
 */
export const DURABILIDAD_DE_LAS_TRANSACCIONES = 'strict' as const

/** La base IndexedDB de la app (Dexie). Los repositorios Dexie de cada módulo la reciben. */
export class BaseDeDatos extends Dexie {
  // `declare`: Dexie crea cada tabla al declarar el esquema; un campo de clase normal la
  // pisaría con undefined (useDefineForClassFields).
  declare readonly productos: TablaDe<'productos'>
  declare readonly categorias: TablaDe<'categorias'>
  declare readonly operaciones: TablaDe<'operaciones'>
  declare readonly existencias: TablaDe<'existencias'>
  declare readonly resumenes: TablaDe<'resumenes'>
  declare readonly configuracion: TablaDe<'configuracion'>
  declare readonly avisos: TablaDe<'avisos'>
  declare readonly listaDeCompras: TablaDe<'listaDeCompras'>
  declare readonly conteo: TablaDe<'conteo'>
  declare readonly fotos: TablaDe<'fotos'>

  constructor(opciones: OpcionesDeBaseDeDatos = {}) {
    super(NOMBRE_DE_LA_BASE, {
      chromeTransactionDurability: DURABILIDAD_DE_LAS_TRANSACCIONES,
      ...(opciones.indexedDB ? { indexedDB: opciones.indexedDB } : {}),
      ...(opciones.IDBKeyRange ? { IDBKeyRange: opciones.IDBKeyRange } : {}),
    })
    this.version(VERSION_DE_LA_BASE).stores(ESQUEMA_V1)
  }
}
