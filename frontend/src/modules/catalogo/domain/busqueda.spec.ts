import { describe, expect, it } from 'vitest'
import { normalizar } from '@/shared/domain/texto'
import { coincide, ordenarResultados } from './busqueda'

describe('coincide (RN-CAT-12)', () => {
  const nombre = normalizar('Lejía Tradicional 1 L')

  it('encuentra con una sola palabra', () => {
    expect(coincide(nombre, 'lejia')).toBe(true)
  })
  it('encuentra con varias palabras en cualquier orden, sin tildes', () => {
    expect(coincide(nombre, '1 l lejia')).toBe(true)
  })
  it('ignora mayúsculas', () => {
    expect(coincide(normalizar('Carbón vegetal'), 'CARBON')).toBe(true)
  })
  it('encuentra con una palabra parcial del nombre', () => {
    expect(coincide(normalizar('Lejía Tradicional 2 L'), 'trad 2')).toBe(true)
  })
  it('no encuentra si falta una palabra', () => {
    expect(coincide(nombre, 'detergente')).toBe(false)
  })
  it('el texto vacío encuentra todo', () => {
    expect(coincide(nombre, '')).toBe(true)
    expect(coincide(nombre, '   ')).toBe(true)
  })
})

describe('ordenarResultados (RN-CAT-12)', () => {
  it('ordena por veces vendido, descendente', () => {
    const items = [
      { id: 'p1', nombreNormalizado: normalizar('Lejía Tradicional 1 L') },
      { id: 'p2', nombreNormalizado: normalizar('Lejía Tradicional 2 L') },
    ]
    const vecesVendido = new Map([
      ['p1', 1],
      ['p2', 6],
    ])
    expect(ordenarResultados(items, vecesVendido).map((i) => i.id)).toEqual(['p2', 'p1'])
  })
  it('en caso de empate (incluido 0 ventas), ordena por nombre normalizado', () => {
    const items = [
      { id: 'p2', nombreNormalizado: normalizar('Lejía Tradicional 2 L') },
      { id: 'p1', nombreNormalizado: normalizar('Lejía Tradicional 1 L') },
    ]
    expect(ordenarResultados(items, new Map()).map((i) => i.id)).toEqual(['p1', 'p2'])
  })
  it('no muta el arreglo de entrada', () => {
    const items = [
      { id: 'p2', nombreNormalizado: 'b' },
      { id: 'p1', nombreNormalizado: 'a' },
    ]
    const copia = [...items]
    ordenarResultados(items, new Map())
    expect(items).toEqual(copia)
  })
})
