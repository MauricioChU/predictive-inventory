import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router'

const Pendiente = () => import('@/app/vistas/PendienteVista.vue')

export const rutas: RouteRecordRaw[] = [
  { path: '/', name: 'inicio', component: Pendiente, meta: { titulo: 'Inicio', enNavegacion: true, icono: 'house' } },
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
  { path: '/historial', name: 'historial', component: Pendiente, meta: { titulo: 'Historial', icono: 'history' } },
  { path: '/ajustes', name: 'ajustes', component: Pendiente, meta: { titulo: 'Ajustes', icono: 'settings' } },
  { path: '/:pathMatch(.*)*', redirect: '/' },
]

const router = createRouter({ history: createWebHistory(import.meta.env.BASE_URL), routes: rutas })

router.afterEach((to) => {
  document.title = `${String(to.meta.titulo ?? 'Inventario')} · Inventario`
})

export default router
