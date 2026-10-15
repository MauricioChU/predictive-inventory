import type { Cantidad, Unidad } from '@/shared/domain/cantidad'
import type { Dinero } from '@/shared/domain/dinero'
import type { BusDeEventos } from '@/shared/domain/eventos'
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
} from '@/shared/contratos/entre-modulos'
import type {
  ProcesadorDeFotos,
  RepositorioDeCategorias,
  RepositorioDeFotos,
  RepositorioDeProductos,
} from './puertos'

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
