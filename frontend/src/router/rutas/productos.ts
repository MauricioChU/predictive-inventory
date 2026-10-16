import type { RouteRecordRaw } from 'vue-router'
import {
  VistaCategorias,
  VistaDetalleProducto,
  VistaEditarProducto,
  VistaProductoNuevo,
  VistaProductos,
} from '@/modules/catalogo'

/**
 * Ola 4, plan 11 (`feat/ui-productos`): lista, detalle, formulario y categorías (contrato de
 * rutas de la Ola 4). Los segmentos fijos (`nuevo`, `categorias`) van antes que `:id` aunque
 * Vue Router ya los prefiere. `/productos/:id` lo abren las notificaciones (M5).
 */
export const rutasDeProductos: RouteRecordRaw[] = [
  {
    path: '/productos',
    name: 'productos',
    component: VistaProductos,
    meta: { titulo: 'Productos', enNavegacion: true, icono: 'package' },
  },
  {
    path: '/productos/nuevo',
    name: 'producto-nuevo',
    component: VistaProductoNuevo,
    meta: { titulo: 'Producto nuevo' },
  },
  {
    path: '/productos/categorias',
    name: 'categorias',
    component: VistaCategorias,
    meta: { titulo: 'Categorías' },
  },
  {
    path: '/productos/:id',
    name: 'producto',
    component: VistaDetalleProducto,
    props: true,
    meta: { titulo: 'Producto' },
  },
  {
    path: '/productos/:id/editar',
    name: 'producto-editar',
    component: VistaEditarProducto,
    props: true,
    meta: { titulo: 'Editar producto' },
  },
]
