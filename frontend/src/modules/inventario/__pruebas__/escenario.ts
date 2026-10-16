import type { UnidadDeTrabajo } from '@/shared/application/unidad-de-trabajo'
import { Cantidad, type Unidad } from '@/shared/domain/cantidad'
import { Dinero } from '@/shared/domain/dinero'
import { BusEnMemoria, type EventoDeDominio } from '@/shared/domain/eventos'
import { instanteLocal } from '@/shared/domain/fecha'
import { IdsSecuenciales } from '@/shared/domain/ids'
import { RelojFijo } from '@/shared/domain/reloj'
import { normalizar } from '@/shared/domain/texto'
import type { ProductoResumido } from '@/shared/contratos/entre-modulos'
import { AlmacenEnMemoria } from '@/shared/infrastructure/memoria/almacen-en-memoria'
import { crearModuloInventario } from '../application/modulo'
import type { RepositorioDeOperaciones } from '../application/puertos'
import {
  RepositorioDeConteoEnMemoria,
  RepositorioDeExistenciasEnMemoria,
  RepositorioDeOperacionesEnMemoria,
} from '../infrastructure/memoria/repositorios'
import { AnalisisFalso, CatalogoEnMemoria, ProyeccionEspia, TiendaFalsa } from './dobles'

/** "Dado que hoy es 2026-10-15 10:00" (operaciones.feature). */
export const AHORA = instanteLocal('2026-10-15 10:00')

export interface ProductoDePrueba {
  id: string
  nombre: string
  categoria?: string
  unidad: Unidad
  compra: string
  venta: string
  minimo?: string
  stock?: string
  archivado?: boolean
  tieneFoto?: boolean
}

/** Antecedentes de operaciones.feature. */
export const ANTECEDENTES: readonly ProductoDePrueba[] = [
  {
    id: 'lejia',
    nombre: 'Lejía 1 L',
    unidad: 'UNIDAD',
    compra: '2.40',
    venta: '3.50',
    minimo: '3',
    stock: '10',
  },
  {
    id: 'carbon',
    nombre: 'Carbón',
    unidad: 'KILO',
    compra: '2.75',
    venta: '4.00',
    minimo: '3',
    stock: '10',
  },
  {
    id: 'detergente',
    nombre: 'Detergente a granel',
    unidad: 'KILO',
    compra: '5.30',
    venta: '7.90',
    minimo: '2',
    stock: '5',
  },
]

export function productoResumido(producto: ProductoDePrueba): ProductoResumido {
  const categoria = producto.categoria ?? 'Otros'
  return {
    id: producto.id,
    nombre: producto.nombre,
    unidad: producto.unidad,
    categoriaId: normalizar(categoria),
    categoriaNombre: categoria,
    precioCompra: Dinero.deTexto(producto.compra),
    precioVenta: Dinero.deTexto(producto.venta),
    stockMinimo: Cantidad.deTexto(producto.minimo ?? '0', producto.unidad),
    activo: !producto.archivado,
    tieneFoto: producto.tieneFoto ?? false,
  }
}

/**
 * Módulo Inventario real sobre repositorios en memoria, con dobles de los otros módulos y
 * los productos de los Antecedentes (cada uno con su STOCK_INICIAL). La UoW la pone cada
 * spec. Al volver, los espías están limpios: solo anotan lo que haga la prueba.
 */
export async function crearEscenario(
  crearUow: (almacen: AlmacenEnMemoria) => UnidadDeTrabajo,
  productos: readonly ProductoDePrueba[] = ANTECEDENTES,
  opciones: {
    /** Para probar un repositorio que no devuelve el libro en orden de registro. */
    envolverOperaciones?: (repositorio: RepositorioDeOperaciones) => RepositorioDeOperaciones
  } = {},
) {
  const almacen = new AlmacenEnMemoria()
  const reloj = new RelojFijo(AHORA)
  const bus = new BusEnMemoria()
  const eventos: EventoDeDominio[] = []
  bus.suscribir('OperacionRegistrada', (evento) => {
    eventos.push(evento)
  })
  bus.suscribir('OperacionAnulada', (evento) => {
    eventos.push(evento)
  })
  const catalogo = new CatalogoEnMemoria()
  const analisis = new AnalisisFalso()
  const tienda = new TiendaFalsa()
  const proyeccion = new ProyeccionEspia()
  const enMemoria = new RepositorioDeOperacionesEnMemoria(almacen)
  const operaciones = opciones.envolverOperaciones?.(enMemoria) ?? enMemoria
  const existencias = new RepositorioDeExistenciasEnMemoria(almacen)
  const conteo = new RepositorioDeConteoEnMemoria(almacen)
  const dependencias = {
    operaciones,
    existencias,
    conteo,
    uow: crearUow(almacen),
    reloj,
    ids: new IdsSecuenciales('op'),
    bus,
    catalogo: () => catalogo,
    analisis: () => analisis,
    tienda: () => tienda,
    proyecciones: () => [proyeccion],
  }
  const modulo = crearModuloInventario(dependencias)

  async function agregarProductos(lista: readonly ProductoDePrueba[]): Promise<void> {
    for (const producto of lista) {
      catalogo.agregar({ ...productoResumido(producto), activo: true })
      if (producto.stock) {
        await modulo.consultable.registrarStockInicial(
          producto.id,
          Cantidad.deTexto(producto.stock, producto.unidad),
          Dinero.deTexto(producto.compra),
        )
      }
      if (producto.archivado) catalogo.archivar(producto.id)
    }
  }

  await agregarProductos(productos)
  eventos.length = 0
  proyeccion.limpiar()

  return {
    almacen,
    /** La unidad de trabajo del módulo: para envolver sus casos de uso en una externa. */
    uow: dependencias.uow,
    reloj,
    bus,
    eventos,
    catalogo,
    analisis,
    tienda,
    proyeccion,
    operaciones,
    existencias,
    conteo,
    modulo,
    agregarProductos,
    /** "Y abro la app": un módulo nuevo sobre los mismos datos guardados. */
    reabrir: () => crearModuloInventario(dependencias),
    stock: (productoId: string) => modulo.consultable.stockDe(productoId),
    tipos: async (productoId: string) =>
      (await operaciones.porProducto(productoId)).map((r) => r.tipo),
    ultima: async () => (await operaciones.todas()).at(-1),
  }
}
