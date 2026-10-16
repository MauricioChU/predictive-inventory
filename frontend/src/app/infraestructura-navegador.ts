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

/**
 * Dexie (base `predictive-inventory`) y los adaptadores del navegador: notificaciones del
 * sistema, fotos con canvas, Excel con write/read-excel-file y `navigator.storage`. `db` se
 * puede pasar para probarla con fake-indexeddb.
 */
export function crearInfraestructuraDelNavegador(
  db: BaseDeDatos = new BaseDeDatos(),
): InfraestructuraDelNavegador {
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
