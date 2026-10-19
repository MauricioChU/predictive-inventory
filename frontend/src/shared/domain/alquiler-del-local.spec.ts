import { describe, expect, it } from 'vitest'
import type { AlquilerDelLocal } from '../contratos/configuracion'
import { esErrorDeDominio } from './errores'
import {
  montoDelAlquilerDeTexto,
  normalizarAlquilerDelLocal,
  validarAlquilerDelLocal,
} from './alquiler-del-local'

const mensual = (montoCentimos: number, dia: number): AlquilerDelLocal => ({
  tipo: 'MENSUAL',
  montoCentimos,
  dias: [dia],
})
const quincenal = (montoCentimos: number, a: number, b: number): AlquilerDelLocal => ({
  tipo: 'QUINCENAL',
  montoCentimos,
  dias: [a, b],
})

describe('validarAlquilerDelLocal (RN-AN-17)', () => {
  it('sin configurar y NO_PAGA son válidos', () => {
    expect(validarAlquilerDelLocal(null)).toBeNull()
    expect(validarAlquilerDelLocal({ tipo: 'NO_PAGA' })).toBeNull()
  })

  it('mensual y quincenal correctos son válidos', () => {
    expect(validarAlquilerDelLocal(mensual(120_000, 5))).toBeNull()
    expect(validarAlquilerDelLocal(quincenal(60_000, 20, 5))).toBeNull()
    expect(validarAlquilerDelLocal(mensual(1, 1))).toBeNull()
    expect(validarAlquilerDelLocal(mensual(9_999_999, 31))).toBeNull()
  })

  it('el monto debe ser mayor que cero', () => {
    const mensaje = 'El monto debe ser mayor que S/ 0.00'
    expect(validarAlquilerDelLocal(mensual(0, 5))).toBe(mensaje)
    expect(validarAlquilerDelLocal(mensual(-100, 5))).toBe(mensaje)
    expect(validarAlquilerDelLocal(quincenal(0, 5, 20))).toBe(mensaje)
  })

  it('el monto no puede pasar de S/ 99 999.99', () => {
    expect(validarAlquilerDelLocal(mensual(10_000_000, 5))).toBe(
      'El monto no puede pasar de S/ 99 999.99',
    )
  })

  it('cada día va del 1 al 31', () => {
    const mensaje = 'El día de pago va del 1 al 31'
    expect(validarAlquilerDelLocal(mensual(100, 32))).toBe(mensaje)
    expect(validarAlquilerDelLocal(mensual(100, 0))).toBe(mensaje)
    expect(validarAlquilerDelLocal(mensual(100, 2.5))).toBe(mensaje)
    expect(validarAlquilerDelLocal(quincenal(100, 5, 32))).toBe(mensaje)
    expect(validarAlquilerDelLocal(quincenal(100, 0, 5))).toBe(mensaje)
  })

  it('dos veces al mes exige dos días distintos', () => {
    expect(validarAlquilerDelLocal(quincenal(100, 5, 5))).toBe('Elige dos días distintos')
  })

  it('el monto se revisa antes que los días', () => {
    expect(validarAlquilerDelLocal(mensual(0, 40))).toBe('El monto debe ser mayor que S/ 0.00')
  })
})

describe('normalizarAlquilerDelLocal', () => {
  it('ordena de menor a mayor los dos días de pago', () => {
    expect(normalizarAlquilerDelLocal(quincenal(60_000, 20, 5))).toEqual(quincenal(60_000, 5, 20))
  })

  it('deja igual lo que ya está en orden y los demás tipos', () => {
    expect(normalizarAlquilerDelLocal(quincenal(100, 5, 20))).toEqual(quincenal(100, 5, 20))
    expect(normalizarAlquilerDelLocal(mensual(100, 5))).toEqual(mensual(100, 5))
    expect(normalizarAlquilerDelLocal({ tipo: 'NO_PAGA' })).toEqual({ tipo: 'NO_PAGA' })
    expect(normalizarAlquilerDelLocal(null)).toBeNull()
  })

  it('no modifica el original', () => {
    const original = quincenal(100, 20, 5)
    normalizarAlquilerDelLocal(original)
    expect(original).toEqual(quincenal(100, 20, 5))
  })
})

describe('montoDelAlquilerDeTexto', () => {
  it('convierte el texto a Dinero', () => {
    expect(montoDelAlquilerDeTexto('1200.00').centimos).toBe(120_000)
    expect(montoDelAlquilerDeTexto('600,5').centimos).toBe(60_050)
  })

  it('más de 2 decimales: mensaje de la spec con código DINERO_DECIMALES', () => {
    let capturado: unknown
    try {
      montoDelAlquilerDeTexto('12.345')
    } catch (error) {
      capturado = error
    }
    expect(esErrorDeDominio(capturado)).toBe(true)
    expect(capturado).toMatchObject({
      codigo: 'DINERO_DECIMALES',
      message: 'El monto puede tener hasta 2 decimales',
    })
  })

  it('los demás errores pasan sin cambios', () => {
    let capturado: unknown
    try {
      montoDelAlquilerDeTexto('abc')
    } catch (error) {
      capturado = error
    }
    expect(capturado).toMatchObject({ codigo: 'DINERO_INVALIDO' })
  })
})
