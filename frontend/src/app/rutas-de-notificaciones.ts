import type { Router } from 'vue-router'

/** El mensaje que manda public/sw-notificaciones.js al tocar una notificación. */
interface MensajeAbrirRuta {
  tipo: 'abrir-ruta'
  url: string
}

function esMensajeAbrirRuta(datos: unknown): datos is MensajeAbrirRuta {
  return (
    typeof datos === 'object' &&
    datos !== null &&
    (datos as { tipo?: unknown }).tipo === 'abrir-ruta' &&
    typeof (datos as { url?: unknown }).url === 'string'
  )
}

/**
 * La ruta del router para una URL absoluta de la app (`/predictive-inventory/productos/x` →
 * `/productos/x`), o `null` si el mensaje no es de abrir una ruta o apunta fuera de la app.
 */
export function rutaDeLaApp(datos: unknown, base: string, origen: string): string | null {
  if (!esMensajeAbrirRuta(datos)) return null
  let url: URL
  try {
    url = new URL(datos.url, origen)
  } catch {
    return null
  }
  if (url.origin !== origen || !url.pathname.startsWith(base)) return null
  return `/${url.pathname.slice(base.length)}${url.search}${url.hash}`
}

/** Lo mínimo de `ServiceWorkerContainer` que se usa (para probarlo sin navegador). */
export interface ContenedorDeMensajes {
  addEventListener(tipo: 'message', manejador: (evento: MessageEvent) => void): void
  removeEventListener(tipo: 'message', manejador: (evento: MessageEvent) => void): void
}

/**
 * Ruling 5 (Ola 3): cuando el Service Worker enfoca una ventana abierta por el toque de una
 * notificación, esta navega a su pantalla con el router (sin recargar la app). Devuelve la
 * función para dejar de escuchar.
 */
export function escucharRutasDeNotificaciones(
  router: Pick<Router, 'push'>,
  contenedor: ContenedorDeMensajes | undefined = navigator.serviceWorker,
  base: string = import.meta.env.BASE_URL,
  origen: string = window.location.origin,
): () => void {
  if (!contenedor) return () => undefined
  const alRecibir = (evento: MessageEvent): void => {
    const ruta = rutaDeLaApp(evento.data, base, origen)
    if (!ruta) return
    router.push(ruta).catch((error: unknown) => {
      console.error('No se pudo abrir la pantalla de la notificación:', error)
    })
  }
  contenedor.addEventListener('message', alRecibir)
  return () => contenedor.removeEventListener('message', alRecibir)
}
