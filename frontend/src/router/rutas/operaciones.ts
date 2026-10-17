import type { RouteRecordRaw } from 'vue-router'
import {
  VistaContarStock,
  VistaContarTodo,
  VistaHistorial,
  VistaMerma,
  VistaOperacion,
  VistaRecibir,
  VistaVender,
} from '@/modules/inventario'

/** Ola 4, plan 12 (`feat/ui-operaciones`): Vender, Recibir, merma, conteos e Historial. */
export const rutasDeOperaciones: RouteRecordRaw[] = [
  {
    path: '/vender',
    name: 'vender',
    component: VistaVender,
    meta: { titulo: 'Vender', enNavegacion: true, icono: 'shopping-cart' },
  },
  {
    path: '/recibir',
    name: 'recibir',
    // RN-UX-12: en la navegación dice "Recibir"; la pantalla se titula "Llegó mercadería".
    component: VistaRecibir,
    meta: { titulo: 'Recibir', enNavegacion: true, icono: 'package-plus' },
  },
  // Bajo /productos/:id/… pero de esta rama (contrato de rutas): las abre la ficha del producto.
  {
    path: '/productos/:id/merma',
    name: 'merma',
    component: VistaMerma,
    meta: { titulo: 'Registrar pérdida' },
  },
  {
    path: '/productos/:id/contar',
    name: 'contar-stock',
    component: VistaContarStock,
    meta: { titulo: 'Contar stock' },
  },
  {
    path: '/contar',
    name: 'contar-todo',
    component: VistaContarTodo,
    meta: { titulo: 'Contar todo' },
  },
  {
    path: '/historial',
    name: 'historial',
    component: VistaHistorial,
    meta: { titulo: 'Historial', icono: 'history' },
  },
  {
    path: '/historial/:id',
    name: 'operacion',
    component: VistaOperacion,
    meta: { titulo: 'Operación' },
  },
]
