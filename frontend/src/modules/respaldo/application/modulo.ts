import type { ResumenDeCopia } from '../domain/formato-de-respaldo'
import type { HojaDeExcel } from '../domain/hojas-de-excel'
import {
  CONFIRMACIONES_PARA_RESTAURAR,
  guardarCopia,
  marcarCopiaGuardada,
  prepararRestauracion,
  restaurarCopia,
} from './copia'
import { descargarPlantilla, exportarExcel } from './excel'
import { confirmarImportacion, previsualizarImportacion, type Previsualizacion } from './importar'
import type { ArchivoGenerado, DependenciasDeRespaldo } from './puertos'
import { recordatorioDeCopia, solicitarAlmacenamientoSiHaceFalta } from './sistema'

export type { Previsualizacion }

export interface ModuloRespaldo {
  guardarCopia(): Promise<ArchivoGenerado>
  /** La interfaz lo llama cuando la copia ya se descargó o compartió (RN-RE-06). */
  marcarCopiaGuardada(): Promise<void>
  prepararRestauracion(
    texto: string,
  ): Promise<{ resumen: ResumenDeCopia; confirmaciones: readonly [string, string] }>
  restaurarCopia(texto: string, d: { confirmaciones: number }): Promise<void>
  exportarExcel(): Promise<ArchivoGenerado & { hojas: HojaDeExcel[] }>
  descargarPlantilla(): Promise<ArchivoGenerado & { hojas: HojaDeExcel[] }>
  previsualizarImportacion(archivo: Blob): Promise<Previsualizacion>
  confirmarImportacion(p: Previsualizacion): Promise<{ importados: number }>
  recordatorioDeCopia(): Promise<string | null>
  solicitarAlmacenamientoSiHaceFalta(): Promise<void>
}

export function crearModuloRespaldo(dependencias: DependenciasDeRespaldo): ModuloRespaldo {
  return {
    guardarCopia: () => guardarCopia(dependencias),
    marcarCopiaGuardada: () => marcarCopiaGuardada(dependencias),
    prepararRestauracion: (texto) => prepararRestauracion(dependencias, texto),
    restaurarCopia: (texto, d) => restaurarCopia(dependencias, texto, d),
    exportarExcel: () => exportarExcel(dependencias),
    descargarPlantilla: () => descargarPlantilla(dependencias),
    previsualizarImportacion: (archivo) => previsualizarImportacion(dependencias, archivo),
    confirmarImportacion: (p) => confirmarImportacion(dependencias, p),
    recordatorioDeCopia: () => recordatorioDeCopia(dependencias),
    solicitarAlmacenamientoSiHaceFalta: () => solicitarAlmacenamientoSiHaceFalta(dependencias),
  }
}

export { CONFIRMACIONES_PARA_RESTAURAR }
