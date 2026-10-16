import type { Component } from 'vue'
import {
  BrushCleaning,
  Droplets,
  Flame,
  Package,
  Scroll,
  ShoppingBag,
  SprayCan,
  Utensils,
  WashingMachine,
  Wind,
} from 'lucide-vue-next'
import { normalizar } from '@/shared/domain/texto'

/** Ícono de un producto sin foto cuya categoría no se reconoce (o que no tiene). */
export const ICONO_DE_CATEGORIA_GENERICO: Component = Package

/**
 * Raíces (ya normalizadas: sin tildes, en minúsculas) que reconocen cada categoría inicial de la
 * tienda (catalogo/domain/categoria.ts). Se comparan con el INICIO de cada palabra del nombre, y
 * lo que sigue a la raíz solo puede ser un plural ("bolsa" → "bolsas", "jabon" → "jabones"):
 * así "Velas" es vela pero "novela" no, y "Carbones" es carbón pero "carbonatadas" no. Una raíz
 * con "*" acepta cualquier final ("desinfect*" → "desinfectante", "desinfectantes").
 * Ronda 1: el orden importa y va de lo más específico a lo más general: gana el primer grupo
 * con alguna palabra que coincida ("Jabones y lavavajillas" es lavavajillas, no jabón).
 */
const RAICES_POR_ICONO: readonly (readonly [readonly string[], Component])[] = [
  [['lavavajilla', 'vajilla'], Utensils],
  [['limpiavidrio'], SprayCan],
  [['lejia', 'desinfect*', 'cloro'], Droplets],
  [['detergente', 'jabon'], WashingMachine],
  [['limpiador', 'cera'], SprayCan],
  [['papel', 'descartable', 'servilleta'], Scroll],
  [['bolsa'], ShoppingBag],
  [['escoba', 'trapeador', 'recogedor', 'accesorio'], BrushCleaning],
  [['ambientador', 'insecticida'], Wind],
  [['carbon', 'combustible', 'fosforo', 'vela'], Flame],
]

const FINALES_DE_PLURAL = ['', 's', 'es']

function coincide(palabra: string, raiz: string): boolean {
  if (raiz.endsWith('*')) return palabra.startsWith(raiz.slice(0, -1))
  return palabra.startsWith(raiz) && FINALES_DE_PLURAL.includes(palabra.slice(raiz.length))
}

/** Ícono lucide que representa a `categoria` cuando el producto no tiene foto. */
export function iconoDeCategoria(categoria: string | undefined): Component {
  const palabras = normalizar(categoria ?? '')
    .split(/[^a-z0-9]+/)
    .filter((palabra) => palabra !== '')
  const encontrado = RAICES_POR_ICONO.find(([raices]) =>
    raices.some((raiz) => palabras.some((palabra) => coincide(palabra, raiz))),
  )
  return encontrado?.[1] ?? ICONO_DE_CATEGORIA_GENERICO
}
