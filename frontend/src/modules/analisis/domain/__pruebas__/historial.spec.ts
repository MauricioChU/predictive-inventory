import { describe, expect, it } from 'vitest'
import { historial, prediccionCon } from './historial'

describe('constructor de historiales de prueba', () => {
  it('reparte lo vendido en partes iguales y deja el resto en el último día', () => {
    const h = historial('carbon', { precioVenta: '4.00', precioCompra: '2.75' })
      .primerMovimiento('2026-10-01', 10)
      .vendio('1', '2026-10-01', '2026-10-03')
      .construir()
    expect(h.filas.map((f) => [f.dia, f.cantidadVendida.milesimas])).toEqual([
      ['2026-10-01', 333],
      ['2026-10-02', 333],
      ['2026-10-03', 334],
    ])
    expect(h.filas[0]?.cambioNeto.milesimas).toBe(10000 - 333)
    expect(h.filas[2]?.ventas.centimos).toBe(134)
    expect(h.stock.milesimas).toBe(9000)
    expect(h.primerDia).toBe('2026-10-01')
  })

  it('deja el stock en 0 antes de los días agotados y repone después', () => {
    const h = historial()
      .primerMovimiento('2026-10-01', 5)
      .vendio(2, '2026-10-01', '2026-10-06')
      .agotadoDias(2, '2026-10-03', '2026-10-06')
      .construir()
    const porDia = Object.fromEntries(h.filas.map((f) => [f.dia, f.cambioNeto.milesimas]))
    expect(porDia['2026-10-02']).toBe(-4500)
    expect(porDia['2026-10-03']).toBeUndefined()
    expect(porDia['2026-10-05']).toBeGreaterThan(0)
    expect(h.filas.find((f) => f.dia === '2026-10-02')?.valorAjustes.centimos).toBe(-960)
  })

  it('un historial vacío no tiene filas ni stock', () => {
    expect(historial().construir()).toEqual({
      productoId: 'lejia',
      filas: [],
      stock: expect.objectContaining({ milesimas: 0 }),
      primerDia: null,
    })
  })

  it('avisa de historiales imposibles', () => {
    expect(() => historial().vendio(1, '2026-10-01').construir()).toThrow()
    expect(() =>
      historial().primerMovimiento('2026-10-01', 1).vendio(2, '2026-10-01').construir(),
    ).toThrow()
    expect(() =>
      historial()
        .primerMovimiento('2026-10-01')
        .vendio(1, '2026-10-02')
        .agotadoDias(1, '2026-10-02', '2026-10-02')
        .construir(),
    ).toThrow()
    expect(() =>
      historial()
        .primerMovimiento('2026-10-01')
        .agotadoDias(1, '2026-10-01', '2026-10-01')
        .construir(),
    ).toThrow()
  })

  it('arma una predicción con la VPD dada', () => {
    expect(prediccionCon('0.75')).toEqual({
      vendido: expect.objectContaining({ milesimas: 21000 }),
      diasValidos: 28,
    })
  })
})
