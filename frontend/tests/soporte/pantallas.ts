import { flushPromises, mount, type DOMWrapper, type VueWrapper } from '@vue/test-utils'
import { createPinia } from 'pinia'
import { vi } from 'vitest'
import { createMemoryHistory, createRouter, type Router } from 'vue-router'
import LayoutApp from '@/app/LayoutApp.vue'
import { proveerAplicacion } from '@/app/proveer-aplicacion'
import { rutas } from '@/router'
import { prepararDialogos } from '@/shared/ui/__tests__/dialogo-en-jsdom'
import { instanteLocal, type Instante } from '@/shared/domain/fecha'
import { crearAplicacionDePrueba, type AplicacionDePrueba } from './aplicacion-de-prueba'

/** "Dado que hoy es 2026-10-15 10:00" (como en los `.feature`). */
export const HOY = instanteLocal('2026-10-15 10:00')

export interface PantallaMontada {
  w: VueWrapper
  app: AplicacionDePrueba
  router: Router
  /** Navega como lo haría un enlace y espera a que la pantalla nueva cargue sus datos. */
  ir(ruta: string): Promise<void>
}

/**
 * Pantallas de la Ola 4 de punta a punta: la app de prueba real (casos de uso en memoria), el
 * LayoutApp de verdad (aviso Deshacer, anunciador, navegación) y las rutas reales, en `ruta`.
 *
 * Las pantallas leen "hoy" del reloj del navegador (`new Date()`), como la app: aquí se fija
 * en el mismo instante que el reloj de la aplicación de prueba (solo `Date`; los temporizadores
 * siguen siendo reales). Quien lo llama desmonta con `w.unmount()` y vuelve a los relojes reales
 * con `vi.useRealTimers()` (ver `desmontar`).
 */
export async function montarPantalla(
  ruta: string,
  opciones: { app?: AplicacionDePrueba; ahora?: Instante } = {},
): Promise<PantallaMontada> {
  prepararDialogos()
  const ahora = opciones.ahora ?? HOY
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(ahora))
  const app = opciones.app ?? crearAplicacionDePrueba({ ahora })
  const router = createRouter({ history: createMemoryHistory(), routes: rutas })
  await router.push(ruta)
  await router.isReady()
  const w = mount(LayoutApp, {
    global: { plugins: [createPinia(), router, proveerAplicacion(app)] },
    attachTo: document.body,
  })
  await esperarDatos(app)
  return {
    w,
    app,
    router,
    async ir(destino) {
      await router.push(destino)
      await esperarDatos(app)
    },
  }
}

/** Deja correr los casos de uso pendientes y los re-renderizados que provocan. */
export async function esperarDatos(app: AplicacionDePrueba): Promise<void> {
  for (let i = 0; i < 5; i += 1) {
    await flushPromises()
    await app.esperarTareasPendientes()
  }
  await flushPromises()
}

export function desmontar(pantalla: PantallaMontada | undefined): void {
  pantalla?.w.unmount()
  vi.useRealTimers()
  document.body.innerHTML = ''
}

/** El botón (o enlace) cuyo texto visible es `texto`, dentro de `w`. Falla si no está. */
export function boton(w: Pick<DOMWrapper<Element>, 'findAll'>, texto: string) {
  const candidatos = w.findAll('button, a').filter((b) => b.text().trim() === texto)
  if (candidatos.length === 0) {
    const vistos = w.findAll('button, a').map((b) => `"${b.text().trim()}"`)
    throw new Error(`No hay un botón "${texto}". Hay: ${vistos.join(', ')}`)
  }
  return candidatos[0]!
}

/** Escribe en el BuscadorGrande y lo envía con Enter (sin esperar la pausa de escritura). */
export async function buscar(pantalla: PantallaMontada, texto: string): Promise<void> {
  const campo = pantalla.w.get('.buscador-grande input')
  await campo.setValue(texto)
  await campo.trigger('keydown', { key: 'Enter' })
  await esperarDatos(pantalla.app)
}

/**
 * El texto de un elemento con los espacios duros como espacios normales: las pantallas no dejan
 * partir "S/ 2.60" ni "9 kg" (pegarCifras), pero las pruebas comparan con el texto de la spec.
 */
export function leer(elemento: { text(): string }): string {
  return elemento.text().replace(/\u00a0/g, ' ')
}
