// API pública del módulo Análisis (Torre de control, RN-AN). Otros módulos y la composición
// solo importan desde aquí.

export { crearModuloAnalisis, type ModuloAnalisis } from './application/modulo'
export type {
  DependenciasDeAnalisis,
  RepositorioDeListaDeCompras,
  RepositorioDeResumenes,
} from './application/puertos'
export type { OpcionesDeTorre, TorreDeControl } from './application/torre'
export type { DetalleDeProducto, RespuestaNecesitoComprar } from './application/producto'
export type { LineaParaComprar, ListaParaComprar } from './domain/compras'
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
  type PrecioParaRevisar,
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
