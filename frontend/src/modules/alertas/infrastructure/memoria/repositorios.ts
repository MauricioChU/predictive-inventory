import type { AvisoRegistro } from '@/shared/contratos/registros'
import type { AlmacenEnMemoria } from '@/shared/infrastructure/memoria/almacen-en-memoria'
import type { Notificacion, Notificador, RepositorioDeAvisos } from '../../application/puertos'

/** `RepositorioDeAvisos` sobre `AlmacenEnMemoria` (tabla `avisos`). Para pruebas y para la
 * composición de pruebas; la app real usa Dexie (Ola 3). */
export class RepositorioDeAvisosEnMemoria implements RepositorioDeAvisos {
  constructor(private readonly almacen: AlmacenEnMemoria) {}

  async todos(): Promise<AvisoRegistro[]> {
    return this.almacen.todos('avisos')
  }

  async guardar(registro: AvisoRegistro): Promise<void> {
    this.almacen.guardar('avisos', registro)
  }

  async eliminar(productoId: string): Promise<void> {
    this.almacen.eliminar('avisos', productoId)
  }
}

/** Doble de prueba de `Notificador`: nunca toca el navegador. Expone su estado interno
 * (`permiso`, `solicitudes`, `mostradas`) para que los tests lo inspeccionen directamente. */
export class NotificadorEnMemoria implements Notificador {
  permiso = true
  solicitudes = 0
  mostradas: Notificacion[] = []

  async permitido(): Promise<boolean> {
    return this.permiso
  }

  async solicitarPermiso(): Promise<boolean> {
    this.solicitudes++
    return this.permiso
  }

  async mostrar(notificacion: Notificacion): Promise<void> {
    this.mostradas.push(notificacion)
  }
}
