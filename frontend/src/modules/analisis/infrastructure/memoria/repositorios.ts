import type { ListaDeComprasRegistro, ResumenDiarioRegistro } from '@/shared/contratos/registros'
import type { Dia } from '@/shared/domain/fecha'
import type { AlmacenEnMemoria } from '@/shared/infrastructure/memoria/almacen-en-memoria'
import type { RepositorioDeListaDeCompras, RepositorioDeResumenes } from '../../application/puertos'
import { esFilaSinMovimiento } from '../../domain/resumen-diario'

function enOrdenDeDia(a: ResumenDiarioRegistro, b: ResumenDiarioRegistro): number {
  if (a.dia !== b.dia) return a.dia < b.dia ? -1 : 1
  return a.productoId < b.productoId ? -1 : a.productoId > b.productoId ? 1 : 0
}

export class RepositorioDeResumenesEnMemoria implements RepositorioDeResumenes {
  constructor(private readonly almacen: AlmacenEnMemoria) {}

  async obtener(productoId: string, dia: Dia): Promise<ResumenDiarioRegistro | null> {
    return this.almacen.obtener('resumenes', `${productoId}|${dia}`) ?? null
  }

  async guardar(r: ResumenDiarioRegistro): Promise<void> {
    this.almacen.guardar('resumenes', r)
  }

  async entre(desde: Dia, hasta: Dia): Promise<ResumenDiarioRegistro[]> {
    return this.almacen
      .todos('resumenes')
      .filter((r) => r.dia >= desde && r.dia <= hasta)
      .sort(enOrdenDeDia)
  }

  async deProductoEntre(
    productoId: string,
    desde: Dia,
    hasta: Dia,
  ): Promise<ResumenDiarioRegistro[]> {
    return this.delProducto(productoId).filter((r) => r.dia >= desde && r.dia <= hasta)
  }

  async primerDiaDe(productoId: string): Promise<Dia | null> {
    return this.delProducto(productoId).find((r) => !esFilaSinMovimiento(r))?.dia ?? null
  }

  async primerDiaDeLaTienda(): Promise<Dia | null> {
    return this.almacen.todos('resumenes').sort(enOrdenDeDia)[0]?.dia ?? null
  }

  async ultimoDiaConVentaDe(productoId: string): Promise<Dia | null> {
    const conVentas = this.delProducto(productoId).filter((r) => r.lineasVendidas > 0)
    return conVentas[conVentas.length - 1]?.dia ?? null
  }

  async vaciar(): Promise<void> {
    this.almacen.vaciar('resumenes')
  }

  /** Filas del producto en orden de día (como el índice compuesto [productoId+dia] de Dexie). */
  private delProducto(productoId: string): ResumenDiarioRegistro[] {
    return this.almacen
      .todos('resumenes')
      .filter((r) => r.productoId === productoId)
      .sort(enOrdenDeDia)
  }
}

export class RepositorioDeListaDeComprasEnMemoria implements RepositorioDeListaDeCompras {
  constructor(private readonly almacen: AlmacenEnMemoria) {}

  async delDia(dia: Dia): Promise<ListaDeComprasRegistro | null> {
    return this.almacen.obtener('listaDeCompras', dia) ?? null
  }

  async guardar(r: ListaDeComprasRegistro): Promise<void> {
    this.almacen.guardar('listaDeCompras', r)
  }
}
