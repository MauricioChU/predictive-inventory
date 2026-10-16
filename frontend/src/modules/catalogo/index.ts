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
