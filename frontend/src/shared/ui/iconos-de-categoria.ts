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
 * Palabras (ya normalizadas: sin tildes, en minúsculas) que reconocen cada categoría inicial de
 * la tienda (catalogo/domain/categoria.ts). Se busca por raíz de palabra y no por el nombre
 * exacto: la persona puede renombrar "Bolsas" a "Bolsas y envoltorios" o crear "Jabón de ropa"
 * y el ícono sigue teniendo sentido. El orden importa: gana la primera que coincide.
 */
const PALABRAS_POR_ICONO: readonly (readonly [readonly string[], Component])[] = [
  [['lejia', 'desinfect', 'cloro'], Droplets],
  [['detergente', 'jabon'], WashingMachine],
  [['lavavajilla', 'vajilla'], Utensils],
  [['limpiador', 'cera', 'limpiavidrio'], SprayCan],
  [['papel', 'descartable', 'servilleta'], Scroll],
  [['bolsa'], ShoppingBag],
  [['escoba', 'trapeador', 'recogedor', 'accesorio'], BrushCleaning],
  [['ambientador', 'insecticida'], Wind],
  [['carbon', 'combustible', 'fosforo', 'vela'], Flame],
]

/** Ícono lucide que representa a `categoria` cuando el producto no tiene foto. */
export function iconoDeCategoria(categoria: string | undefined): Component {
  const nombre = normalizar(categoria ?? '')
  if (nombre === '') return ICONO_DE_CATEGORIA_GENERICO
  const encontrado = PALABRAS_POR_ICONO.find(([palabras]) =>
    palabras.some((palabra) => nombre.includes(palabra)),
  )
  return encontrado?.[1] ?? ICONO_DE_CATEGORIA_GENERICO
}
