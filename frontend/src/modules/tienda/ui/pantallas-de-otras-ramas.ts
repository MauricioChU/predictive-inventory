import type { RouteLocationRaw, Router } from 'vue-router'

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
  'para-comprar': '/control/para-comprar',
  'necesito-comprar': '/control/necesito-comprar',
} as const

export type PantallaDeOtraRama = keyof typeof CAMINOS

export function haciaPantalla(router: Router, nombre: PantallaDeOtraRama): RouteLocationRaw {
  return router.hasRoute(nombre) ? { name: nombre } : CAMINOS[nombre]
}
