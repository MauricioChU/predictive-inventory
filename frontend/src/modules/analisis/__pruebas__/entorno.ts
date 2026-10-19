import type { UnidadDeTrabajo } from '@/shared/application/unidad-de-trabajo'
import {
  CONFIGURACION_INICIAL,
  type ConfiguracionDeNegocio,
  type EstadoDelSistema,
} from '@/shared/contratos/configuracion'
import type {
  CatalogoConsultable,
  InventarioConsultable,
  ProductoResumido,
  TiendaConsultable,
} from '@/shared/contratos/entre-modulos'
import type { OperacionRegistro } from '@/shared/contratos/registros'
import { Cantidad } from '@/shared/domain/cantidad'
import type { Dinero } from '@/shared/domain/dinero'
import type { Instante } from '@/shared/domain/fecha'
import { RelojFijo } from '@/shared/domain/reloj'
import { AlmacenEnMemoria } from '@/shared/infrastructure/memoria/almacen-en-memoria'
import { crearModuloAnalisis, type ModuloAnalisis } from '../application/modulo'
import type { HistorialDePrueba } from '../domain/__pruebas__/historial'
import {
  RepositorioDeListaDeComprasEnMemoria,
  RepositorioDeResumenesEnMemoria,
} from '../infrastructure/memoria/repositorios'

/** 2026-10-15 18:00 en Lima (antecedentes de torre-de-control.feature). */
export const AHORA = '2026-10-15T23:00:00.000Z'

/** Catálogo falso: un mapa de productos. */
export class CatalogoFalso implements CatalogoConsultable {
  readonly porId = new Map<string, ProductoResumido>()

  constructor(productos: readonly ProductoResumido[]) {
    for (const p of productos) this.porId.set(p.id, p)
  }

  async producto(id: string): Promise<ProductoResumido | null> {
    return this.porId.get(id) ?? null
  }

  async productos(filtro: { soloActivos?: boolean } = {}): Promise<ProductoResumido[]> {
    const todos = [...this.porId.values()]
    return filtro.soloActivos ? todos.filter((p) => p.activo) : todos
  }

  async actualizarPrecioCompra(id: string, precio: Dinero): Promise<void> {
    const p = this.porId.get(id)
    if (p) this.porId.set(id, { ...p, precioCompra: precio })
  }
}

/** Inventario falso: existencias en un mapa, actualizadas con cada operación registrada. */
export class InventarioFalso implements InventarioConsultable {
  readonly stock = new Map<string, Cantidad>()
  readonly libro: OperacionRegistro[] = []

  async stockDe(productoId: string): Promise<Cantidad> {
    return this.stock.get(productoId) ?? Cantidad.cero()
  }

  async existencias(): Promise<Map<string, Cantidad>> {
    return new Map(this.stock)
  }

  async tieneOperaciones(productoId: string): Promise<boolean> {
    return this.libro.some((op) => op.productoIds.includes(productoId))
  }

  async ultimoIngresoDe(productoId: string): Promise<Instante | null> {
    const ingresos = this.libro.filter(
      (op) => op.tipo === 'INGRESO' && op.productoIds.includes(productoId),
    )
    return ingresos[ingresos.length - 1]?.ocurridaEn ?? null
  }

  async operaciones(): Promise<OperacionRegistro[]> {
    return [...this.libro]
  }

  aplicar(op: OperacionRegistro): void {
    this.libro.push(op)
    for (const m of op.movimientos) {
      const actual = this.stock.get(m.productoId) ?? Cantidad.cero()
      this.stock.set(m.productoId, actual.sumar(Cantidad.deMilesimas(m.cantidad)))
    }
  }
}

/** Tienda falsa: 7 días entre compras, 3 de anticipación, "Bodega Rosita". */
export class TiendaFalsa implements TiendaConsultable {
  config: ConfiguracionDeNegocio = {
    ...CONFIGURACION_INICIAL,
    nombreTienda: 'Bodega Rosita',
    diasEntreCompras: 7,
    diasAnticipacion: 3,
  }
  estado: EstadoDelSistema = {
    dispositivoId: 'dispositivo-de-prueba',
    primeraVezCompletada: true,
    ultimoRespaldoEn: null,
    almacenamientoPersistente: 'DESCONOCIDO',
    ultimoPagoDelLocalAvisado: null,
  }

  async configuracion(): Promise<ConfiguracionDeNegocio> {
    return { ...this.config }
  }

  async estadoDelSistema(): Promise<EstadoDelSistema> {
    return { ...this.estado }
  }

  async actualizarEstadoDelSistema(cambios: Partial<EstadoDelSistema>): Promise<void> {
    this.estado = { ...this.estado, ...cambios }
  }
}

export interface EntornoDeAnalisis {
  almacen: AlmacenEnMemoria
  reloj: RelojFijo
  catalogo: CatalogoFalso
  inventario: InventarioFalso
  tienda: TiendaFalsa
  resumenes: RepositorioDeResumenesEnMemoria
  listaDeCompras: RepositorioDeListaDeComprasEnMemoria
  modulo: ModuloAnalisis
  /** Otra instancia del módulo sobre los mismos datos ("abro la app"). */
  reabrir(): ModuloAnalisis
  /** Como Inventario: guarda el stock y actualiza la proyección. */
  registrar(...operaciones: OperacionRegistro[]): Promise<void>
  anular(original: OperacionRegistro, anulacion: OperacionRegistro): Promise<void>
  /** Carga las filas y el stock de historiales construidos. */
  cargar(...historiales: HistorialDePrueba[]): Promise<void>
}

/** Entorno de pruebas del módulo con dobles de Catálogo, Inventario y Tienda. La UoW la elige el spec. */
export function crearEntorno(opciones: {
  productos: readonly ProductoResumido[]
  uow: (almacen: AlmacenEnMemoria) => UnidadDeTrabajo
}): EntornoDeAnalisis {
  const almacen = new AlmacenEnMemoria()
  const reloj = new RelojFijo(AHORA)
  const catalogo = new CatalogoFalso(opciones.productos)
  const inventario = new InventarioFalso()
  const tienda = new TiendaFalsa()
  const resumenes = new RepositorioDeResumenesEnMemoria(almacen)
  const listaDeCompras = new RepositorioDeListaDeComprasEnMemoria(almacen)
  const uow = opciones.uow(almacen)
  const abrir = () =>
    crearModuloAnalisis({
      resumenes,
      listaDeCompras,
      uow,
      reloj,
      catalogo: () => catalogo,
      inventario: () => inventario,
      tienda: () => tienda,
    })
  const modulo = abrir()
  return {
    almacen,
    reloj,
    catalogo,
    inventario,
    tienda,
    resumenes,
    listaDeCompras,
    modulo,
    reabrir: abrir,
    async registrar(...operaciones) {
      for (const op of operaciones) {
        inventario.aplicar(op)
        await modulo.proyeccion.alRegistrar(op)
      }
    },
    async anular(original, anulacion) {
      inventario.aplicar(anulacion)
      await modulo.proyeccion.alAnular(original, anulacion)
    },
    async cargar(...historiales) {
      for (const h of historiales) {
        for (const fila of h.filas) await resumenes.guardar(fila.aRegistro())
        inventario.stock.set(h.productoId, h.stock)
      }
    },
  }
}
