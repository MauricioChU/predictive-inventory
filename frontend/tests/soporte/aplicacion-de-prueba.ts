import { NotificadorEnMemoria, RepositorioDeAvisosEnMemoria } from '@/modules/alertas'
import {
  RepositorioDeListaDeComprasEnMemoria,
  RepositorioDeResumenesEnMemoria,
} from '@/modules/analisis'
import {
  RepositorioDeCategoriasEnMemoria,
  RepositorioDeFotosEnMemoria,
  RepositorioDeProductosEnMemoria,
  type ProcesadorDeFotos,
} from '@/modules/catalogo'
import {
  RepositorioDeConteoEnMemoria,
  RepositorioDeExistenciasEnMemoria,
  RepositorioDeOperacionesEnMemoria,
} from '@/modules/inventario'
import {
  AlmacenamientoPersistenteEnMemoria,
  AlmacenDeRespaldoEnMemoria,
  GeneradorDeExcelEnMemoria,
  LectorDeExcelEnMemoria,
} from '@/modules/respaldo'
import { RepositorioDeConfiguracionEnMemoria } from '@/modules/tienda'
import { crearAplicacion, type Aplicacion, type Infraestructura } from '@/app/composicion'
import { crearPersistenciaDexie, type PersistenciaDeLaApp } from '@/app/persistencia-dexie'
import {
  BusEnMemoria,
  type BusDeEventos,
  type EventoDeDominio,
  type ManejadorDeEvento,
  type TipoDeEvento,
} from '@/shared/domain/eventos'
import { sumarSegundos, type Instante } from '@/shared/domain/fecha'
import { IdsSecuenciales } from '@/shared/domain/ids'
import type { Reloj } from '@/shared/domain/reloj'
import { crearBaseDePrueba } from '@/shared/infrastructure/dexie/__pruebas__/base-de-prueba'
import { AlmacenEnMemoria } from '@/shared/infrastructure/memoria/almacen-en-memoria'
import { UnidadDeTrabajoEnMemoria } from '@/shared/infrastructure/memoria/unidad-de-trabajo-en-memoria'

export type Almacen = 'memoria' | 'dexie'

/** Para correr la misma prueba con las dos persistencias (`describe.each(ALMACENES)`). */
export const ALMACENES: readonly Almacen[] = ['memoria', 'dexie']

/**
 * Reloj de pruebas SIN empates: cada `ahora()` devuelve el instante actual y avanza 1 ms. Así
 * dos operaciones nunca comparten `registradaEn` y el orden de registro es el mismo en memoria
 * (orden de inserción) y en Dexie (índice `registradaEn`). `fijar` y `avanzarSegundos`, como
 * `RelojFijo`, para los pasos "Dado que hoy es …".
 */
export class RelojDePrueba implements Reloj {
  constructor(private actual: Instante) {}

  ahora(): Instante {
    const instante = this.actual
    this.actual = sumarSegundos(instante, 0.001)
    return instante
  }

  /** El próximo `ahora()` devuelve exactamente este instante. */
  fijar(instante: Instante): void {
    this.actual = instante
  }

  avanzarSegundos(segundos: number): void {
    this.actual = sumarSegundos(this.actual, segundos)
  }
}

/** No reduce nada: el procesador real (canvas) solo existe en el navegador. */
export class ProcesadorDeFotosDePrueba implements ProcesadorDeFotos {
  reducidas = 0

  async reducir(imagen: Blob): Promise<Blob> {
    this.reducidas += 1
    return imagen
  }
}

/**
 * El bus en memoria con un interruptor: mientras está en silencio, lo publicado no llega a
 * nadie. Solo lo usa `sinEventos`, para fabricar historia.
 */
class BusDePrueba implements BusDeEventos {
  private readonly bus = new BusEnMemoria()
  silencios = 0

  async publicar(evento: EventoDeDominio): Promise<void> {
    if (this.silencios > 0) return
    await this.bus.publicar(evento)
  }

  suscribir<T extends TipoDeEvento>(tipo: T, manejador: ManejadorDeEvento<T>): () => void {
    return this.bus.suscribir(tipo, manejador)
  }
}

export interface OpcionesDeAplicacionDePrueba {
  /** "Hoy" del escenario (instante ISO; ver `instanteLocal`). */
  ahora: Instante
  /** Por defecto, memoria. Con 'dexie', una base fake-indexeddb nueva y aislada. */
  almacen?: Almacen
  /** Por defecto, `ProcesadorDeFotosDePrueba` (no reduce nada). */
  procesadorDeFotos?: ProcesadorDeFotos
}

