import type { Component } from 'vue'
import {
  CircleHelp,
  Gauge,
  History,
  House,
  Package,
  PackagePlus,
  Settings,
  ShoppingBasket,
  ShoppingCart,
} from 'lucide-vue-next'

/**
 * El dibujo de cada ícono que una ruta declara en `meta.icono` (nombres de lucide). Plan 17:
 * todas las rutas que declaran uno lo tienen aquí (antes Historial y Ajustes caían en la casita
 * de Inicio). Un test recorre las rutas: si una nueva trae otro nombre, falla hasta agregarlo.
 */
const ICONOS: Readonly<Record<string, Component>> = {
  house: House,
  'shopping-cart': ShoppingCart,
  'package-plus': PackagePlus,
  package: Package,
  gauge: Gauge,
  'shopping-basket': ShoppingBasket,
  'circle-help': CircleHelp,
  history: History,
  settings: Settings,
}

export function iconoDeRuta(nombre: string): Component | undefined {
  return Object.hasOwn(ICONOS, nombre) ? ICONOS[nombre] : undefined
}
