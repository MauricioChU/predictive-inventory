import type { ProductoRegistro } from '@/shared/contratos/registros'
import { Cantidad, type Unidad } from '@/shared/domain/cantidad'
import { Dinero } from '@/shared/domain/dinero'
import type { BusDeEventos } from '@/shared/domain/eventos'
import { ErrorDeDominio } from '@/shared/domain/errores'
import type { GeneradorDeIds } from '@/shared/domain/ids'
import type { Reloj } from '@/shared/domain/reloj'
import type { Respuesta } from '@/shared/application/respuesta'
import type { UnidadDeTrabajo } from '@/shared/application/unidad-de-trabajo'
import type {
  AnalisisConsultable,
  CatalogoConsultable,
  CatalogoParaImportacion,
  DatosDeProductoNuevo,
  InventarioParaCatalogo,
  ProductoResumido,
} from '@/shared/contratos/entre-modulos'
import {
  eliminarCategoria,
  categoriaPorNombre,
  crearCategoria,
  listarCategorias,
  renombrarCategoria,
  sembrarCategoriasIniciales,
} from './categorias'
import { guardarFoto, obtenerFoto, quitarFoto } from './fotos'
import type {
  ProcesadorDeFotos,
  RepositorioDeCategorias,
  RepositorioDeFotos,
  RepositorioDeProductos,
} from './puertos'
import {
  actualizarPrecioCompra,
  archivarProducto,
  buscarProductos,
  crearProducto,
  editarProducto,
  obtenerProducto,
  reactivarProducto,
  validarNuevo,
} from './productos'

/**
 * Dependencias que recibe `crearModuloCatalogo` (Tarea 5). Las de otros módulos son
 * perezosas (`() => …`) para permitir referencias cruzadas en la composición.
 */
export interface DependenciasDeCatalogo {
  productos: RepositorioDeProductos
  categorias: RepositorioDeCategorias
  fotos: RepositorioDeFotos
  procesadorDeFotos: ProcesadorDeFotos
  uow: UnidadDeTrabajo
  reloj: Reloj
  ids: GeneradorDeIds
  bus: BusDeEventos
  inventario: () => InventarioParaCatalogo
  ventas: () => Pick<AnalisisConsultable, 'vecesVendido'>
}

export interface ProductoVista {
  id: string
  nombre: string
  categoriaId: string
  categoriaNombre: string
  unidad: Unidad
  precioCompra: Dinero
  precioVenta: Dinero
  /** `precioVenta - precioCompra`; puede ser cero o negativo (RN-CAT-05). */
  gananciaPorUnidad: Dinero
  stockMinimo: Cantidad
  stock: Cantidad
  activo: boolean
  tieneFoto: boolean
}

export interface CategoriaVista {
  id: string
  nombre: string
}

export interface DatosDeEdicion {
  productoId: string
  nombre?: string
  categoriaId?: string
  unidad?: Unidad
  precioCompra?: string
  precioVenta?: string
  stockMinimo?: string
  confirmado?: boolean
}

/** API pública del módulo Catálogo (Tarea 5: implementada por `crearModuloCatalogo`). */
export interface ModuloCatalogo {
  crearProducto(
    datos: DatosDeProductoNuevo & { confirmado?: boolean },
  ): Promise<Respuesta<{ productoId: string }>>
  editarProducto(datos: DatosDeEdicion): Promise<Respuesta<void>>
  archivarProducto(datos: { productoId: string; confirmado?: boolean }): Promise<Respuesta<void>>
  reactivarProducto(productoId: string): Promise<void>
  obtenerProducto(productoId: string): Promise<ProductoVista | null>
  buscarProductos(filtro: { texto: string; archivados?: boolean }): Promise<ProductoVista[]>
  listarCategorias(): Promise<CategoriaVista[]>
  crearCategoria(nombre: string): Promise<string>
  renombrarCategoria(categoriaId: string, nombre: string): Promise<void>
  eliminarCategoria(categoriaId: string): Promise<void>
  sembrarCategoriasIniciales(): Promise<void>
  guardarFoto(productoId: string, imagen: Blob): Promise<void>
  obtenerFoto(productoId: string): Promise<Blob | null>
  quitarFoto(productoId: string): Promise<void>
  consultable: CatalogoConsultable
  importacion: CatalogoParaImportacion
}

