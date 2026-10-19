import type { LocationQueryRaw, RouteLocationRaw, Router } from 'vue-router'

/**
 * Contrato de rutas entre las ramas de pantallas de la Ola 4 (ola-4-comun.md): las de otras
 * ramas se enlazan POR NOMBRE. Mientras una todavía no esté registrada, enlazarla por nombre
 * haría fallar la navegación; en ese caso se usa su camino, que el comodín lleva a Inicio.
 */
const CAMINOS = {
  vender: '/vender',
  recibir: '/recibir',
  historial: '/historial',
  'contar-todo': '/contar',
  'producto-nuevo': '/productos/nuevo',
  categorias: '/productos/categorias',
  'necesito-comprar': '/control/necesito-comprar',
} as const

export type PantallaDeOtraRama = keyof typeof CAMINOS

/** Con `query` (p. ej. `{ desde: 'primera-vez' }`, ver el contrato), igual por nombre o camino. */
export function haciaPantalla(
  router: Router,
  nombre: PantallaDeOtraRama,
  query?: LocationQueryRaw,
): RouteLocationRaw {
  const destino = router.hasRoute(nombre) ? { name: nombre } : { path: CAMINOS[nombre] }
  return query ? { ...destino, query } : destino
}
