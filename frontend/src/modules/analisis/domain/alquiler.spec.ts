import { describe, expect, it } from 'vitest'
import { Dinero } from '@/shared/domain/dinero'
import { avanceDelAlquiler, textosDelAlquiler } from './alquiler'

const soles = (texto: string) => Dinero.deTexto(texto)

describe('Avance del alquiler (RN-AN-19)', () => {
  it('llevas 110 de 600: 18 % y lo que falta', () => {
    const avance = avanceDelAlquiler(soles('600.00'), soles('110.00'), '2026-10-20')
    expect(avance.cubierto).toBe(false)
    expect(avance.porcentaje).toBe(18)
    expect(textosDelAlquiler(avance)).toEqual([
      'Para el pago del 20/10 llevas S/ 110.00 de S/ 600.00',
      'Te falta S/ 490.00',
    ])
  })

  it('el porcentaje se redondea hacia abajo y nunca llega a 100 sin cubrir', () => {
    expect(avanceDelAlquiler(soles('600.00'), soles('599.99'), '2026-10-20').porcentaje).toBe(99)
  })

  it('llevas 610 de 600: cubierto, 100 % y lo de más es tuyo', () => {
    const avance = avanceDelAlquiler(soles('600.00'), soles('610.00'), '2026-10-20')
    expect(avance.cubierto).toBe(true)
    expect(avance.porcentaje).toBe(100)
    expect(textosDelAlquiler(avance)).toEqual([
      '✓ Ya cubriste el local del 20/10',
      'Lo que ganes de más es tuyo: llevas S/ 10.00',
    ])
  })

  it('exactamente 600 de 600: cubierto, y de más llevas S/ 0.00', () => {
    const avance = avanceDelAlquiler(soles('600.00'), soles('600.00'), '2026-10-20')
    expect(avance.cubierto).toBe(true)
    expect(avance.porcentaje).toBe(100)
    expect(textosDelAlquiler(avance)[1]).toBe('Lo que ganes de más es tuyo: llevas S/ 0.00')
  })

  it('con pérdidas (-24 de 600): 0 % y te falta 624', () => {
    const avance = avanceDelAlquiler(soles('600.00'), soles('-24.00'), '2026-11-05')
    expect(avance.cubierto).toBe(false)
    expect(avance.porcentaje).toBe(0)
    expect(textosDelAlquiler(avance)).toEqual([
      'Para el pago del 05/11 llevas -S/ 24.00 de S/ 600.00',
      'Te falta S/ 624.00',
    ])
  })

  it('conserva el próximo pago, el monto y lo que llevas', () => {
    const avance = avanceDelAlquiler(soles('600.00'), soles('110.00'), '2026-10-20')
    expect(avance.proximoPago).toBe('2026-10-20')
    expect(avance.monto.centimos).toBe(60000)
    expect(avance.llevas.centimos).toBe(11000)
  })
})
