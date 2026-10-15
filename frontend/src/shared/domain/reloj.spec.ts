import { describe, expect, it } from 'vitest'
import { RelojFijo } from './reloj'
import { IdsSecuenciales } from './ids'

describe('RelojFijo e IdsSecuenciales', () => {
  it('avanza segundos de forma controlada', () => {
    const reloj = new RelojFijo('2026-10-15T15:00:00.000Z')
    reloj.avanzarSegundos(11)
    expect(reloj.ahora()).toBe('2026-10-15T15:00:11.000Z')
  })
  it('genera ids predecibles en pruebas', () => {
    const ids = new IdsSecuenciales('op')
    expect([ids.nuevo(), ids.nuevo()]).toEqual(['op-1', 'op-2'])
  })
})
