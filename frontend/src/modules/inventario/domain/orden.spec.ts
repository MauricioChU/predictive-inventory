import { describe, expect, it } from 'vitest'
import { compararNormalizados } from './orden'

describe('compararNormalizados', () => {
  it('ordena sin importar tildes, mayúsculas ni espacios repetidos', () => {
    expect(compararNormalizados('Carbón', 'carbon')).toBe(0)
    expect(compararNormalizados('Lejía  1 L', 'lejia 1 l')).toBe(0)
    expect(compararNormalizados('Carbón', 'Lejía 1 L')).toBe(-1)
    expect(compararNormalizados('Lejía 1 L', 'Carbón')).toBe(1)
    expect(['Lejía', 'agua', 'Bolsa'].sort(compararNormalizados)).toEqual([
      'agua',
      'Bolsa',
      'Lejía',
    ])
  })
})
