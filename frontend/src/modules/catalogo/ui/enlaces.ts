import type { RouteLocationRaw, Router } from 'vue-router'

/**
 * Contrato de rutas de la Ola 4: las pantallas de otras ramas se enlazan POR NOMBRE. Mientras
 * esa rama no llegue, su ruta no existe (y un `push` por nombre fallaría): se va a Inicio,
 * igual que el comodín del router con un camino desconocido.
 */
export function aPantalla(
  router: Pick<Router, 'hasRoute'>,
  nombre: string,
  params: Record<string, string> = {},
): RouteLocationRaw {
  return router.hasRoute(nombre) ? { name: nombre, params } : { path: '/' }
}
