import type { RouteRecordRaw } from 'vue-router'
import { Pendiente } from './pendiente'

/** Ola 4, plan 11 (`feat/ui-productos`): lista, detalle, formulario y categorías. */
export const rutasDeProductos: RouteRecordRaw[] = [
  {
    path: '/productos',
    name: 'productos',
    component: Pendiente,
    meta: { titulo: 'Productos', enNavegacion: true, icono: 'package' },
  },
]
