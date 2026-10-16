import Dexie from 'dexie'
import type { ListaDeComprasRegistro, ResumenDiarioRegistro } from '@/shared/contratos/registros'
import type { Dia } from '@/shared/domain/fecha'
import type { BaseDeDatos } from '@/shared/infrastructure/dexie/base-de-datos'
import { enTransaccion } from '@/shared/infrastructure/dexie/unidad-de-trabajo-dexie'
import type { RepositorioDeListaDeCompras, RepositorioDeResumenes } from '../../application/puertos'

/** Mismo orden que la implementación en memoria: por día y, a igual día, por id del producto. */
function enOrdenDeDia(a: ResumenDiarioRegistro, b: ResumenDiarioRegistro): number {
  if (a.dia !== b.dia) return a.dia < b.dia ? -1 : 1
  return a.productoId < b.productoId ? -1 : a.productoId > b.productoId ? 1 : 0
}

/**
 * Una fila sin ningún movimiento (todas las métricas y el cambio neto en cero), como la que
 * queda de un día cuya única venta se anuló ese mismo día: no cuenta como primer día.
 * Misma regla que `esFilaSinMovimiento` (analisis/domain/resumen-diario.ts, rama
 * feat/eventos-diferidos); al integrar, este predicado se reemplaza por ese.
 */
function esFilaSinMovimiento(r: ResumenDiarioRegistro): boolean {
  return (
    r.lineasVendidas === 0 &&
    r.cantidadVendida === 0 &&
    r.ventas === 0 &&
    r.costoVendido === 0 &&
    r.costoMermas === 0 &&
    r.valorAjustes === 0 &&
    r.cambioNeto === 0
  )
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

  async primerDiaDe(productoId: string): Promise<Dia | null> {
    const fila = await this.delProducto(productoId)
      .filter((r) => !esFilaSinMovimiento(r))
      .first()
    return fila?.dia ?? null
  }

  async primerDiaDeLaTienda(): Promise<Dia | null> {
    const fila = await this.db.resumenes
      .orderBy('dia')
      .filter((r) => !esFilaSinMovimiento(r))
      .first()
    return fila?.dia ?? null
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
