import type { LocationQueryRaw, RouteLocationRaw, Router } from 'vue-router'

/**
 * Contrato de rutas de la Ola 4: las pantallas de otras ramas se enlazan POR NOMBRE. Mientras
 * esa rama no llegue, su ruta no existe (y un `push` por nombre fallaría): se va a Inicio,
 * igual que el comodín del router con un camino desconocido. En desarrollo lo avisa en la
 * consola: así un nombre mal escrito no se confunde con una ruta que todavía no llegó.
 */
export function aPantalla(
  router: Pick<Router, 'hasRoute'>,
  nombre: string,
  params: Record<string, string> = {},
  query?: LocationQueryRaw,
): RouteLocationRaw {
  if (router.hasRoute(nombre)) return { name: nombre, params, ...(query ? { query } : {}) }
  if (import.meta.env.DEV) {
    console.warn(`No existe la ruta "${nombre}" (¿todavía no llegó su rama?): se va a Inicio.`)
  }
  return { path: '/' }
}
