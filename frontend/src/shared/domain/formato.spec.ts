import { describe, expect, it } from 'vitest'
import { Cantidad } from './cantidad'
import { Dinero } from './dinero'
import {
  formatearCantidad,
  formatearDia,
  formatearDinero,
  formatearEntero,
  formatearNumero,
  plural,
} from './formato'

describe('formato', () => {
  it('formatea soles con dos decimales y signo', () => {
    expect(formatearDinero(Dinero.deCentimos(1463))).toBe('S/ 14.63')
    expect(formatearDinero(Dinero.deCentimos(5))).toBe('S/ 0.05')
    expect(formatearDinero(Dinero.deCentimos(-480))).toBe('-S/ 4.80')
    expect(formatearDinero(Dinero.deCentimos(125000))).toBe('S/ 1,250.00')
  })
  it('formatea cantidades sin ceros sobrantes y con su unidad', () => {
    expect(formatearNumero(Cantidad.deMilesimas(1250))).toBe('1.25')
    expect(formatearNumero(Cantidad.deMilesimas(-2000))).toBe('-2')
    expect(formatearCantidad(Cantidad.deEntero(3), 'UNIDAD')).toBe('3 unid.')
    expect(formatearCantidad(Cantidad.deMilesimas(1500), 'KILO')).toBe('1.5 kg')
    expect(formatearCantidad(Cantidad.deEntero(2), 'LITRO')).toBe('2 L')
  })
  it('agrupa miles con espacio en conteos', () => {
    expect(formatearEntero(3840)).toBe('3 840')
    expect(formatearEntero(152)).toBe('152')
  })
  it('formatea días como DD/MM/AAAA', () => {
    expect(formatearDia('2026-10-15')).toBe('15/10/2026')
  })
  it('elige singular o plural', () => {
    expect(plural(1, 'producto', 'productos')).toBe('producto')
    expect(plural(3, 'producto', 'productos')).toBe('productos')
  })
})
