export { crearModuloRespaldo, type ModuloRespaldo } from './application/modulo'
export { CONFIRMACIONES_PARA_RESTAURAR } from './application/copia'
export type { Previsualizacion } from './application/importar'
export type {
  AlmacenamientoPersistente,
  AlmacenDeRespaldo,
  ArchivoGenerado,
  CeldaDeExcel,
  DatosDelRespaldo,
  DependenciasDeRespaldo,
  GeneradorDeExcel,
  HojaDeExcel,
  LectorDeExcel,
  Reconstructor,
} from './application/puertos'
export type { ResumenDeCopia } from './domain/formato-de-respaldo'
export { AlmacenDeRespaldoEnMemoria } from './infrastructure/memoria/almacen-de-respaldo'
export { AlmacenDeRespaldoDexie } from './infrastructure/dexie/almacen-de-respaldo'
export {
  AlmacenamientoPersistenteEnMemoria,
  GeneradorDeExcelEnMemoria,
  LectorDeExcelEnMemoria,
} from './infrastructure/memoria/dobles'
export {
  GeneradorDeExcelDelNavegador,
  LectorDeExcelDelNavegador,
} from './infrastructure/navegador/excel'
export { AlmacenamientoPersistenteDelNavegador } from './infrastructure/navegador/almacenamiento'
export { base64ABlob, blobABase64 } from './infrastructure/navegador/imagenes'
