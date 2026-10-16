import type {
  ConfiguracionRegistro,
  EstadoDelSistemaRegistro,
} from '../../../../shared/contratos/registros'
import type { BaseDeDatos } from '../../../../shared/infrastructure/dexie/base-de-datos'
import type { RepositorioDeConfiguracion } from '../../application/puertos'

/**
 * Configuración del negocio y estado del sistema: dos filas de la tabla `configuracion`, con
 * claves 'negocio' y 'sistema'.
 */
export class RepositorioDeConfiguracionDexie implements RepositorioDeConfiguracion {
  constructor(private readonly db: BaseDeDatos) {}

  async negocio(): Promise<ConfiguracionRegistro | null> {
    const registro = await this.db.configuracion.get('negocio')
    return (registro as ConfiguracionRegistro | undefined) ?? null
  }

  async guardarNegocio(registro: ConfiguracionRegistro): Promise<void> {
    await this.db.configuracion.put(registro)
  }

  async sistema(): Promise<EstadoDelSistemaRegistro | null> {
    const registro = await this.db.configuracion.get('sistema')
    return (registro as EstadoDelSistemaRegistro | undefined) ?? null
  }

  async guardarSistema(registro: EstadoDelSistemaRegistro): Promise<void> {
    await this.db.configuracion.put(registro)
  }
}
