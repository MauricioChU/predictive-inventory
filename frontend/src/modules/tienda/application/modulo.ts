import type { ConfiguracionDeNegocio, TamanoDeLetra } from '../../../shared/contratos/configuracion'
import type { TiendaConsultable } from '../../../shared/contratos/entre-modulos'
import {
  actualizarConfiguracion,
  actualizarEstadoDelSistema,
  completarPrimeraVez,
  estadoDelSistema,
  obtenerConfiguracion,
} from './casos'
import type { DependenciasDeTienda } from './puertos'

export interface ModuloTienda {
  obtenerConfiguracion(): Promise<ConfiguracionDeNegocio>
  /** Publica `ConfiguracionActualizada` después de confirmar (la unidad de trabajo más externa). */
  actualizarConfiguracion(cambios: Partial<ConfiguracionDeNegocio>): Promise<void>
  completarPrimeraVez(d: { nombreTienda: string; tamanoDeLetra: TamanoDeLetra }): Promise<void>
  consultable: TiendaConsultable
}

export function crearModuloTienda(dependencias: DependenciasDeTienda): ModuloTienda {
  return {
    obtenerConfiguracion: () => obtenerConfiguracion(dependencias),
    actualizarConfiguracion: (cambios) => actualizarConfiguracion(dependencias, cambios),
    completarPrimeraVez: (datos) => completarPrimeraVez(dependencias, datos),
    consultable: {
      configuracion: () => obtenerConfiguracion(dependencias),
      estadoDelSistema: () => estadoDelSistema(dependencias),
      actualizarEstadoDelSistema: (cambios) => actualizarEstadoDelSistema(dependencias, cambios),
    },
  }
}
