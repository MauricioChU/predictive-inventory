import type { RouteLocationRaw, RouteParamsRawGeneric } from 'vue-router'
import { useRouter } from 'vue-router'

/**
 * Enlaces POR NOMBRE a pantallas de otras ramas de la Ola 4 (contrato de rutas). Mientras una
 * de esas pantallas no esté registrada, vue-router lanzaría al resolver su nombre: en ese caso
 * el enlace lleva a Inicio, como lo haría el comodín con un camino desconocido.
 */
export function usarDestinos() {
  const router = useRouter()
  return (nombre: string, params?: RouteParamsRawGeneric): RouteLocationRaw =>
    router.hasRoute(nombre) ? { name: nombre, params } : { name: 'inicio' }
}
