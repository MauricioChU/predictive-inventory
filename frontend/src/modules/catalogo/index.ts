export { crearModuloCatalogo } from './application/modulo'
export type {
  CategoriaVista,
  DatosDeEdicion,
  DependenciasDeCatalogo,
  ModuloCatalogo,
  ProductoVista,
} from './application/modulo'
export type {
  ProcesadorDeFotos,
  RepositorioDeCategorias,
  RepositorioDeFotos,
  RepositorioDeProductos,
} from './application/puertos'
export {
  RepositorioDeCategoriasEnMemoria,
  RepositorioDeFotosEnMemoria,
  RepositorioDeProductosEnMemoria,
} from './infrastructure/memoria/repositorios'
export {
  RepositorioDeCategoriasDexie,
  RepositorioDeFotosDexie,
  RepositorioDeProductosDexie,
} from './infrastructure/dexie/repositorios'
export { ProcesadorDeFotosCanvas } from './infrastructure/navegador/procesador-de-fotos-canvas'

// Ola 4, plan 11: pantallas de Productos, cargadas solo al abrirlas (src/router/rutas/productos.ts).
export const VistaProductos = () => import('./ui/VistaProductos.vue')
export const VistaDetalleProducto = () => import('./ui/VistaDetalleProducto.vue')
