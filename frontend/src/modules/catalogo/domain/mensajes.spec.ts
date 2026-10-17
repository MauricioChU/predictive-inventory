import { describe, expect, it } from 'vitest'
import { Cantidad } from '@/shared/domain/cantidad'
import { Dinero } from '@/shared/domain/dinero'
import { mensajePerdida, mensajeRetiro } from './mensajes'

describe('mensajePerdida', () => {
  it('RN-CAT-05: pérdida positiva en UNIDAD', () => {
    expect(mensajePerdida(Dinero.deTexto('0.50'), 'UNIDAD')).toBe(
      'Vas a perder S/ 0.50 por cada unidad',
    )
  })
  it('RN-CAT-05: pérdida positiva en KILO dice "por cada kilo"', () => {
    expect(mensajePerdida(Dinero.deTexto('0.50'), 'KILO')).toBe(
      'Vas a perder S/ 0.50 por cada kilo',
    )
  })
  it('RN-CAT-05: pérdida positiva en LITRO dice "por cada litro"', () => {
    expect(mensajePerdida(Dinero.deTexto('0.50'), 'LITRO')).toBe(
      'Vas a perder S/ 0.50 por cada litro',
    )
  })
  it('RN-CAT-05: pérdida cero es "no ganas nada"', () => {
    expect(mensajePerdida(Dinero.cero(), 'UNIDAD')).toBe(
      'Con este precio no ganas nada por cada unidad',
    )
  })
})

describe('mensajeRetiro', () => {
  it('RN-CAT-11: 4 unidades (plural, femenino)', () => {
    expect(mensajeRetiro(Cantidad.deEntero(4), 'UNIDAD')).toBe(
      'Aún quedan 4 unid. ¿Las retiramos del stock?',
    )
  })
  it('RN-CAT-11: 1 unidad (singular, femenino)', () => {
    expect(mensajeRetiro(Cantidad.deEntero(1), 'UNIDAD')).toBe(
      'Aún queda 1 unid. ¿La retiramos del stock?',
    )
  })
  it('RN-CAT-11: 2.5 kg (plural, masculino)', () => {
    expect(mensajeRetiro(Cantidad.deMilesimas(2500), 'KILO')).toBe(
      'Aún quedan 2.5 kg. ¿Los retiramos del stock?',
    )
  })
  it('RN-CAT-11: 1 kg (singular, masculino)', () => {
    expect(mensajeRetiro(Cantidad.deEntero(1), 'KILO')).toBe(
      'Aún queda 1 kg. ¿Lo retiramos del stock?',
    )
  })
})
