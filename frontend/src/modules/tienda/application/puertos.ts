import type { BusDeEventos } from '../../../shared/domain/eventos'
import type { GeneradorDeIds } from '../../../shared/domain/ids'
import type { UnidadDeTrabajo } from '../../../shared/application/unidad-de-trabajo'
import type {
  ConfiguracionRegistro,
  EstadoDelSistemaRegistro,
} from '../../../shared/contratos/registros'

/** Repositorio de la configuración del negocio y del estado técnico del sistema. */
export interface RepositorioDeConfiguracion {
  negocio(): Promise<ConfiguracionRegistro | null>
  guardarNegocio(registro: ConfiguracionRegistro): Promise<void>
  sistema(): Promise<EstadoDelSistemaRegistro | null>
  guardarSistema(registro: EstadoDelSistemaRegistro): Promise<void>
}

export interface DependenciasDeTienda {
  repositorio: RepositorioDeConfiguracion
  uow: UnidadDeTrabajo
  ids: GeneradorDeIds
  bus: BusDeEventos
}
