import { describe, expect, it } from 'vitest'
import type { Dia } from './fecha'
import { fechaDePagoEn, proximoPago, siguientePagoDesde, ultimoPago } from './fechas-de-pago'

describe('fechas de pago (RN-AN-18)', () => {
  it.each([
    ['2026-10-15', [5, 20], '2026-10-05', '2026-10-20'],
    ['2026-10-20', [5, 20], '2026-10-20', '2026-11-05'],
    ['2026-11-03', [5, 20], '2026-10-20', '2026-11-05'],
    ['2027-02-15', [31], '2027-01-31', '2027-02-28'],
    ['2027-03-01', [31], '2027-02-28', '2027-03-31'],
  ])('hoy %s con días %j: último %s y próximo %s', (hoy, dias, ultimo, proximo) => {
    expect(ultimoPago(dias, hoy as Dia)).toBe(ultimo)
    expect(proximoPago(dias, hoy as Dia)).toBe(proximo)
  })

  it('cruza el año hacia adelante', () => {
    expect(ultimoPago([5, 20], '2026-12-25')).toBe('2026-12-20')
    expect(proximoPago([5, 20], '2026-12-25')).toBe('2027-01-05')
  })

  it('cruza el año hacia atrás', () => {
    expect(ultimoPago([5, 20], '2027-01-03')).toBe('2026-12-20')
    expect(proximoPago([5, 20], '2027-01-03')).toBe('2027-01-05')
  })

  it('febrero bisiesto: el día 30 cae el 29', () => {
    expect(proximoPago([30], '2028-02-10')).toBe('2028-02-29')
    expect(fechaDePagoEn(2028, 2, 30)).toBe('2028-02-29')
    expect(fechaDePagoEn(2027, 2, 30)).toBe('2027-02-28')
  })

  it('el día elegido existe: se respeta tal cual', () => {
    expect(fechaDePagoEn(2026, 10, 5)).toBe('2026-10-05')
    expect(fechaDePagoEn(2026, 4, 31)).toBe('2026-04-30')
  })

  it('no importa el orden de los días', () => {
    expect(ultimoPago([20, 5], '2026-10-15')).toBe('2026-10-05')
    expect(proximoPago([20, 5], '2026-10-15')).toBe('2026-10-20')
  })

  it('siguientePagoDesde devuelve hoy si hoy es día de pago, y si no el próximo', () => {
    expect(siguientePagoDesde([5, 20], '2026-10-20')).toBe('2026-10-20')
    expect(siguientePagoDesde([5, 20], '2026-10-21')).toBe('2026-11-05')
    expect(siguientePagoDesde([5, 20], '2026-10-15')).toBe('2026-10-20')
  })
})
