import { describe, expect, it } from 'vitest'
import { formatearDinero } from '@/shared/domain/formato'
import { nuevaOperacion } from './__pruebas__/operaciones'
import { rangoDePeriodo, resumenDePeriodo, totalesPorDia, type Periodo } from './periodos'
import { proyectarLibro } from './resumen-diario'

const HOY = '2026-10-15'
const LEJIA = { producto: 'lejia', precio: '3.50', costo: '2.40' }
const CARBON = { producto: 'carbon', precio: '4.00', costo: '2.75' }

function vender(cuando: string, cantidad: string, linea = LEJIA) {
  return nuevaOperacion('VENTA', cuando, [{ ...linea, cantidad }])
}

describe('RN-AN-03: periodos', () => {
  it.each([
    ['HOY', '2026-10-15', '2026-10-15'],
    ['AYER', '2026-10-14', '2026-10-14'],
    ['7_DIAS', '2026-10-09', '2026-10-15'],
    ['30_DIAS', '2026-09-16', '2026-10-15'],
  ] as const)('RN-AN-03: %s va de %s a %s', (periodo, desde, hasta) => {
    expect(rangoDePeriodo(periodo, HOY)).toEqual({ desde, hasta })
  })

  it.each([
    ['HOY', 'S/ 10.50'],
    ['AYER', 'S/ 7.00'],
    ['7_DIAS', 'S/ 21.00'],
    ['30_DIAS', 'S/ 56.00'],
  ] as [Periodo, string][])('RN-AN-03: las ventas de %s son %s', (periodo, ventas) => {
    const filas = proyectarLibro([
      nuevaOperacion('STOCK_INICIAL', '2026-08-01 08:00', [{ ...LEJIA, cantidad: '100' }]),
      vender('2026-10-15 09:00', '3'),
      vender('2026-10-14 17:00', '2'),
      vender('2026-10-10 12:00', '1'),
      vender('2026-09-25 12:00', '10'),
      vender('2026-09-05 12:00', '1'),
    ])
    const resumen = resumenDePeriodo(filas, rangoDePeriodo(periodo, HOY))
    expect(formatearDinero(resumen.ventas)).toBe(ventas)
  })
})

describe('RN-AN-02: resumen de un periodo', () => {
  it('RN-AN-02: ventas, ganancias, mermas y diferencias de conteo de hoy', () => {
    const filas = proyectarLibro([
      nuevaOperacion('STOCK_INICIAL', '2026-08-01 08:00', [{ ...LEJIA, cantidad: '20' }]),
      vender('2026-10-15 10:00', '4'),
      nuevaOperacion('MERMA', '2026-10-15 11:00', [{ ...LEJIA, cantidad: '1' }]),
      nuevaOperacion('AJUSTE', '2026-10-15 12:00', [{ ...LEJIA, cantidad: '-1' }]),
    ])
    const r = resumenDePeriodo(filas, rangoDePeriodo('HOY', HOY))
    expect({
      ventas: formatearDinero(r.ventas),
      costoVendido: formatearDinero(r.costoVendido),
      gananciaBruta: formatearDinero(r.gananciaBruta),
      mermas: formatearDinero(r.mermas),
      gananciaNeta: formatearDinero(r.gananciaNeta),
      diferenciasDeConteo: formatearDinero(r.diferenciasDeConteo),
    }).toEqual({
      ventas: 'S/ 14.00',
      costoVendido: 'S/ 9.60',
      gananciaBruta: 'S/ 4.40',
      mermas: 'S/ 2.40',
      gananciaNeta: 'S/ 2.00',
      diferenciasDeConteo: '-S/ 2.40',
    })
  })

  it('RN-AN-02: suma las filas de todos los productos del periodo', () => {
    const filas = proyectarLibro([
      vender('2026-10-15 10:00', '1'),
      vender('2026-10-15 10:00', '1.25', CARBON),
      vender('2026-10-13 10:00', '2', CARBON),
    ])
    const r = resumenDePeriodo(filas, rangoDePeriodo('HOY', HOY))
    expect(formatearDinero(r.ventas)).toBe('S/ 8.50')
    expect(formatearDinero(r.costoVendido)).toBe('S/ 5.84')
  })

  it('RN-AN-02: sin filas, todo es cero', () => {
    const r = resumenDePeriodo([], rangoDePeriodo('30_DIAS', HOY))
    expect(Object.values(r).every((d) => d.esCero())).toBe(true)
  })
})

describe('totales por día de la tienda', () => {
  it('RN-AN-02: agrupa por día en orden y omite los días sin ventas, mermas ni ajustes', () => {
    const filas = proyectarLibro([
      nuevaOperacion('STOCK_INICIAL', '2026-10-01 08:00', [{ ...LEJIA, cantidad: '20' }]),
      vender('2026-10-14 10:00', '1'),
      vender('2026-10-14 11:00', '1', CARBON),
      nuevaOperacion('MERMA', '2026-10-12 11:00', [{ ...LEJIA, cantidad: '1' }]),
      nuevaOperacion('AJUSTE', '2026-10-13 11:00', [{ ...LEJIA, cantidad: '1' }]),
      nuevaOperacion('INGRESO', '2026-10-13 12:00', [{ ...LEJIA, cantidad: '5' }]),
    ])
    const totales = totalesPorDia(filas)
    expect(totales.map((t) => t.dia)).toEqual(['2026-10-12', '2026-10-13', '2026-10-14'])
    expect(totales[0]).toMatchObject({
      mermas: { centimos: 240 },
      gananciaNeta: { centimos: -240 },
    })
    expect(totales[1]).toMatchObject({ diferenciasDeConteo: { centimos: 240 } })
    expect(totales[2]).toMatchObject({
      dia: '2026-10-14',
      ventas: { centimos: 750 },
      costoVendido: { centimos: 515 },
      gananciaBruta: { centimos: 235 },
      gananciaNeta: { centimos: 235 },
    })
  })
})
