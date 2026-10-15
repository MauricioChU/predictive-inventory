import type { AvisoRegistro } from '@/shared/contratos/registros'

/** Guarda, por producto, el último estado de stock que ya generó un aviso (RN-AL-03/04). */
export interface RepositorioDeAvisos {
  todos(): Promise<AvisoRegistro[]>
  guardar(registro: AvisoRegistro): Promise<void>
  eliminar(productoId: string): Promise<void>
}

/** Lo que de verdad se le muestra a la persona: texto y adónde lleva al tocarla. */
export interface Notificacion {
  texto: string
  url: string
}

/** Puerto hacia el canal de notificaciones del sistema (RN-AL-06c, RN-AL-08). */
export interface Notificador {
  /** Permiso del navegador concedido. */
  permitido(): Promise<boolean>
  solicitarPermiso(): Promise<boolean>
  mostrar(notificacion: Notificacion): Promise<void>
}
