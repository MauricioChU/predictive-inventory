import type Dexie from 'dexie'
import { NotificadorDelSistema } from '@/modules/alertas'
import { ProcesadorDeFotosCanvas } from '@/modules/catalogo'
import {
  AlmacenamientoPersistenteDelNavegador,
  GeneradorDeExcelDelNavegador,
  LectorDeExcelDelNavegador,
} from '@/modules/respaldo'
import { BusEnMemoria } from '@/shared/domain/eventos'
import { IdsAleatorios } from '@/shared/domain/ids'
import { RelojDelSistema } from '@/shared/domain/reloj'
import { BaseDeDatos } from '@/shared/infrastructure/dexie/base-de-datos'
import type { Infraestructura } from './composicion'
import { crearPersistenciaDexie } from './persistencia-dexie'

/** La infraestructura real, más la apertura de la base (lo primero que puede fallar). */
export interface InfraestructuraDelNavegador extends Infraestructura {
  /**
   * Abre IndexedDB (y crea las tablas la primera vez). Rechaza si el navegador no deja guardar
   * datos (p. ej. algunas ventanas privadas, o el almacenamiento del sitio bloqueado).
   */
  abrir(): Promise<void>
}

export interface OpcionesDelNavegador {
  /** Otra pestaña abrió una versión más nueva de la base: esta conexión ya se cerró. */
  alActualizarseLaBase?: () => void
}

/**
 * Convivencia con otras pestañas de la app (ADR-0001):
 * - `versionchange`: otra pestaña (con una versión más nueva) necesita actualizar la base. Esta
 *   conexión se cierra (sin reabrirse sola con el esquema viejo) y se avisa, para mostrar
 *   "La app se actualizó". Si no se cerrara, la otra quedaría bloqueada.
 * - `blocked`: al abrir, una pestaña vieja todavía tiene la base abierta; la apertura espera a
 *   que la suelte. Solo se registra.
 */
export function vigilarVersionDeLaBase(db: Dexie, alActualizarse: () => void): void {
  db.on('versionchange', () => {
    db.close()
    alActualizarse()
    return false // sin el comportamiento por defecto de Dexie (cerrar y reabrir solo)
  })
  db.on('blocked', () => {
    console.warn(
      'La base local está abierta en otra pestaña con una versión anterior de la app: se abrirá cuando esa pestaña la cierre.',
    )
  })
}

/**
 * Dexie (base `predictive-inventory`) y los adaptadores del navegador: notificaciones del
 * sistema, fotos con canvas, Excel con write/read-excel-file y `navigator.storage`. `db` se
 * puede pasar para probarla con fake-indexeddb.
 */
export function crearInfraestructuraDelNavegador(
  db: BaseDeDatos = new BaseDeDatos(),
  opciones: OpcionesDelNavegador = {},
): InfraestructuraDelNavegador {
  vigilarVersionDeLaBase(db, () => opciones.alActualizarseLaBase?.())
  return {
    ...crearPersistenciaDexie(db),
    reloj: new RelojDelSistema(),
    ids: new IdsAleatorios(),
    bus: new BusEnMemoria(),
    notificador: new NotificadorDelSistema(),
    procesadorDeFotos: new ProcesadorDeFotosCanvas(),
    generadorDeExcel: new GeneradorDeExcelDelNavegador(),
    lectorDeExcel: new LectorDeExcelDelNavegador(),
    almacenamiento: new AlmacenamientoPersistenteDelNavegador(),
    async abrir() {
      await db.open()
    },
  }
}
