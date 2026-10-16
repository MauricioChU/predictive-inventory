import type { RouteRecordRaw } from 'vue-router'
import { useEstadoGlobal } from '@/app/estado-global'
import { VistaAvisos } from '@/modules/alertas'
import {
  VistaGuardarCopia,
  VistaImportarProductos,
  VistaRestaurarCopia,
} from '@/modules/respaldo'
import {
  escucharInstalacion,
  VistaAjustes,
  VistaDatosDeLaTienda,
  VistaInicio,
  VistaPrimeraVez,
} from '@/modules/tienda'

// RN-UX-13: el navegador ofrece instalar la app una sola vez y en cualquier pantalla; se escucha
// desde que arranca la app (este archivo se carga con el router), no recién al abrir Inicio.
escucharInstalacion()

/** Ola 4, plan 14 (`feat/ui-inicio-ajustes`): Inicio, Primera vez, Ajustes y avisos del celular. */
export const rutasDeInicioYAjustes: RouteRecordRaw[] = [
  {
    path: '/',
    name: 'inicio',
    component: VistaInicio,
    meta: { titulo: 'Inicio', enNavegacion: true, icono: 'house' },
    // Mientras falte la primera vez (nombre y letra), Inicio es la bienvenida.
    beforeEnter: () => (useEstadoGlobal().primeraVez ? { name: 'primera-vez' } : true),
  },
  {
    path: '/bienvenida',
    name: 'primera-vez',
    component: VistaPrimeraVez,
    meta: { titulo: 'Bienvenida' },
    // Completada, la bienvenida ya no se repite; los pasos siguientes (cargar productos y
    // contar, con ?paso=…) sí se pueden abrir.
    beforeEnter: (to) =>
      !useEstadoGlobal().primeraVez && to.query.paso === undefined ? { name: 'inicio' } : true,
  },
  {
    path: '/ajustes',
    name: 'ajustes',
    component: VistaAjustes,
    meta: { titulo: 'Ajustes', icono: 'settings' },
  },
  {
    path: '/ajustes/tienda',
    name: 'datos-de-la-tienda',
    component: VistaDatosDeLaTienda,
    meta: { titulo: 'Datos de la tienda' },
  },
  {
    path: '/ajustes/avisos',
    name: 'avisos',
    component: VistaAvisos,
    meta: { titulo: 'Avisos en tu celular' },
  },
  {
    path: '/ajustes/copia',
    name: 'guardar-copia',
    component: VistaGuardarCopia,
    meta: { titulo: 'Guardar copia' },
  },
  {
    path: '/ajustes/restaurar',
    name: 'restaurar-copia',
    component: VistaRestaurarCopia,
    meta: { titulo: 'Restaurar copia' },
  },
  {
    path: '/ajustes/importar',
    name: 'importar-productos',
    component: VistaImportarProductos,
    meta: { titulo: 'Importar productos' },
  },
]
