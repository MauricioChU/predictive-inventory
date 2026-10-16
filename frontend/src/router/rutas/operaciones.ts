import type { RouteRecordRaw } from 'vue-router'
import { VistaVender } from '@/modules/inventario'
import { Pendiente } from './pendiente'

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
    component: Pendiente,
    meta: { titulo: 'Recibir', enNavegacion: true, icono: 'package-plus' },
  },
  {
    path: '/historial',
    name: 'historial',
    component: Pendiente,
    meta: { titulo: 'Historial', icono: 'history' },
  },
]
