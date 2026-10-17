import type { UnidadDeTrabajo } from '@/shared/application/unidad-de-trabajo'
import type { Cantidad } from '@/shared/domain/cantidad'
import type { BusDeEventos } from '@/shared/domain/eventos'
import type { Instante } from '@/shared/domain/fecha'
import type { ProyeccionDeOperaciones } from '@/shared/contratos/entre-modulos'
import type { Operacion } from '../domain/operacion'
import { exigirSinAnular, validarStock, type DatosDeProducto } from '../domain/reglas'
import type { RepositorioDeExistencias, RepositorioDeOperaciones } from './puertos'

export interface DependenciasDelLibro {
  operaciones: RepositorioDeOperaciones
  existencias: RepositorioDeExistencias
  uow: UnidadDeTrabajo
  bus: BusDeEventos
  proyecciones: () => ProyeccionDeOperaciones[]
  /** RN-OP-18: se llama tras confirmar cada registro que ofrece Deshacer (no las anulaciones). */
  ofrecerDeshacer: (operacionId: string, registradaEn: Instante) => void
}

/** Datos de los productos para el mensaje de RN-OP-05; solo se usan si algo no alcanza. */
export type ProductosDeLaOperacion = ReadonlyMap<string, DatosDeProducto>

export interface OpcionesDeRegistro {
  /**
   * RN-OP-18 (por defecto, sí). Ola 3, ruling 2: el stock inicial y el retiro que pide Catálogo
   * (`InventarioParaCatalogo`) no ofrecen Deshacer.
   */
  ofrecerDeshacer?: boolean
}

/** Lo que se puede escribir dentro de una transacción del libro. */
export interface EscrituraEnLibro {
  registrar(
    operacion: Operacion,
    productos?: ProductosDeLaOperacion,
    opciones?: OpcionesDeRegistro,
  ): Promise<void>
  anular(
    original: Operacion,
    anulacion: Operacion,
    productos?: ProductosDeLaOperacion,
  ): Promise<void>
}

/**
 * Registro común de operaciones (ADR-0002). Dentro de UNA unidad de trabajo: lee las
 * existencias de los productos → valida el stock (RN-OP-05) → agrega la operación → fija
 * las existencias → actualiza las proyecciones. Si algo falla, no queda nada (RN-OP-06).
 * Los eventos y, para registros, el Deshacer se dejan con `uow.alConfirmar`: corren solo
 * DESPUÉS de confirmar la transacción MÁS EXTERNA (Ola 3, ruling 1), así que si el libro se
 * usa dentro de otra unidad de trabajo (p. ej. la de Catálogo al crear un producto) y esa
 * falla después, no se publica nada ni se ofrece Deshacer.
 */
export class LibroDeOperaciones {
  constructor(private readonly d: DependenciasDelLibro) {}

  enTransaccion<T>(trabajo: (escritura: EscrituraEnLibro) => Promise<T>): Promise<T> {
    const escritura: EscrituraEnLibro = {
      registrar: async (operacion, productos = new Map(), opciones = {}) => {
        if (operacion.tipo === 'ANULACION') {
          throw new Error('Una anulación se escribe con anular()')
        }
        const registro = operacion.aRegistro()
        await this.escribir(operacion, productos)
        for (const proyeccion of this.d.proyecciones()) await proyeccion.alRegistrar(registro)
        const ofrecerDeshacer = opciones.ofrecerDeshacer ?? true
        this.d.uow.alConfirmar(() => this.publicarRegistro(operacion, ofrecerDeshacer))
      },
      anular: async (original, anulacion, productos = new Map()) => {
        if (anulacion.anulaA !== original.id) {
          throw new Error(`La anulación ${anulacion.id} no revierte a ${original.id}`)
        }
        // RN-OP-17: una sola vez. Se verifica aquí, en la misma transacción que escribe, para
        // que ningún camino pueda registrar una segunda anulación.
        exigirSinAnular(await this.d.operaciones.anulacionDe(original.id))
        const registro = anulacion.aRegistro()
        await this.escribir(anulacion, productos)
        const registroOriginal = original.aRegistro()
        for (const proyeccion of this.d.proyecciones()) {
          await proyeccion.alAnular(registroOriginal, registro)
        }
        this.d.uow.alConfirmar(() => this.publicarAnulacion(original, anulacion))
      },
    }
    return this.d.uow.ejecutar(() => trabajo(escritura))
  }

  registrar(
    operacion: Operacion,
    productos?: ProductosDeLaOperacion,
    opciones?: OpcionesDeRegistro,
  ): Promise<void> {
    return this.enTransaccion((escritura) => escritura.registrar(operacion, productos, opciones))
  }

  anular(
    original: Operacion,
    anulacion: Operacion,
    productos?: ProductosDeLaOperacion,
  ): Promise<void> {
    return this.enTransaccion((escritura) => escritura.anular(original, anulacion, productos))
  }

  private async escribir(operacion: Operacion, productos: ProductosDeLaOperacion): Promise<void> {
    const stockActual = new Map<string, Cantidad>()
    for (const productoId of operacion.productoIds) {
      stockActual.set(productoId, await this.d.existencias.obtener(productoId))
    }
    const resultantes = validarStock(operacion.movimientos, stockActual, productos)
    await this.d.operaciones.agregar(operacion.aRegistro())
    for (const [productoId, cantidad] of resultantes) {
      await this.d.existencias.fijar(productoId, cantidad)
    }
  }

  private async publicarRegistro(operacion: Operacion, ofrecerDeshacer: boolean): Promise<void> {
    await this.d.bus.publicar({
      tipo: 'OperacionRegistrada',
      operacionId: operacion.id,
      tipoOperacion: operacion.tipo,
      productoIds: operacion.productoIds,
    })
    if (ofrecerDeshacer) this.d.ofrecerDeshacer(operacion.id, operacion.registradaEn)
  }

  private async publicarAnulacion(original: Operacion, anulacion: Operacion): Promise<void> {
    await this.d.bus.publicar({
      tipo: 'OperacionAnulada',
      operacionId: original.id,
      anulacionId: anulacion.id,
      productoIds: anulacion.productoIds,
    })
  }
}
