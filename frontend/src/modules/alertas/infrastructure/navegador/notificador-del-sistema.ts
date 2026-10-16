import type { Notificacion, Notificador } from '../../application/puertos'

const ICONO = `${import.meta.env.BASE_URL}pwa-192x192.png`
const INSIGNIA = `${import.meta.env.BASE_URL}pwa-64x64.png`

/** `renotify` es parte de la especificación de la Notification API, pero no está en
 * `lib.dom.d.ts` (ver notificationOptions en MDN). Reemplaza el aviso con el mismo `tag` en
 * vez de apilarlo en silencio, para que "3 productos se están acabando" siempre se vea. */
interface OpcionesDeNotificacion extends NotificationOptions {
  renotify?: boolean
}

/** jsdom (los tests) no implementa la Notification API: solo esta detección se prueba ahí
 * sin simular un navegador (el resto de `NotificadorDelSistema` se prueba con globals
 * inyectados, ver notificador-del-sistema.spec.ts). */
export function soportaNotificaciones(): boolean {
  return typeof Notification !== 'undefined'
}

/**
 * Notificador del sistema (RN-AL-06c). Usa el registro de Service Worker SI YA HAY UNO listo
 * (`ServiceWorkerContainer.getRegistration()`, que resuelve de inmediato con `undefined` si
 * ninguno está activo) y, si no, la API básica `new Notification(...)`.
 *
 * Fix round 1, hallazgo importante 1: ANTES se usaba `navigator.serviceWorker.ready`, que
 * nunca se resuelve si ningún Service Worker llega a activarse (en desarrollo, si el registro
 * falla, o en Playwright contra el servidor de desarrollo) — eso colgaba `mostrar()` para
 * siempre y, con él, a quien publicó el evento que disparó la evaluación de avisos. Por eso
 * ahora se usa `getRegistration()` (nunca cuelga) y todo el cuerpo va en un `try/catch`: en
 * Chrome para Android, `new Notification(...)` lanza "Illegal constructor" (solo permite
 * notificaciones vía Service Worker), así que `mostrar()` jamás debe lanzar ni colgarse.
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
    const opciones: OpcionesDeNotificacion = {
      body: notificacion.texto,
      data: { url: notificacion.url },
      icon: ICONO,
      badge: INSIGNIA,
      tag: notificacion.url,
      renotify: true,
    }
    try {
      const registro = await navigator.serviceWorker?.getRegistration?.()
      if (registro) {
        await registro.showNotification('Inventario', opciones)
        return
      }
      new Notification('Inventario', opciones)
    } catch (error) {
      console.error('No se pudo mostrar la notificación del sistema:', error)
    }
  }
}
