import Dexie from 'dexie'
import type { ListaDeComprasRegistro, ResumenDiarioRegistro } from '@/shared/contratos/registros'
import type { Dia } from '@/shared/domain/fecha'
import type { BaseDeDatos } from '@/shared/infrastructure/dexie/base-de-datos'
import { enTransaccion } from '@/shared/infrastructure/dexie/unidad-de-trabajo-dexie'
import type { RepositorioDeListaDeCompras, RepositorioDeResumenes } from '../../application/puertos'
import { esFilaSinMovimiento } from '../../domain/resumen-diario'

/** Mismo orden que la implementación en memoria: por día y, a igual día, por id del producto. */
function enOrdenDeDia(a: ResumenDiarioRegistro, b: ResumenDiarioRegistro): number {
  if (a.dia !== b.dia) return a.dia < b.dia ? -1 : 1
  return a.productoId < b.productoId ? -1 : a.productoId > b.productoId ? 1 : 0
}

/**
 * Proyección `ResumenDiario` sobre la tabla `resumenes`: `entre` usa el índice `dia`; las
 * consultas de un producto, el compuesto `[productoId+dia]` (sus filas en orden de día).
 */
export class RepositorioDeResumenesDexie implements RepositorioDeResumenes {
  constructor(private readonly db: BaseDeDatos) {}

  async obtener(productoId: string, dia: Dia): Promise<ResumenDiarioRegistro | null> {
    return (await this.db.resumenes.get(`${productoId}|${dia}`)) ?? null
  }

  async guardar(r: ResumenDiarioRegistro): Promise<void> {
    await this.db.resumenes.put(r)
  }

  guardarVarios(registros: readonly ResumenDiarioRegistro[]): Promise<void> {
    // En una transacción explícita: si una fila falla, bulkPut rechaza y no queda ninguna
    // (en una implícita, las demás se confirmarían igual).
    return enTransaccion(this.db, [this.db.resumenes], async () => {
      await this.db.resumenes.bulkPut([...registros])
    })
  }

  async entre(desde: Dia, hasta: Dia): Promise<ResumenDiarioRegistro[]> {
    const filas = await this.db.resumenes.where('dia').between(desde, hasta, true, true).toArray()
    // El índice desempata por la clave `productoId|dia`, que no ordena igual que el id del
    // producto ('ab|…' < 'a|…'): se ordena como en memoria.
    return filas.sort(enOrdenDeDia)
  }

  deProductoEntre(productoId: string, desde: Dia, hasta: Dia): Promise<ResumenDiarioRegistro[]> {
    return this.db.resumenes
      .where('[productoId+dia]')
      .between([productoId, desde], [productoId, hasta], true, true)
      .toArray()
  }

  /** Ignora las filas en cero que deja una anulación del mismo día (`esFilaSinMovimiento`). */
  async primerDiaDe(productoId: string): Promise<Dia | null> {
    const fila = await this.delProducto(productoId)
      .filter((r) => !esFilaSinMovimiento(r))
      .first()
    return fila?.dia ?? null
  }

  /**
   * Un cursor de claves 'nextunique' sobre el índice `productoId`: IndexedDB ordena las
   * entradas de igual clave por la clave primaria (`productoId|dia`, es decir, por día), así
   * que su `primaryKey` es la de la fila MÁS ANTIGUA de cada producto, sin recorrer las demás.
   * Esas filas se leen de una vez (`bulkGet`). Si una es una fila sin movimiento (anulación del
   * mismo día, raro), se busca la siguiente con `primerDiaDe`: la misma regla.
   */
  async primerosDias(): Promise<Map<string, Dia>> {
    const claves: string[] = []
    await this.db.resumenes.orderBy('productoId').eachUniqueKey((_, cursor) => {
      claves.push(cursor.primaryKey)
    })
    const masAntiguas = await this.db.resumenes.bulkGet(claves)
    const dias = new Map<string, Dia>()
    for (const r of masAntiguas) {
      if (!r) continue
      const dia = esFilaSinMovimiento(r) ? await this.primerDiaDe(r.productoId) : r.dia
      if (dia !== null) dias.set(r.productoId, dia)
    }
    return dias
  }

  /** Cualquier fila cuenta (como en memoria): la regla de las filas sin movimiento es solo de `primerDiaDe`. */
  async primerDiaDeLaTienda(): Promise<Dia | null> {
    return (await this.db.resumenes.orderBy('dia').first())?.dia ?? null
  }

  async ultimoDiaConVentaDe(productoId: string): Promise<Dia | null> {
    const fila = await this.delProducto(productoId)
      .reverse()
      .filter((r) => r.lineasVendidas > 0)
      .first()
    return fila?.dia ?? null
  }

  async vaciar(): Promise<void> {
    await this.db.resumenes.clear()
  }

  /** Todas las filas del producto, en orden de día (índice `[productoId+dia]`). */
  private delProducto(productoId: string) {
    return this.db.resumenes
      .where('[productoId+dia]')
      .between([productoId, Dexie.minKey], [productoId, Dexie.maxKey], true, true)
  }
}

/** Cambios del usuario a la lista para comprar (RN-AN-08), uno por día, en `listaDeCompras`. */
export class RepositorioDeListaDeComprasDexie implements RepositorioDeListaDeCompras {
  constructor(private readonly db: BaseDeDatos) {}

  async delDia(dia: Dia): Promise<ListaDeComprasRegistro | null> {
    return (await this.db.listaDeCompras.get(dia)) ?? null
  }

  async guardar(r: ListaDeComprasRegistro): Promise<void> {
    await this.db.listaDeCompras.put(r)
  }
}
