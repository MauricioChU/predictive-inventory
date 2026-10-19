import { Cantidad } from '../../../../shared/domain/cantidad'
import { Dinero } from '../../../../shared/domain/dinero'
import { normalizar } from '../../../../shared/domain/texto'
import type { Instante } from '../../../../shared/domain/fecha'
import {
  CONFIGURACION_INICIAL,
  type ConfiguracionDeNegocio,
  type EstadoDelSistema,
} from '../../../../shared/contratos/configuracion'
import type { Unidad } from '../../../../shared/domain/cantidad'
import type {
  AnalisisConsultable,
  CatalogoConsultable,
  CatalogoParaImportacion,
  DatosDeProductoNuevo,
  ErrorDeValidacion,
  InventarioConsultable,
  ProductoResumido,
  SituacionDeProducto,
  TiendaConsultable,
  TotalesDeDia,
} from '../../../../shared/contratos/entre-modulos'
import type { OperacionRegistro } from '../../../../shared/contratos/registros'
import type { AlmacenEnMemoria } from '../../../../shared/infrastructure/memoria/almacen-en-memoria'
import type { Reconstructor } from '../puertos'

/**
 * Catálogo falso para los casos de uso de Respaldo: lo mínimo para ejercer RN-RE-07/08
 * (nombre repetido contra el "catálogo", stock por unidades enteras, categorías) sin
 * depender del módulo Catálogo real (que Respaldo nunca importa).
 */
export class CatalogoDePrueba implements CatalogoConsultable {
  private contador = 0
  private readonly productosGuardados = new Map<string, ProductoResumido>()
  private readonly categorias = new Map<string, string>() // id -> nombre
  readonly llamadasACrear: DatosDeProductoNuevo[] = []
  readonly categoriasCreadas: string[] = []

  agregarCategoria(nombre: string): string {
    const id = `cat-${++this.contador}`
    this.categorias.set(id, nombre)
    return id
  }

  agregarProducto(datos: {
    id?: string
    nombre: string
    categoriaId: string
    categoriaNombre: string
    unidad?: Unidad
    precioCompra?: Dinero
    precioVenta?: Dinero
    stockMinimo?: Cantidad
    activo?: boolean
  }): string {
    const id = datos.id ?? `prod-${++this.contador}`
    this.productosGuardados.set(id, {
      id,
      nombre: datos.nombre,
      unidad: datos.unidad ?? 'UNIDAD',
      categoriaId: datos.categoriaId,
      categoriaNombre: datos.categoriaNombre,
      precioCompra: datos.precioCompra ?? Dinero.cero(),
      precioVenta: datos.precioVenta ?? Dinero.cero(),
      stockMinimo: datos.stockMinimo ?? Cantidad.cero(),
      activo: datos.activo ?? true,
      tieneFoto: false,
    })
    return id
  }

  async producto(id: string): Promise<ProductoResumido | null> {
    return this.productosGuardados.get(id) ?? null
  }

  async productos(filtro?: { soloActivos?: boolean }): Promise<ProductoResumido[]> {
    const todos = [...this.productosGuardados.values()]
    return filtro?.soloActivos ? todos.filter((p) => p.activo) : todos
  }

  async actualizarPrecioCompra(id: string, precio: Dinero): Promise<void> {
    const producto = this.productosGuardados.get(id)
    if (producto) producto.precioCompra = precio
  }

  readonly importacion: CatalogoParaImportacion = {
    validarNuevo: async (datos: DatosDeProductoNuevo): Promise<ErrorDeValidacion | null> => {
      const clave = normalizar(datos.nombre)
      const existente = [...this.productosGuardados.values()].find(
        (p) => normalizar(p.nombre) === clave,
      )
      if (existente) {
        return {
          codigo: 'NOMBRE_DUPLICADO',
          mensaje: 'Ya existe un producto con ese nombre',
          nombreExistente: existente.nombre,
        }
      }
      if (datos.unidad === 'UNIDAD') {
        const sonEnteras = [datos.stockMinimo, datos.stockInicial]
          .filter((v): v is string => v !== undefined && v !== '')
          .every((v) => Number.isInteger(Number(v)))
        if (!sonEnteras) {
          return {
            codigo: 'CANTIDAD_ENTERA',
            mensaje: 'Este producto se cuenta por unidades enteras',
          }
        }
      }
      return null
    },
    crear: async (datos: DatosDeProductoNuevo): Promise<string> => {
      this.llamadasACrear.push(datos)
      const categoriaNombre = this.categorias.get(datos.categoriaId) ?? ''
      return this.agregarProducto({
        nombre: datos.nombre,
        categoriaId: datos.categoriaId,
        categoriaNombre,
      })
    },
    categoriaPorNombre: async (nombre: string): Promise<string | null> => {
      const clave = normalizar(nombre)
      for (const [id, nombreGuardado] of this.categorias) {
        if (normalizar(nombreGuardado) === clave) return id
      }
      return null
    },
    crearCategoria: async (nombre: string): Promise<string> => {
      this.categoriasCreadas.push(nombre)
      return this.agregarCategoria(nombre)
    },
  }
}

