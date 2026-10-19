// Tocar una notificación abre su pantalla (spec 03 · RN-AL-07; Ola 3, ruling 5). Workbox lo
// carga con importScripts desde el Service Worker que genera vite-plugin-pwa (vite.config.ts).
//
// `data.url` es una ruta de la app ("/productos?estado=se-acaban", "/productos/<id>"): se resuelve
// contra el alcance del Service Worker (la base /predictive-inventory/), nunca contra la raíz
// del dominio. Si ya hay una ventana de la app abierta, se enfoca y se le pide que navegue (sin
// recargar: no se pierde lo que estaba haciendo); si no, se abre una nueva.

/** La URL absoluta de la pantalla, siempre dentro del alcance de la app. */
function destinoDeLaNotificacion(datos, alcance) {
  const ruta = datos && typeof datos.url === 'string' ? datos.url : ''
  try {
    const destino = new URL(ruta.replace(/^\/+/, ''), alcance)
    return destino.href.startsWith(alcance) ? destino.href : alcance
  } catch {
    return alcance
  }
}

async function abrirPantalla(datos) {
  const alcance = self.registration.scope
  const destino = destinoDeLaNotificacion(datos, alcance)
  // Solo las ventanas que controla este Service Worker: corren la app y escuchan el mensaje.
  const ventanas = await self.clients.matchAll({ type: 'window' })
  const abierta = ventanas.find((ventana) => ventana.url.startsWith(alcance))
  if (abierta) {
    try {
      const enfocada = (await abierta.focus()) ?? abierta
      enfocada.postMessage({ tipo: 'abrir-ruta', url: destino })
      return
    } catch {
      // No se pudo enfocar: se abre una ventana nueva.
    }
  }
  await self.clients.openWindow(destino)
}

self.addEventListener('notificationclick', (evento) => {
  evento.notification.close()
  evento.waitUntil(abrirPantalla(evento.notification.data))
})