/** La aplicación real (`crearAplicacion`) con dobles a la vista para que las pruebas los manejen. */
export interface AplicacionDePrueba extends Aplicacion {
  readonly almacen: Almacen
  readonly reloj: RelojDePrueba
  readonly notificador: NotificadorEnMemoria
  readonly procesadorDeFotos: ProcesadorDeFotos
  readonly generadorDeExcel: GeneradorDeExcelEnMemoria
  readonly lectorDeExcel: LectorDeExcelEnMemoria
  readonly almacenamiento: AlmacenamientoPersistenteEnMemoria
  /** Lo que recibió la composición: para pasos que alteran datos "por fuera" (RN-OP-19). */
  readonly infraestructura: Infraestructura
  /**
   * Para fabricar historia con los casos de uso reales (pasos Gherkin "vendió 56 entre …"): los
   * eventos de dominio que se publiquen mientras corre `trabajo` no llegan a nadie, así que
   * Alertas no evalúa (no guarda avisos ni notifica), como si esa historia hubiera llegado en
   * una copia. Antes y después espera las tareas pendientes.
   */
  sinEventos<T>(trabajo: () => Promise<T>): Promise<T>
  /** Espera lo pendiente y, con Dexie, cierra la base. */
  cerrar(): Promise<void>
}

function persistenciaEnMemoria(): PersistenciaDeLaApp {
  const almacen = new AlmacenEnMemoria()
  const uow = new UnidadDeTrabajoEnMemoria(almacen)
  return {
    uow,
    repositorios: {
      productos: new RepositorioDeProductosEnMemoria(almacen),
      categorias: new RepositorioDeCategoriasEnMemoria(almacen),
      fotos: new RepositorioDeFotosEnMemoria(almacen),
      operaciones: new RepositorioDeOperacionesEnMemoria(almacen),
      existencias: new RepositorioDeExistenciasEnMemoria(almacen),
      conteo: new RepositorioDeConteoEnMemoria(almacen),
      resumenes: new RepositorioDeResumenesEnMemoria(almacen),
      listaDeCompras: new RepositorioDeListaDeComprasEnMemoria(almacen),
      avisos: new RepositorioDeAvisosEnMemoria(almacen),
      configuracion: new RepositorioDeConfiguracionEnMemoria(almacen),
    },
    // Con la unidad de trabajo: sin ella no hay una foto coherente al guardar la copia.
    almacenDeRespaldo: new AlmacenDeRespaldoEnMemoria(almacen, uow),
  }
}

/**
 * La composición real de la app (los seis módulos con `crearAplicacion`) sobre memoria o sobre
 * Dexie con fake-indexeddb, con reloj de pruebas, ids secuenciales (`id-1`, `id-2`, …),
 * notificador, Excel y almacenamiento persistente en memoria. Con la misma secuencia de
 * llamadas, las dos persistencias dan exactamente los mismos resultados (ids incluidos).
 *
 * Las pruebas con Dexie que guardan fotos corren con `// @vitest-environment node` (el Blob de
 * jsdom no sobrevive a fake-indexeddb).
 */
export function crearAplicacionDePrueba(
  opciones: OpcionesDeAplicacionDePrueba,
): AplicacionDePrueba {
  const almacen = opciones.almacen ?? 'memoria'
  const db = almacen === 'dexie' ? crearBaseDePrueba() : null
  const persistencia = db ? crearPersistenciaDexie(db) : persistenciaEnMemoria()

  const reloj = new RelojDePrueba(opciones.ahora)
  const notificador = new NotificadorEnMemoria()
  const procesadorDeFotos = opciones.procesadorDeFotos ?? new ProcesadorDeFotosDePrueba()
  const generadorDeExcel = new GeneradorDeExcelEnMemoria()
  const lectorDeExcel = new LectorDeExcelEnMemoria()
  const almacenamiento = new AlmacenamientoPersistenteEnMemoria()
  const bus = new BusDePrueba()

  const infraestructura: Infraestructura = {
    ...persistencia,
    reloj,
    ids: new IdsSecuenciales(),
    bus,
    notificador,
    procesadorDeFotos,
    generadorDeExcel,
    lectorDeExcel,
    almacenamiento,
  }
  const aplicacion = crearAplicacion(infraestructura)

  return {
    ...aplicacion,
    almacen,
    reloj,
    notificador,
    procesadorDeFotos,
    generadorDeExcel,
    lectorDeExcel,
    almacenamiento,
    infraestructura,
    async sinEventos(trabajo) {
      await aplicacion.esperarTareasPendientes()
      bus.silencios += 1
      try {
        return await trabajo()
      } finally {
        await aplicacion.esperarTareasPendientes()
        bus.silencios -= 1
      }
    },
    async cerrar() {
      await aplicacion.esperarTareasPendientes()
      db?.close()
    },
  }
}
