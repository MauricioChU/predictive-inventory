import { describe, expect, it } from 'vitest'
import { diaDe, diaDeLaSemana, diasEntre, inicioDelDia, instanteLocal, segundosEntre, sumarDias, sumarSegundos } from './fecha'

describe('fecha de negocio (America/Lima, UTC−5)', () => {
  it('convierte hora local de la tienda a instante UTC', () => {
    expect(instanteLocal('2026-10-15 10:00')).toBe('2026-10-15T15:00:00.000Z')
    expect(instanteLocal('2026-10-07 23:59')).toBe('2026-10-08T04:59:00.000Z')
  })
  it('el día depende de la zona de la tienda, no de UTC', () => {
    expect(diaDe('2026-10-16T04:59:00.000Z')).toBe('2026-10-15')
    expect(diaDe('2026-10-16T05:00:00.000Z')).toBe('2026-10-16')
    expect(inicioDelDia('2026-10-15')).toBe('2026-10-15T05:00:00.000Z')
  })
  it('suma y resta días cruzando meses', () => {
    expect(sumarDias('2026-09-30', 1)).toBe('2026-10-01')
    expect(sumarDias('2026-10-15', -28)).toBe('2026-09-17')
    expect(diasEntre('2026-09-17', '2026-10-15')).toBe(28)
  })
  it('día de la semana empieza en lunes', () => {
    expect(diaDeLaSemana('2026-10-15')).toBe(4) // jueves
    expect(diaDeLaSemana('2026-10-17')).toBe(6) // sábado
    expect(diaDeLaSemana('2026-10-18')).toBe(7) // domingo
  })
  it('suma y mide segundos', () => {
    const a = instanteLocal('2026-10-15 10:00')
    expect(segundosEntre(a, sumarSegundos(a, 11))).toBe(11)
  })
})
