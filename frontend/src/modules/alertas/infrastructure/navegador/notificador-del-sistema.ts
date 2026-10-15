import type { Notificacion, Notificador } from '../../application/puertos'

const ICONO = `${import.meta.env.BASE_URL}pwa-192x192.png`
const INSIGNIA = `${import.meta.env.BASE_URL}pwa-64x64.png`

/** jsdom (los tests) no implementa la Notification API: solo esta detección se prueba ahí. */
export function soportaNotificaciones(): boolean {
  return typeof Notification !== 'undefined'
}

/**
 * Notificador del sistema (RN-AL-06c): usa el Service Worker si hay uno registrado
 * (`registration.showNotification`, con `tag` = url para no duplicar), y si no, la API básica
 * `new Notification(...)`. Sin soporte del navegador, se comporta como si no hubiera permiso.
 */
export class NotificadorDelSistema implements Notificador {
  async permitido(): Promise<boolean> {
    return soportaNotificaciones() && Notification.permission === 'granted'
  }

  async solicitarPermiso(): Promise<boolean> {
    if (!soportaNotificaciones()) return false
    const permiso = await Notification.requestPermission()
    return permiso === 'granted'
  }

  async mostrar(notificacion: Notificacion): Promise<void> {
    if (!soportaNotificaciones()) return
    const opciones: NotificationOptions = {
      body: notificacion.texto,
      data: { url: notificacion.url },
      icon: ICONO,
      badge: INSIGNIA,
      tag: notificacion.url,
    }
    if (typeof navigator !== 'undefined' && navigator.serviceWorker) {
      const registro = await navigator.serviceWorker.ready
      await registro.showNotification('Inventario', opciones)
      return
    }
    new Notification('Inventario', opciones)
  }
}
