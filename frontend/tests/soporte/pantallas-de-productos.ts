import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia } from 'pinia'
import { defineComponent, h } from 'vue'
import { createMemoryHistory, createRouter, RouterView, type Router } from 'vue-router'
import {
  CLAVE_AVISO_DESHACER,
  crearContextoAvisoDeshacer,
  type ContextoAvisoDeshacer,
} from '@/app/aviso-deshacer'
import { CLAVE_APLICACION } from '@/app/proveer-aplicacion'
import { rutasDeProductos } from '@/router/rutas/productos'
import { instanteLocal } from '@/shared/domain/fecha'
import { CLAVE_ANUNCIADOR, crearAnunciador, type Anunciador } from '@/shared/ui/anunciador'
import { crearAplicacionDePrueba, type AplicacionDePrueba } from './aplicacion-de-prueba'
import { crearProductoDePrueba, type ProductoDePrueba } from './productos-de-prueba'

/** "Hoy" de las pruebas de pantallas de Productos (el reloj de la app y el del celular). */
export const HOY = instanteLocal('2026-10-16 10:00')

/**
 * jsdom no implementa `showModal`/`close` de <dialog> (DialogoConfirmacion los usa): un doble
 * mínimo que solo pone y quita el atributo `open`.
 */
export function simularDialogos(): void {
  const prototipo = HTMLDialogElement.prototype
  prototipo.showModal ??= function (this: HTMLDialogElement) {
    this.setAttribute('open', '')
  }
  prototipo.close ??= function (this: HTMLDialogElement) {
    this.removeAttribute('open')
  }
}

const Otra = defineComponent({
  props: { titulo: { type: String, default: '' } },
  setup: (props) => () => h('h1', props.titulo),
})

/** Las rutas de otras ramas que estas pantallas enlazan (contrato de rutas de la Ola 4). */
const RUTAS_DE_OTRAS_RAMAS = [
  { path: '/', name: 'inicio', component: Otra, props: { titulo: 'Inicio' } },
  { path: '/productos/:id/merma', name: 'merma', component: Otra, props: { titulo: 'Merma' } },
  {
    path: '/productos/:id/contar',
    name: 'contar-stock',
    component: Otra,
    props: { titulo: 'Contar stock' },
  },
]

export interface VistaMontada {
  wrapper: VueWrapper
  router: Router
  aviso: ContextoAvisoDeshacer
  anunciador: Anunciador
}

/**
 * Monta la app de pantallas de Productos (las rutas reales de `rutas/productos.ts`) en `ruta`,
 * con la aplicación de prueba como `useAplicacion()`, el aviso Deshacer y el anunciador que
 * provee LayoutApp. `conOtrasRamas: false` deja afuera las rutas de otras ramas (como en
 * develop mientras no llegan).
 */
export async function montarVista(
  app: AplicacionDePrueba,
  ruta: string,
  opciones: { conOtrasRamas?: boolean } = {},
): Promise<VistaMontada> {
  simularDialogos()
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      ...rutasDeProductos,
      ...(opciones.conOtrasRamas === false ? [] : RUTAS_DE_OTRAS_RAMAS),
      { path: '/:pathMatch(.*)*', redirect: '/productos' },
    ],
  })
  const anunciador = crearAnunciador()
  const aviso = crearContextoAvisoDeshacer(anunciador)
  await router.push(ruta)
  await router.isReady()
  const wrapper = mount(defineComponent({ setup: () => () => h(RouterView) }), {
    attachTo: document.body,
    global: {
      plugins: [createPinia(), router],
      provide: {
        [CLAVE_APLICACION as symbol]: app,
        [CLAVE_AVISO_DESHACER as symbol]: aviso,
        [CLAVE_ANUNCIADOR as symbol]: anunciador,
      },
    },
  })
  await esperar()
  return { wrapper, router, aviso, anunciador }
}

/** Deja correr las lecturas pendientes (casos de uso en memoria + componentes diferidos). */
export async function esperar(): Promise<void> {
  for (let i = 0; i < 5; i += 1) {
    await flushPromises()
    await new Promise((listo) => setTimeout(listo, 0))
  }
}

/** La aplicación de prueba con las categorías iniciales sembradas. */
export async function crearAplicacion(): Promise<AplicacionDePrueba> {
  const app = crearAplicacionDePrueba({ ahora: HOY })
  await app.catalogo.sembrarCategoriasIniciales()
  return app
}

export async function crearProducto(
  app: AplicacionDePrueba,
  producto: ProductoDePrueba,
): Promise<string> {
  const id = await crearProductoDePrueba(app, producto)
  await app.esperarTareasPendientes()
  return id
}

/** Id de la categoría con ese nombre (de las iniciales). */
export async function idDeCategoria(app: AplicacionDePrueba, nombre: string): Promise<string> {
  const id = await app.catalogo.importacion.categoriaPorNombre(nombre)
  if (!id) throw new Error(`No existe la categoría ${nombre}`)
  return id
}
