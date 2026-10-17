import { Cantidad } from '@/shared/domain/cantidad'
import type { ConteoGuiadoRegistro, OperacionRegistro } from '@/shared/contratos/registros'
import type { BaseDeDatos } from '@/shared/infrastructure/dexie/base-de-datos'
import { enTransaccion } from '@/shared/infrastructure/dexie/unidad-de-trabajo-dexie'
import type {
  ConsultaDeRecientes,
  PaginaDeOperaciones,
  RepositorioDeConteo,
  RepositorioDeExistencias,
  RepositorioDeOperaciones,
} from '../../application/puertos'
import { enOrdenDeRegistro } from '../../domain/orden'

/**
 * El libro de operaciones sobre la tabla `operaciones` (índices `anulaA`, `registradaEn` y
 * `*productoIds`, multiEntry). `todas` y `porProducto` devuelven el orden de registro: por el
 * instante de `registradaEn` (no por su texto, por si una copia trae otra zona horaria); a
 * igual instante, el orden del índice (texto y luego id), siempre el mismo.
 */
export class RepositorioDeOperacionesDexie implements RepositorioDeOperaciones {
  constructor(private readonly db: BaseDeDatos) {}

  agregar(registro: OperacionRegistro): Promise<void> {
    // ADR-0002: el libro solo crece; el id es la clave de idempotencia (Fase 2). Se verifica
    // antes de escribir (y no con el ConstraintError de IndexedDB) para lanzar el mismo error
    // que en memoria, que quien llama puede atrapar sin perder la transacción.
    return enTransaccion(this.db, [this.db.operaciones], async () => {
      if (await this.db.operaciones.get(registro.id)) {
        throw new Error(`La operación ${registro.id} ya está registrada`)
      }
      await this.db.operaciones.add(registro)
    })
  }

  async porId(id: string): Promise<OperacionRegistro | null> {
    return (await this.db.operaciones.get(id)) ?? null
  }

  async anulacionDe(operacionId: string): Promise<OperacionRegistro | null> {
    const anulacion = await this.db.operaciones
      .where('anulaA')
      .equals(operacionId)
      .filter((r) => r.tipo === 'ANULACION')
      .first()
    return anulacion ?? null
  }

  async porProducto(productoId: string): Promise<OperacionRegistro[]> {
    return enOrdenDeRegistro(
      await this.db.operaciones.where('productoIds').equals(productoId).toArray(),
    )
  }

  async todas(): Promise<OperacionRegistro[]> {
    return enOrdenDeRegistro(await this.db.operaciones.orderBy('registradaEn').toArray())
  }

  /**
   * Plan 17: por el índice `ocurridaEn`, de atrás para adelante, sin leer todo el libro: las
   * `cuantas` primeras, más el resto del grupo de su último instante, y una más para saber si
   * hay otra página.
   */
  async recientes({ tipo, antesDe, cuantas }: ConsultaDeRecientes): Promise<PaginaDeOperaciones> {
    const delTipo = (r: OperacionRegistro) => tipo === undefined || r.tipo === tipo
    const tabla = this.db.operaciones
    const desde =
      antesDe === undefined ? tabla.orderBy('ocurridaEn') : tabla.where('ocurridaEn').below(antesDe)
    const primeras = await desde.reverse().filter(delTipo).limit(cuantas).toArray()
    if (primeras.length < cuantas) return { registros: primeras, siguiente: null }
    const limite = primeras.at(-1)!.ocurridaEn
    const vistas = new Set(primeras.map((r) => r.id))
    const delGrupo = await tabla
      .where('ocurridaEn')
      .equals(limite)
      .filter((r) => delTipo(r) && !vistas.has(r.id))
      .toArray()
    const otra = await tabla.where('ocurridaEn').below(limite).reverse().filter(delTipo).first()
    return { registros: [...primeras, ...delGrupo], siguiente: otra ? limite : null }
  }

  async conAnulacion(operacionIds: readonly string[]): Promise<Set<string>> {
    if (operacionIds.length === 0) return new Set()
    const anulaciones = await this.db.operaciones
      .where('anulaA')
      .anyOf([...operacionIds])
      .filter((r) => r.tipo === 'ANULACION')
      .toArray()
    return new Set(anulaciones.flatMap((r) => (r.anulaA === null ? [] : [r.anulaA])))
  }
}

/** Proyección `productoId → cantidad actual` sobre la tabla `existencias` (milésimas). */
export class RepositorioDeExistenciasDexie implements RepositorioDeExistencias {
  constructor(private readonly db: BaseDeDatos) {}

  async obtener(productoId: string): Promise<Cantidad> {
    return Cantidad.deMilesimas((await this.db.existencias.get(productoId))?.cantidad ?? 0)
  }

  async fijar(productoId: string, cantidad: Cantidad): Promise<void> {
    await this.db.existencias.put({ productoId, cantidad: cantidad.milesimas })
  }

  async todas(): Promise<Map<string, Cantidad>> {
    const registros = await this.db.existencias.toArray()
    return new Map(registros.map((r) => [r.productoId, Cantidad.deMilesimas(r.cantidad)] as const))
  }

  reemplazarTodas(existencias: Map<string, Cantidad>): Promise<void> {
    return enTransaccion(this.db, [this.db.existencias], async () => {
      await this.db.existencias.clear()
      await this.db.existencias.bulkPut(
        [...existencias].map(([productoId, cantidad]) => ({
          productoId,
          cantidad: cantidad.milesimas,
        })),
      )
    })
  }
}

/** El conteo guiado en curso (RN-OP-21) en la tabla `conteo`, con id "actual". */
export class RepositorioDeConteoDexie implements RepositorioDeConteo {
  constructor(private readonly db: BaseDeDatos) {}

  async obtener(): Promise<ConteoGuiadoRegistro | null> {
    return (await this.db.conteo.get('actual')) ?? null
  }

  async guardar(registro: ConteoGuiadoRegistro): Promise<void> {
    await this.db.conteo.put(registro)
  }
}
