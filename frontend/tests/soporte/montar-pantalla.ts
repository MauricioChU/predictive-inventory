import { simularDialogos } from '@/shared/ui/__tests__/dialogo-en-jsdom'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia, type Pinia } from 'pinia'
import { defineComponent, h } from 'vue'
import { createMemoryHistory, createRouter, RouterView, type Router } from 'vue-router'
import { abrirApp } from '@/app/abrir-app'
import { CLAVE_AVISO_DESHACER, crearContextoAvisoDeshacer } from '@/app/aviso-deshacer'
import { useEstadoGlobal } from '@/app/estado-global'
import { proveerAplicacion } from '@/app/proveer-aplicacion'
import { rutas } from '@/router'
import { instalarGuardiaDeLaPrimeraVez } from '@/router/primera-vez'
import { CLAVE_ANUNCIADOR, crearAnunciador, type Anunciador } from '@/shared/ui/anunciador'
import type { AplicacionDePrueba } from './aplicacion-de-prueba'

/**
 * Plan 14: pantallas de otras ramas de la Ola 4 (contrato de rutas de ola-4-comun.md). Mientras
 * no lleguen a develop no están en `rutas`; aquí se registran vacías para poder afirmar que una
 * pantalla navega a ellas POR NOMBRE. Si ya existen, se usan las reales.
 */
const PANTALLAS_DE_OTRAS_RAMAS: Record<string, string> = {
  vender: '/vender',
  recibir: '/recibir',
  historial: '/historial',
  'contar-todo': '/contar',
  productos: '/productos',
  'producto-nuevo': '/productos/nuevo',
  categorias: '/productos/categorias',
  control: '/control',
  'para-comprar': '/control/para-comprar',
  'necesito-comprar': '/control/necesito-comprar',
}

const Vacia = defineComponent({ render: () => h('h1', 'Otra pantalla') })

/** Navegaciones pedidas (también por RouterLink): `esperarPantalla` espera que terminen. */
let navegaciones: Promise<unknown>[] = []

/**
 * El router real (las rutas de las cuatro ramas), con historia en memoria. Recuerda cada
 * navegación: una pantalla que se carga al navegar puede tardar más que unas vueltas del bucle.
 */
export function crearRouterDePrueba(): Router {
  const router = createRouter({ history: createMemoryHistory(), routes: rutas })
  // Como el router de la app: la primera vez es obligatoria (RN-UX-16).
  instalarGuardiaDeLaPrimeraVez(router)
  for (const [name, path] of Object.entries(PANTALLAS_DE_OTRAS_RAMAS)) {
    if (!router.hasRoute(name)) router.addRoute({ path, name, component: Vacia })
  }
  for (const metodo of ['push', 'replace'] as const) {
    const original = router[metodo].bind(router)
    router[metodo] = (destino) => {
      const navegacion = original(destino)
      navegaciones.push(navegacion)
      return navegacion
    }
  }
  return router
}

export interface PantallaMontada {
  wrapper: VueWrapper
  router: Router
  pinia: Pinia
  anunciador: Anunciador
  estadoGlobal: ReturnType<typeof useEstadoGlobal>
  /** Lo que se anunció por la región aria-live (espera la ventana del anunciador). */
  anunciado(): Promise<string>
}

/**
 * Monta la app como main.ts (abrirApp → estado global conectado → router → `useAplicacion`) y
 * navega a `ruta`. Para probar pantallas con la aplicación de prueba real.
 */
export async function montarPantalla(
  app: AplicacionDePrueba,
  ruta: string,
): Promise<PantallaMontada> {
  // Cualquier pantalla puede llevar a otra con DialogoConfirmacion (p. ej. Primera vez → el
  // formulario de Productos): <dialog> simulado siempre, no solo en las specs que lo piden.
  simularDialogos()
  const pinia = createPinia()
  setActivePinia(pinia)
  const inicio = await abrirApp(app, { aplicarTamanoDeLetra: () => undefined })
  const estadoGlobal = useEstadoGlobal(pinia)
  estadoGlobal.conectar(app, inicio)

  navegaciones = []
  const router = crearRouterDePrueba()
  const anunciador = crearAnunciador()
  const Raiz = defineComponent({ render: () => h(RouterView) })
  const wrapper = mount(Raiz, {
    attachTo: document.body,
    global: {
      plugins: [pinia, router, proveerAplicacion(app)],
      provide: {
        [CLAVE_ANUNCIADOR as symbol]: anunciador,
        [CLAVE_AVISO_DESHACER as symbol]: crearContextoAvisoDeshacer(anunciador),
      },
    },
  })
  await router.push(ruta)
  await router.isReady()
  await esperarPantalla()

  return {
    wrapper,
    router,
    pinia,
    anunciador,
    estadoGlobal,
    async anunciado() {
      await new Promise((resolver) => setTimeout(resolver, 200))
      return anunciador.texto.value
    },
  }
}

/**
 * Espera las navegaciones pedidas y deja correr las promesas de la pantalla (lecturas de los
 * casos de uso) y sus re-render.
 */
export async function esperarPantalla(): Promise<void> {
  for (let i = 0; i < 5; i += 1) {
    while (navegaciones.length > 0) await Promise.allSettled(navegaciones.splice(0))
    await flushPromises()
    await new Promise((resolver) => setTimeout(resolver, 0))
  }
}

/** El doble de <dialog> de todas las pruebas (uno solo: src/shared/ui/__tests__/dialogo-en-jsdom). */
export { simularDialogos }
