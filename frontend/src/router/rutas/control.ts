import type { RouteRecordRaw } from 'vue-router'
import { Pendiente } from './pendiente'

/** Ola 4, plan 13 (`feat/ui-control`): Torre de control, Para comprar y ¿Necesito comprar? */
export const rutasDeControl: RouteRecordRaw[] = [
  {
    path: '/control',
    name: 'control',
    component: Pendiente,
    meta: { titulo: 'Control', enNavegacion: true, icono: 'gauge' },
  },
]
