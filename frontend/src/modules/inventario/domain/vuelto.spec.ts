import { afterEach, describe, expect, it, vi } from 'vitest'
import { Dinero } from '@/shared/domain/dinero'
import { BILLETES_RAPIDOS, calcularVuelto } from './vuelto'

const TOTAL = Dinero.deTexto('14.63')

describe('calcularVuelto', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it.each([
    ['20.00', 'Vuelto S/ 5.37', true, 537],
    ['14.63', 'Vuelto S/ 0.00', true, 0],
    ['10.00', 'Faltan S/ 4.63', false, null],
  ])('RN-OP-13: si pagan %s se muestra "%s"', (pagado, mensaje, puedeConfirmar, vuelto) => {
    const resultado = calcularVuelto(TOTAL, pagado)
    expect(resultado.mensaje).toBe(mensaje)
    expect(resultado.puedeConfirmar).toBe(puedeConfirmar)
    expect(resultado.vuelto?.centimos ?? null).toBe(vuelto)
  })

  it('RN-OP-13: acepta lo que escribe el usuario ("S/ 20", "20,00")', () => {
    expect(calcularVuelto(TOTAL, 'S/ 20').mensaje).toBe('Vuelto S/ 5.37')
    expect(calcularVuelto(TOTAL, '20,00').mensaje).toBe('Vuelto S/ 5.37')
  })

  it('RN-OP-13: el vuelto es opcional: sin monto se puede confirmar y no se muestra nada', () => {
    expect(calcularVuelto(TOTAL, '  ')).toEqual({ puedeConfirmar: true, mensaje: '', vuelto: null })
  })

  it('RN-OP-13: un monto inválido o negativo no permite confirmar', () => {
    expect(calcularVuelto(TOTAL, 'veinte')).toEqual({
      puedeConfirmar: false,
      mensaje: 'Escribe un monto válido, por ejemplo 3.50',
      vuelto: null,
    })
    expect(calcularVuelto(TOTAL, '-20.00')).toEqual({
      puedeConfirmar: false,
      mensaje: 'Escribe un monto válido, por ejemplo 3.50',
      vuelto: null,
    })
  })

  it('RN-OP-13: los vueltos de más de mil soles agrupan los miles', () => {
    expect(calcularVuelto(TOTAL, '2000').mensaje).toBe('Vuelto S/ 1 985.37')
  })

  it('RN-OP-13: botones rápidos de S/ 10, 20, 50 y 100 (en céntimos)', () => {
    expect(BILLETES_RAPIDOS).toEqual([1000, 2000, 5000, 10000])
  })

  it('un error que no es de dominio no se disfraza de mensaje', () => {
    vi.spyOn(Dinero, 'deTexto').mockImplementation(() => {
      throw new Error('falla interna')
    })
    expect(() => calcularVuelto(TOTAL, '20.00')).toThrow('falla interna')
  })
})
