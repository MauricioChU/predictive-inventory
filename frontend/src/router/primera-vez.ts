import { getActivePinia } from 'pinia'
import type { RouteRecordNameGeneric, Router } from 'vue-router'
import { useEstadoGlobal } from '@/app/estado-global'

/**
 * Falta la primera vez (nombre y letra)? Lo dice el estado global. Sin Pinia activa (un router de
 * pruebas sin la app montada) no hay estado que mirar y no se redirige.
 */
export function faltaLaPrimeraVez(): boolean {
  return getActivePinia() !== undefined && useEstadoGlobal().primeraVez
}

/**
 * RN-UX-16: lo único que se puede abrir mientras falta la primera vez. La bienvenida y sus pasos;
 * *Restaurar copia* (RN-RE-10); y las dos formas de cargar productos del paso 4 (*Uno por uno* y
 * *Desde Excel*). Todo lo demás vuelve a la bienvenida.
 */
export const PERMITIDAS_EN_LA_PRIMERA_VEZ: readonly RouteRecordNameGeneric[] = [
  'primera-vez',
  'restaurar-copia',
  'producto-nuevo',
  'importar-productos',
]

/**
 * La primera vez es obligatoria (RN-UX-16): una sola guardia global, en vez de una por ruta, para
 * que ninguna pantalla nueva (ni una dirección escrita a mano, ni una ruta que no existe) sea una
 * salida. Decide con el estado global, que `main.ts` conecta antes de que corra la primera
 * navegación (esta empieza en una microtarea, después de `app.use(router)`).
 */
export function instalarGuardiaDeLaPrimeraVez(router: Router): void {
  router.beforeEach((to) => {
    if (!faltaLaPrimeraVez()) return true
    if (to.name !== undefined && PERMITIDAS_EN_LA_PRIMERA_VEZ.includes(to.name)) return true
    return { name: 'primera-vez' }
  })
}