/** Inventario falso que lee y escribe sobre el MISMO AlmacenEnMemoria que usa
 * AlmacenDeRespaldoEnMemoria, para que restaurar/reconstruir sea un flujo real de punta a
 * punta (RN-RE-03/04), sin inventar un segundo almacén paralelo. */
export class InventarioDePrueba implements InventarioConsultable {
  constructor(private readonly almacen: AlmacenEnMemoria) {}

  async stockDe(productoId: string): Promise<Cantidad> {
    const existencia = this.almacen.obtener('existencias', productoId)
    return Cantidad.deMilesimas(existencia?.cantidad ?? 0)
  }

  async existencias(): Promise<Map<string, Cantidad>> {
    return new Map(
      this.almacen
        .todos('existencias')
        .map((e) => [e.productoId, Cantidad.deMilesimas(e.cantidad)]),
    )
  }

  async tieneOperaciones(productoId: string): Promise<boolean> {
    return this.almacen.todos('operaciones').some((op) => op.productoIds.includes(productoId))
  }

  async ultimoIngresoDe(): Promise<Instante | null> {
    return null
  }

  async operaciones(): Promise<OperacionRegistro[]> {
    return this.almacen.todos('operaciones')
  }
}

/** Recalcula 'existencias' desde 'operaciones' (suma de movimientos por producto), igual
 * que haría la composición real tras restaurar una copia (RN-RE-04). */
export class ReconstructorDePrueba implements Reconstructor {
  constructor(private readonly almacen: AlmacenEnMemoria) {}

  async reconstruirTodo(): Promise<void> {
    const totales = new Map<string, number>()
    for (const operacion of this.almacen.todos('operaciones')) {
      for (const movimiento of operacion.movimientos) {
        totales.set(
          movimiento.productoId,
          (totales.get(movimiento.productoId) ?? 0) + movimiento.cantidad,
        )
      }
    }
    this.almacen.vaciar('existencias')
    for (const [productoId, cantidad] of totales) {
      this.almacen.guardar('existencias', { productoId, cantidad })
    }
  }
}

export class AnalisisDePrueba implements Pick<
  AnalisisConsultable,
  'situaciones' | 'resumenesDeTienda'
> {
  situacionesDisponibles: SituacionDeProducto[] = []
  resumenesDisponibles: TotalesDeDia[] = []

  /** Agrega una situación mínima para un producto: lo único que usa Respaldo es el estado. */
  fijarEstado(productoId: string, estado: SituacionDeProducto['estado']): void {
    this.situacionesDisponibles.push({
      productoId,
      nombre: '',
      unidad: 'UNIDAD',
      stock: Cantidad.cero(),
      stockMinimo: Cantidad.cero(),
      prediccion: null,
      diasDeCobertura: null,
      estado,
      enListaParaComprar: false,
      cantidadSugerida: null,
      parado: null,
    })
  }

  async situaciones(): Promise<SituacionDeProducto[]> {
    return this.situacionesDisponibles
  }

  async resumenesDeTienda(desde: string, hasta: string): Promise<TotalesDeDia[]> {
    return this.resumenesDisponibles.filter((d) => d.dia >= desde && d.dia <= hasta)
  }
}

export class TiendaDePrueba implements TiendaConsultable {
  private config: ConfiguracionDeNegocio = { ...CONFIGURACION_INICIAL }
  private estado: EstadoDelSistema = {
    dispositivoId: 'dispositivo-1',
    primeraVezCompletada: false,
    ultimoRespaldoEn: null,
    almacenamientoPersistente: 'DESCONOCIDO',
    ultimoPagoDelLocalAvisado: null,
  }

  fijarConfiguracion(cambios: Partial<ConfiguracionDeNegocio>): void {
    this.config = { ...this.config, ...cambios }
  }

  fijarEstado(cambios: Partial<EstadoDelSistema>): void {
    this.estado = { ...this.estado, ...cambios }
  }

  async configuracion(): Promise<ConfiguracionDeNegocio> {
    return this.config
  }

  async estadoDelSistema(): Promise<EstadoDelSistema> {
    return this.estado
  }

  async actualizarEstadoDelSistema(cambios: Partial<EstadoDelSistema>): Promise<void> {
    this.estado = { ...this.estado, ...cambios }
  }
}
