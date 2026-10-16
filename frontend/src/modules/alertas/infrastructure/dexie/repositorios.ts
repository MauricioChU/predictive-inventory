import type { AvisoRegistro } from '@/shared/contratos/registros'
import type { BaseDeDatos } from '@/shared/infrastructure/dexie/base-de-datos'
import type { RepositorioDeAvisos } from '../../application/puertos'

/** `RepositorioDeAvisos` sobre la tabla `avisos` (uno por producto, RN-AL-03/04). */
export class RepositorioDeAvisosDexie implements RepositorioDeAvisos {
  constructor(private readonly db: BaseDeDatos) {}

  todos(): Promise<AvisoRegistro[]> {
    return this.db.avisos.toArray()
  }

  async guardar(registro: AvisoRegistro): Promise<void> {
    await this.db.avisos.put(registro)
  }

  async eliminar(productoId: string): Promise<void> {
    await this.db.avisos.delete(productoId)
  }
}
