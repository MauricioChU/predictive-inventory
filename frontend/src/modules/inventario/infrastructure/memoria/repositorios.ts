import { Cantidad } from '@/shared/domain/cantidad'
import type { ConteoGuiadoRegistro, OperacionRegistro } from '@/shared/contratos/registros'
import type { AlmacenEnMemoria } from '@/shared/infrastructure/memoria/almacen-en-memoria'
import { enOrdenDeRegistro } from '../../domain/orden'
import type {
  ConsultaDeRecientes,
  PaginaDeOperaciones,
  RepositorioDeConteo,
  RepositorioDeExistencias,
  RepositorioDeOperaciones,
} from '../../application/puertos'

export class RepositorioDeOperacionesEnMemoria implements RepositorioDeOperaciones {
  constructor(private readonly almacen: AlmacenEnMemoria) {}

  async agregar(registro: OperacionRegistro): Promise<void> {
    // ADR-0002: el libro solo crece; el id es la clave de idempotencia (Fase 2).
    if (this.almacen.obtener('operaciones', registro.id)) {
      throw new Error(`La operación ${registro.id} ya está registrada`)
    }
    this.almacen.guardar('operaciones', registro)
  }

  async porId(id: string): Promise<OperacionRegistro | null> {
    return this.almacen.obtener('operaciones', id) ?? null
  }

  async anulacionDe(operacionId: string): Promise<OperacionRegistro | null> {
    const todas = this.almacen.todos('operaciones')
    return todas.find((r) => r.tipo === 'ANULACION' && r.anulaA === operacionId) ?? null
  }

  /** Por `registradaEn` (orden estable): tras restaurar una copia, el almacén no lo garantiza. */
  async porProducto(productoId: string): Promise<OperacionRegistro[]> {
    return enOrdenDeRegistro(await this.todas()).filter((r) => r.productoIds.includes(productoId))
  }

  /** Por `registradaEn` (orden estable). */
  async todas(): Promise<OperacionRegistro[]> {
    return enOrdenDeRegistro(this.almacen.todos('operaciones'))
  }

  /** Como el índice `ocurridaEn` de Dexie: por el texto del instante, de mayor a menor. */
  async recientes({ tipo, antesDe, cuantas }: ConsultaDeRecientes): Promise<PaginaDeOperaciones> {
    const candidatas = this.almacen
      .todos('operaciones')
      .filter((r) => tipo === undefined || r.tipo === tipo)
      .filter((r) => antesDe === undefined || r.ocurridaEn < antesDe)
      .sort((x, y) => Number(y.ocurridaEn > x.ocurridaEn) - Number(y.ocurridaEn < x.ocurridaEn))
    if (candidatas.length <= cuantas) return { registros: candidatas, siguiente: null }
    // El grupo del último instante va entero: la página que sigue empieza antes de él.
    const limite = candidatas[cuantas - 1]!.ocurridaEn
    let fin = cuantas
    while (fin < candidatas.length && candidatas[fin]!.ocurridaEn === limite) fin += 1
    return {
      registros: candidatas.slice(0, fin),
      siguiente: fin < candidatas.length ? limite : null,
    }
  }

  async conAnulacion(operacionIds: readonly string[]): Promise<Set<string>> {
    const buscadas = new Set(operacionIds)
    return new Set(
      this.almacen
        .todos('operaciones')
        .flatMap((r) =>
          r.tipo === 'ANULACION' && r.anulaA !== null && buscadas.has(r.anulaA) ? [r.anulaA] : [],
        ),
    )
  }
}

export class RepositorioDeExistenciasEnMemoria implements RepositorioDeExistencias {
  constructor(private readonly almacen: AlmacenEnMemoria) {}

  async obtener(productoId: string): Promise<Cantidad> {
    return Cantidad.deMilesimas(this.almacen.obtener('existencias', productoId)?.cantidad ?? 0)
  }

  async fijar(productoId: string, cantidad: Cantidad): Promise<void> {
    this.almacen.guardar('existencias', { productoId, cantidad: cantidad.milesimas })
  }

  async todas(): Promise<Map<string, Cantidad>> {
    return new Map(
      this.almacen
        .todos('existencias')
        .map((r) => [r.productoId, Cantidad.deMilesimas(r.cantidad)] as const),
    )
  }

  async reemplazarTodas(existencias: Map<string, Cantidad>): Promise<void> {
    this.almacen.vaciar('existencias')
    for (const [productoId, cantidad] of existencias) await this.fijar(productoId, cantidad)
  }
}

export class RepositorioDeConteoEnMemoria implements RepositorioDeConteo {
  constructor(private readonly almacen: AlmacenEnMemoria) {}

  async obtener(): Promise<ConteoGuiadoRegistro | null> {
    return this.almacen.obtener('conteo', 'actual') ?? null
  }

  async guardar(registro: ConteoGuiadoRegistro): Promise<void> {
    this.almacen.guardar('conteo', registro)
  }
}