function aProductoResumido(p: ProductoRegistro, categoriaNombre: string): ProductoResumido {
  return {
    id: p.id,
    nombre: p.nombre,
    unidad: p.unidad,
    categoriaId: p.categoriaId,
    categoriaNombre,
    precioCompra: Dinero.deCentimos(p.precioCompra),
    precioVenta: Dinero.deCentimos(p.precioVenta),
    stockMinimo: Cantidad.deMilesimas(p.stockMinimo),
    activo: p.estado === 'ACTIVO',
    tieneFoto: p.tieneFoto,
  }
}

function crearConsultable(deps: DependenciasDeCatalogo): CatalogoConsultable {
  return {
    async producto(id) {
      const registro = await deps.productos.porId(id)
      if (!registro) return null
      const categoria = await deps.categorias.porId(registro.categoriaId)
      return aProductoResumido(registro, categoria?.nombre ?? '')
    },
    async productos(filtro) {
      const todos = await deps.productos.todos()
      const filtrados = filtro?.soloActivos ? todos.filter((p) => p.estado === 'ACTIVO') : todos
      const categorias = await deps.categorias.todas()
      const nombrePorCategoria = new Map(categorias.map((c) => [c.id, c.nombre]))
      return filtrados.map((p) => aProductoResumido(p, nombrePorCategoria.get(p.categoriaId) ?? ''))
    },
    async actualizarPrecioCompra(id, precio) {
      await actualizarPrecioCompra(id, precio, deps)
    },
  }
}

function crearImportacion(deps: DependenciasDeCatalogo): CatalogoParaImportacion {
  return {
    validarNuevo: (datos) => validarNuevo(datos, deps.productos),
    async crear(datos: DatosDeProductoNuevo): Promise<string> {
      const resultado = await crearProducto({ ...datos, confirmado: true }, deps)
      if (resultado.tipo === 'hecho') return resultado.valor.productoId
      if (resultado.tipo === 'reactivar') {
        throw new ErrorDeDominio('NOMBRE_DUPLICADO', 'Ya existe un producto con ese nombre')
      }
      // No debería ocurrir: confirmado siempre es true, así que RN-CAT-05 nunca pide confirmar.
      throw new ErrorDeDominio('ERROR_INESPERADO', resultado.mensaje)
    },
    categoriaPorNombre: (nombre) => categoriaPorNombre(deps.categorias, nombre),
    crearCategoria: (nombre) => crearCategoria(deps.categorias, deps.ids, deps.uow, nombre),
  }
}

/** Ensambla el módulo Catálogo a partir de sus dependencias (puertos y módulos lazy). */
export function crearModuloCatalogo(deps: DependenciasDeCatalogo): ModuloCatalogo {
  return {
    crearProducto: (datos) => crearProducto(datos, deps),
    editarProducto: (datos) => editarProducto(datos, deps),
    archivarProducto: (datos) => archivarProducto(datos, deps),
    reactivarProducto: (productoId) => reactivarProducto(productoId, deps),
    obtenerProducto: (productoId) => obtenerProducto(productoId, deps),
    buscarProductos: (filtro) => buscarProductos(filtro, deps),
    listarCategorias: () => listarCategorias(deps.categorias),
    crearCategoria: (nombre) => crearCategoria(deps.categorias, deps.ids, deps.uow, nombre),
    renombrarCategoria: (categoriaId, nombre) =>
      renombrarCategoria(deps.categorias, deps.uow, categoriaId, nombre),
    eliminarCategoria: (categoriaId) =>
      eliminarCategoria(deps.categorias, deps.productos, deps.uow, categoriaId),
    sembrarCategoriasIniciales: () =>
      sembrarCategoriasIniciales(deps.categorias, deps.ids, deps.uow),
    guardarFoto: (productoId, imagen) => guardarFoto(productoId, imagen, deps),
    obtenerFoto: (productoId) => obtenerFoto(productoId, deps),
    quitarFoto: (productoId) => quitarFoto(productoId, deps),
    consultable: crearConsultable(deps),
    importacion: crearImportacion(deps),
  }
}
