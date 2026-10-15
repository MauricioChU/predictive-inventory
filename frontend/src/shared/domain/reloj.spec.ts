import { describe, expect, it } from 'vitest'
import { RelojDelSistema, RelojFijo } from './reloj'
import { IdsAleatorios, IdsSecuenciales } from './ids'

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
  // No está en el enunciado de la Tarea 7: completa la cobertura de RelojFijo.fijar(),
  // RelojDelSistema e IdsAleatorios (RN-SIS-02 exige 95% en el dominio).
  it('RelojFijo.fijar() reemplaza el instante actual', () => {
    const reloj = new RelojFijo('2026-10-15T15:00:00.000Z')
    reloj.fijar('2026-11-01T00:00:00.000Z')
    expect(reloj.ahora()).toBe('2026-11-01T00:00:00.000Z')
  })
  it('RelojDelSistema.ahora() devuelve un instante ISO 8601 real', () => {
    const antes = Date.now()
    const instante = new RelojDelSistema().ahora()
    expect(Date.parse(instante)).toBeGreaterThanOrEqual(antes)
  })
  it('IdsAleatorios genera ids distintos', () => {
    const ids = new IdsAleatorios()
    expect(ids.nuevo()).not.toBe(ids.nuevo())
  })
})
