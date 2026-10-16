import type { RouteRecordRaw } from 'vue-router'
import { Pendiente } from './pendiente'

/** Ola 4, plan 14 (`feat/ui-inicio-ajustes`): Inicio, Primera vez, Ajustes y avisos del celular. */
export const rutasDeInicioYAjustes: RouteRecordRaw[] = [
  {
    path: '/',
    name: 'inicio',
    component: Pendiente,
    meta: { titulo: 'Inicio', enNavegacion: true, icono: 'house' },
  },
  {
    path: '/ajustes',
    name: 'ajustes',
    component: Pendiente,
    meta: { titulo: 'Ajustes', icono: 'settings' },
  },
]
