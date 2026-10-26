// API pública del módulo Análisis (Torre de control, RN-AN). Otros módulos y la composición
// solo importan desde aquí.

export { crearModuloAnalisis, type ModuloAnalisis } from './application/modulo'
export type {
  DependenciasDeAnalisis,
  RepositorioDeListaDeCompras,
  RepositorioDeResumenes,
} from './application/puertos'
export type { AlquilerEnControl, OpcionesDeTorre, TorreDeControl } from './application/torre'
export {
  BOTON_CONFIGURAR_ALQUILER,
  PREGUNTA_DEL_ALQUILER,
  type AvanceDelAlquiler,
} from './domain/alquiler'
export type { DetalleDeProducto, RespuestaNecesitoComprar } from './application/producto'
export type { QuitadoDeLista } from './application/lista-de-compras'
export type { LineaParaComprar, ListaParaComprar } from './domain/compras'
export type { CasoNecesitoComprar } from './domain/necesito-comprar'
export {
  MENSAJE_SIN_HISTORIA_SUFICIENTE,
  NOMBRES_DE_DIA,
  SIN_DATOS_DE_LA_SEMANA_ANTERIOR,
  SUGERENCIA_PARA_PARADOS,
  type ComparacionSemanal,
  type FilaComparacion,
  type FilaMasVendido,
  type MasVendidos,
  type MejorDia,
  type NombreDeDia,
  preciosParaRevisar,
  type PrecioParaRevisar,
  type ProductoEnAtencion,
  type ProductosEnAtencion,
  type ProductoParado,
  type ProductosParados,
} from './domain/observaciones'
export type { Periodo, ResumenDePeriodo } from './domain/periodos'
export {
  RepositorioDeListaDeComprasEnMemoria,
  RepositorioDeResumenesEnMemoria,
} from './infrastructure/memoria/repositorios'
export {
  RepositorioDeListaDeComprasDexie,
  RepositorioDeResumenesDexie,
} from './infrastructure/dexie/repositorios'

// Pantallas de Control (plan 13). El router las importa desde aquí (nunca un archivo interno del
// módulo) y cada una se carga recién al abrirla: queda en su propio trozo del build.
export const VistaControl = () => import('./ui/VistaControl.vue')
export const VistaAyudaInteligente = () => import('./ui/VistaAyudaInteligente.vue')
export const VistaParaComprar = () => import('./ui/VistaParaComprar.vue')
export const VistaNecesitoComprar = () => import('./ui/VistaNecesitoComprar.vue')
export const VistaAlquilerDelLocal = () => import('./ui/VistaAlquilerDelLocal.vue')
