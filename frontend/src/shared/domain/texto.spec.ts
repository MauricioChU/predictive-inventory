import { describe, expect, it } from 'vitest'
import { normalizar } from './texto'

describe('normalizar', () => {
  it('RN-CAT-01: ignora mayúsculas, tildes y espacios repetidos', () => {
    expect(normalizar('  LEJÍA   1 L ')).toBe('lejia 1 l')
    expect(normalizar('Lejía  1L')).toBe(normalizar('lejia 1l'))
    expect(normalizar('Carbón')).toBe('carbon')
  })
  it('conserva la ñ como n sin tilde', () => {
    expect(normalizar('Piña')).toBe('pina')
  })
})
