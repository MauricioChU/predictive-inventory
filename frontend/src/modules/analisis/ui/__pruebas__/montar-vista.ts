import { flushPromises, mount } from '@vue/test-utils'
import { defineComponent, h, type Component } from 'vue'
import { createMemoryHistory, createRouter, type RouteRecordRaw } from 'vue-router'
import { CLAVE_AVISO_DESHACER, crearContextoAvisoDeshacer } from '@/app/aviso-deshacer'
import type { Aplicacion } from '@/app/composicion'
import { proveerAplicacion } from '@/app/proveer-aplicacion'
import { CLAVE_ANUNCIADOR, crearAnunciador } from '@/shared/ui/anunciador'

/** Pantalla de relleno para las rutas a las que navega la vista que se prueba. */
const OtraPantalla = defineComponent({
  setup: () => () => h('h1', 'Otra pantalla'),
})

/** Las rutas que las pantallas de Control usan por nombre (contrato de rutas de la Ola 4). */
function rutasDePrueba(conDetalleDeProducto: boolean): RouteRecordRaw[] {
  const rutas: RouteRecordRaw[] = [
    { path: '/', name: 'inicio', component: OtraPantalla },
    { path: '/control', name: 'control', component: OtraPantalla },
    { path: '/control/para-comprar', name: 'para-comprar', component: OtraPantalla },
    { path: '/control/necesito-comprar', name: 'necesito-comprar', component: OtraPantalla },
    { path: '/recibir', name: 'recibir', component: OtraPantalla },
  ]
  // El detalle es de la rama 11: mientras no llegue a develop la ruta no existe.
  if (conDetalleDeProducto) {
    rutas.push({ path: '/productos/:id', name: 'producto', component: OtraPantalla })
  }
  return rutas
}

export interface OpcionesDeMontaje {
  aplicacion: Aplicacion
  /** Ruta en la que "está" la vista (para EncabezadoPagina y los enlaces). */
  ruta?: string
  /** Si existe la ruta `producto` (detalle, rama 11). Por omisión, sí. */
  conDetalleDeProducto?: boolean
}

/**
 * Monta una vista de Control como la monta la app: con `useAplicacion()` (la aplicación de
 * prueba), un router en memoria con las rutas del contrato, el anunciador global y el aviso
 * Deshacer. Espera a que termine de cargar sus datos.
 */
export async function montarVista(vista: Component, opciones: OpcionesDeMontaje) {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: rutasDePrueba(opciones.conDetalleDeProducto ?? true),
  })
  await router.push(opciones.ruta ?? '/control')
  await router.isReady()
  const anunciador = crearAnunciador()
  const aviso = crearContextoAvisoDeshacer(anunciador)
  const envoltura = mount(vista, {
    attachTo: document.body,
    global: {
      plugins: [proveerAplicacion(opciones.aplicacion), router],
      provide: { [CLAVE_ANUNCIADOR]: anunciador, [CLAVE_AVISO_DESHACER]: aviso },
    },
  })
  await esperarCarga()
  return { envoltura, router, anunciador, aviso }
}

/** Deja correr las lecturas de los casos de uso (memoria) y el render que les sigue. */
export async function esperarCarga(): Promise<void> {
  for (let i = 0; i < 5; i += 1) await flushPromises()
}
