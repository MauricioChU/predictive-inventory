import type { UnidadDeTrabajo } from '@/shared/application/unidad-de-trabajo'
import type { Cantidad } from '@/shared/domain/cantidad'
import type { BusDeEventos } from '@/shared/domain/eventos'
import type { Instante } from '@/shared/domain/fecha'
import type { ProyeccionDeOperaciones } from '@/shared/contratos/entre-modulos'
import type { Operacion } from '../domain/operacion'
import { validarStock, type DatosDeProducto } from '../domain/reglas'
import type { RepositorioDeExistencias, RepositorioDeOperaciones } from './puertos'

export interface DependenciasDelLibro {
  operaciones: RepositorioDeOperaciones
  existencias: RepositorioDeExistencias
  uow: UnidadDeTrabajo
  bus: BusDeEventos
  proyecciones: () => ProyeccionDeOperaciones[]
  /** RN-OP-18: se llama tras confirmar cada registro (no las anulaciones). */
  alConfirmarRegistro: (operacionId: string, registradaEn: Instante) => void
}

/** Datos de los productos para el mensaje de RN-OP-05; solo se usan si algo no alcanza. */
export type ProductosDeLaOperacion = ReadonlyMap<string, DatosDeProducto>

/** Lo que se puede escribir dentro de una transacción del libro. */
export interface EscrituraEnLibro {
  registrar(operacion: Operacion, productos?: ProductosDeLaOperacion): Promise<void>
  anular(
    original: Operacion,
    anulacion: Operacion,
    productos?: ProductosDeLaOperacion,
  ): Promise<void>
}

type Pendiente =
  | { tipo: 'registro'; operacion: Operacion }
  | { tipo: 'anulacion'; original: Operacion; anulacion: Operacion }

/**
 * Registro común de operaciones (ADR-0002). Dentro de UNA unidad de trabajo: lee las
 * existencias de los productos → valida el stock (RN-OP-05) → agrega la operación → fija
 * las existencias → actualiza las proyecciones. Si algo falla, no queda nada (RN-OP-06).
 * Solo DESPUÉS de confirmar publica los eventos y, para registros, ofrece deshacer.
 */
export class LibroDeOperaciones {
  constructor(private readonly d: DependenciasDelLibro) {}

  async enTransaccion<T>(trabajo: (escritura: EscrituraEnLibro) => Promise<T>): Promise<T> {
    const pendientes: Pendiente[] = []
    const escritura: EscrituraEnLibro = {
      registrar: async (operacion, productos = new Map()) => {
        if (operacion.tipo === 'ANULACION') {
          throw new Error('Una anulación se escribe con anular()')
        }
        const registro = operacion.aRegistro()
        await this.escribir(operacion, productos)
        for (const proyeccion of this.d.proyecciones()) await proyeccion.alRegistrar(registro)
        pendientes.push({ tipo: 'registro', operacion })
      },
      anular: async (original, anulacion, productos = new Map()) => {
        if (anulacion.anulaA !== original.id) {
          throw new Error(`La anulación ${anulacion.id} no revierte a ${original.id}`)
        }
        const registro = anulacion.aRegistro()
        await this.escribir(anulacion, productos)
        const registroOriginal = original.aRegistro()
        for (const proyeccion of this.d.proyecciones()) {
          await proyeccion.alAnular(registroOriginal, registro)
        }
        pendientes.push({ tipo: 'anulacion', original, anulacion })
      },
    }
    const resultado = await this.d.uow.ejecutar(() => trabajo(escritura))
    for (const pendiente of pendientes) await this.publicar(pendiente)
    return resultado
  }

  registrar(operacion: Operacion, productos?: ProductosDeLaOperacion): Promise<void> {
    return this.enTransaccion((escritura) => escritura.registrar(operacion, productos))
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

  private async publicar(pendiente: Pendiente): Promise<void> {
    if (pendiente.tipo === 'anulacion') {
      await this.d.bus.publicar({
        tipo: 'OperacionAnulada',
        operacionId: pendiente.original.id,
        anulacionId: pendiente.anulacion.id,
        productoIds: pendiente.anulacion.productoIds,
      })
      return
    }
    const { operacion } = pendiente
    await this.d.bus.publicar({
      tipo: 'OperacionRegistrada',
      operacionId: operacion.id,
      tipoOperacion: operacion.tipo,
      productoIds: operacion.productoIds,
    })
    this.d.alConfirmarRegistro(operacion.id, operacion.registradaEn)
  }
}
