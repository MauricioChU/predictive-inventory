import type { RouteLocationNormalized } from 'vue-router'

/**
 * Hacia dónde se mueve la vista al navegar (animación de cambio de pantalla, patrones.md).
 * - `adelante`: la vista nueva entra desde la derecha y la vieja sale a la izquierda.
 * - `atras`: al revés.
 * - `fundido`: sin orden claro (hermanas de la misma profundidad): solo se funde.
 */
export type DireccionDeVista = 'adelante' | 'atras' | 'fundido'

/** Orden de la navegación fija (RN-UX-12): primer segmento de la ruta de cada pestaña. */
const PESTANAS = ['', 'vender', 'recibir', 'productos', 'control'] as const

function segmentos(ruta: RouteLocationNormalized): string[] {
  return ruta.path.split('/').filter(Boolean)
}

/** Posición de la pestaña si la ruta ES una pestaña (no una pantalla que se abre desde ella). */
function posicionDePestana(ruta: RouteLocationNormalized): number | undefined {
  const partes = segmentos(ruta)
  if (partes.length > 1) return undefined
  const indice = PESTANAS.indexOf((partes[0] ?? '') as (typeof PESTANAS)[number])
  return indice === -1 ? undefined : indice
}

/**
 * Cuántas pantallas "hacia adentro" está la ruta: 0 en las pestañas; /ajustes, /historial y
 * /productos/:id valen 1; /ajustes/tienda y /productos/:id/editar valen 2.
 */
export function profundidadDeRuta(ruta: RouteLocationNormalized): number {
  if (posicionDePestana(ruta) !== undefined) return 0
  const partes = segmentos(ruta)
  const cuelgaDeUnaPestana = PESTANAS.includes(partes[0] as (typeof PESTANAS)[number])
  return partes.length - (cuelgaDeUnaPestana ? 1 : 0)
}

export function direccionDeVista(
  hacia: RouteLocationNormalized,
  desde: RouteLocationNormalized,
): DireccionDeVista {
  const prof = profundidadDeRuta(hacia) - profundidadDeRuta(desde)
  if (prof !== 0) return prof > 0 ? 'adelante' : 'atras'
  const aPestana = posicionDePestana(hacia)
  const dePestana = posicionDePestana(desde)
  if (aPestana === undefined || dePestana === undefined || aPestana === dePestana) return 'fundido'
  return aPestana > dePestana ? 'adelante' : 'atras'
}
