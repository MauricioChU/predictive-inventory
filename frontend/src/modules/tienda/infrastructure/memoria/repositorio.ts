import type { AlmacenEnMemoria } from '../../../../shared/infrastructure/memoria/almacen-en-memoria'
import type {
  ConfiguracionRegistro,
  EstadoDelSistemaRegistro,
} from '../../../../shared/contratos/registros'
import type { RepositorioDeConfiguracion } from '../../application/puertos'

export class RepositorioDeConfiguracionEnMemoria implements RepositorioDeConfiguracion {
  constructor(private readonly almacen: AlmacenEnMemoria) {}

  async negocio(): Promise<ConfiguracionRegistro | null> {
    const registro = this.almacen.obtener('configuracion', 'negocio')
    return (registro as ConfiguracionRegistro | undefined) ?? null
  }

  async guardarNegocio(registro: ConfiguracionRegistro): Promise<void> {
    this.almacen.guardar('configuracion', registro)
  }

  async sistema(): Promise<EstadoDelSistemaRegistro | null> {
    const registro = this.almacen.obtener('configuracion', 'sistema')
    return (registro as EstadoDelSistemaRegistro | undefined) ?? null
  }

  async guardarSistema(registro: EstadoDelSistemaRegistro): Promise<void> {
    this.almacen.guardar('configuracion', registro)
  }
}
