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
  // M6: vuelve al tope al navegar. LayoutApp (S1) volvió a usar el scroll normal del
  // documento (ventana) en vez de un contenedor interno, así que esto ya actúa de verdad
  // (antes, con <main> desplazándose internamente, esta opción no tenía ningún efecto).
  scrollBehavior(_to, _from, posicionGuardada) {
    return posicionGuardada ?? { top: 0 }
  },
})

router.afterEach((to, from) => {
  document.title = `${String(to.meta.titulo ?? 'Inventario')} · Inventario`

  // M6: RN-UX-15 — anuncia la pantalla nueva moviendo el foco a su <h1>. Pero no en la
  // primera navegación (carga inicial, recarga o apertura como PWA instalada): ahí "from" es
  // la ruta especial sin resolver (matched vacío) y robarle el foco a la página recién
  // abierta sería inesperado para quien ya decidió dónde poner el foco (p. ej. el navegador).
  if (from.matched.length === 0) return
  void nextTick(() => {
    const encabezado = document.querySelector<HTMLElement>('#contenido h1')
    const destino = encabezado ?? document.getElementById('contenido')
    if (!destino) return
    if (!destino.hasAttribute('tabindex')) destino.setAttribute('tabindex', '-1')
    destino.focus({ preventScroll: true })
  })
})

export default router
