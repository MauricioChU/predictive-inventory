import { nextTick } from 'vue'
import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router'

const Pendiente = () => import('@/app/vistas/PendienteVista.vue')

export const rutas: RouteRecordRaw[] = [
  {
    path: '/',
    name: 'inicio',
    component: Pendiente,
    meta: { titulo: 'Inicio', enNavegacion: true, icono: 'house' },
  },
  {
    path: '/vender',
    name: 'vender',
    component: Pendiente,
    meta: { titulo: 'Vender', enNavegacion: true, icono: 'shopping-cart' },
  },
  {
    path: '/recibir',
    name: 'recibir',
    component: Pendiente,
    meta: { titulo: 'Recibir', enNavegacion: true, icono: 'package-plus' },
  },
  {
    path: '/productos',
    name: 'productos',
    component: Pendiente,
    meta: { titulo: 'Productos', enNavegacion: true, icono: 'package' },
  },
  {
    path: '/control',
    name: 'control',
    component: Pendiente,
    meta: { titulo: 'Control', enNavegacion: true, icono: 'gauge' },
  },
  {
    path: '/historial',
    name: 'historial',
    component: Pendiente,
    meta: { titulo: 'Historial', icono: 'history' },
  },
  {
    path: '/ajustes',
    name: 'ajustes',
    component: Pendiente,
    meta: { titulo: 'Ajustes', icono: 'settings' },
  },
  { path: '/:pathMatch(.*)*', redirect: '/' },
]

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: rutas,
  // M6: vuelve al tope al navegar. No es lo único que hace falta: el que realmente se
  // desplaza es <main id="contenido"> (tiene su propio scroll, ver LayoutApp), no la ventana,
  // así que abajo también reseteamos ese contenedor a mano.
  scrollBehavior(_to, _from, posicionGuardada) {
    return posicionGuardada ?? { top: 0 }
  },
})

router.afterEach((to) => {
  document.title = `${String(to.meta.titulo ?? 'Inventario')} · Inventario`

  // M6: RN-UX-15 — anuncia la pantalla nueva moviendo el foco a su título y reinicia el
  // desplazamiento del contenedor que realmente se desplaza (#contenido).
  void nextTick(() => {
    const contenedor = document.getElementById('contenido')
    if (!contenedor) return
    contenedor.scrollTo({ top: 0 })
    const encabezado = contenedor.querySelector('h1')
    const destino = encabezado ?? contenedor
    if (!destino.hasAttribute('tabindex')) destino.setAttribute('tabindex', '-1')
    destino.focus({ preventScroll: true })
  })
})

export default router
