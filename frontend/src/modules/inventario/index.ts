// API pública del módulo Inventario (RN-OP). Otros módulos y la composición solo entran por aquí.
export { crearModuloInventario } from './application/modulo'
export type {
  DatosDeAnulacion,
  DatosDeConteo,
  DatosDeIngreso,
  DatosDeMerma,
  DatosDeVenta,
  DependenciasDeInventario,
  EstadoDelConteo,
  FiltroDeHistorial,
  LineaDeOperacionVista,
  LineaPedida,
  ModuloInventario,
  OperacionVista,
  RespuestaDeConteo,
  RespuestaDeIngreso,
  ResultadoDeRevision,
} from './application/modulo'
export type {
  RepositorioDeConteo,
  RepositorioDeExistencias,
  RepositorioDeOperaciones,
} from './application/puertos'
export { SEGUNDOS_PARA_DESHACER, ServicioDeDeshacer } from './application/deshacer'
export { OPCIONES_DE_SOBRECOMPRA } from './application/ingresos'

export { Carrito } from './domain/carrito'
export type { LineaDelCarrito, ProductoEnCarrito } from './domain/carrito'
export { BILLETES_RAPIDOS, calcularVuelto } from './domain/vuelto'
export type { ResultadoDelVuelto } from './domain/vuelto'
export { etiquetaDeOperacion } from './domain/etiquetas'

export {
  RepositorioDeConteoEnMemoria,
  RepositorioDeExistenciasEnMemoria,
  RepositorioDeOperacionesEnMemoria,
} from './infrastructure/memoria/repositorios'
export {
  RepositorioDeConteoDexie,
  RepositorioDeExistenciasDexie,
  RepositorioDeOperacionesDexie,
} from './infrastructure/dexie/repositorios'

// Ola 4, plan 12: pantallas de operaciones, cargadas recién al abrirlas (cada una es su chunk).
export const VistaVender = () => import('./ui/VistaVender.vue')
export const VistaRecibir = () => import('./ui/VistaRecibir.vue')
