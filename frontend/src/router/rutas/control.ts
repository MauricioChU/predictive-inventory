import type { RouteRecordRaw } from 'vue-router'
import { VistaControl, VistaNecesitoComprar, VistaParaComprar } from '@/modules/analisis'

/** Ola 4, plan 13 (`feat/ui-control`): Torre de control, Para comprar y ¿Necesito comprar? */
export const rutasDeControl: RouteRecordRaw[] = [
  {
    path: '/control',
    name: 'control',
    component: VistaControl,
    meta: { titulo: 'Control', enNavegacion: true, icono: 'gauge' },
  },
  {
    // Lo abren las notificaciones (RUTA_PARA_COMPRAR de Alertas, M5).
    path: '/control/para-comprar',
    name: 'para-comprar',
    component: VistaParaComprar,
    meta: { titulo: 'Para comprar', icono: 'shopping-basket' },
  },
  {
    // El botón de Inicio (06-experiencia-de-uso).
    path: '/control/necesito-comprar',
    name: 'necesito-comprar',
    component: VistaNecesitoComprar,
    meta: { titulo: '¿Necesito comprar?', icono: 'circle-help' },
  },
]
