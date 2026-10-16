import { describe, expect, it } from 'vitest'
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
import { ICONO_DE_CATEGORIA_GENERICO, iconoDeCategoria } from '../iconos-de-categoria'

describe('iconoDeCategoria (FotoDeProducto sin foto)', () => {
  // Las 10 categorías con las que arranca la tienda (catalogo/domain/categoria.ts).
  it.each([
    ['Lejías y desinfectantes', Droplets],
    ['Detergentes y jabones', WashingMachine],
    ['Lavavajillas', Utensils],
    ['Limpiadores y ceras', SprayCan],
    ['Papel y descartables', Scroll],
    ['Bolsas', ShoppingBag],
    ['Escobas, trapeadores y accesorios', BrushCleaning],
    ['Ambientadores e insecticidas', Wind],
    ['Carbón y combustibles', Flame],
  ])('"%s" tiene su propio ícono', (categoria, icono) => {
    expect(iconoDeCategoria(categoria)).toBe(icono)
  })

  it('reconoce la categoría aunque cambien tildes, mayúsculas o espacios (o la renombren)', () => {
    expect(iconoDeCategoria('  LEJIAS  y desinfectantes ')).toBe(Droplets)
    expect(iconoDeCategoria('Jabón de ropa')).toBe(WashingMachine)
    expect(iconoDeCategoria('Carbon')).toBe(Flame)
    expect(iconoDeCategoria('Bolsas y envoltorios')).toBe(ShoppingBag)
  })

  it('"Otros", una categoría desconocida o ninguna usan el ícono genérico', () => {
    expect(ICONO_DE_CATEGORIA_GENERICO).toBe(Package)
    expect(iconoDeCategoria('Otros')).toBe(Package)
    expect(iconoDeCategoria('Golosinas')).toBe(Package)
    expect(iconoDeCategoria('')).toBe(Package)
    expect(iconoDeCategoria(undefined)).toBe(Package)
  })
})
