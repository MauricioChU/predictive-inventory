import { describe, expect, it } from 'vitest'
import { Cantidad } from '@/shared/domain/cantidad'
import { Dinero } from '@/shared/domain/dinero'
import { anulacionDe, nuevaOperacion } from './__pruebas__/operaciones'
import {
  aportesDeAnulacion,
  aportesDeOperacion,
  claveDeResumen,
  esFilaSinMovimiento,
  proyectarLibro,
  ResumenDiario,
} from './resumen-diario'

const LEJIA = { producto: 'lejia', precio: '3.50', costo: '2.40' }
const CARBON = { producto: 'carbon', precio: '4.00', costo: '2.75' }
const DETERGENTE = { producto: 'detergente', precio: '7.90', costo: '5.30' }

function porClave(filas: readonly ResumenDiario[]) {
  return Object.fromEntries(filas.map((f) => [f.clave, f.aRegistro()]))
}

describe('ResumenDiario', () => {
  it('la clave es productoId|día', () => {
    expect(claveDeResumen('lejia', '2026-10-15')).toBe('lejia|2026-10-15')
    expect(ResumenDiario.vacio('lejia', '2026-10-15').clave).toBe('lejia|2026-10-15')
  })

  it('una fila vacía está en ceros y vuelve igual desde su registro', () => {
    const vacia = ResumenDiario.vacio('lejia', '2026-10-15')
    expect(vacia.aRegistro()).toEqual({
      clave: 'lejia|2026-10-15',
      productoId: 'lejia',
      dia: '2026-10-15',
      lineasVendidas: 0,
      cantidadVendida: 0,
      ventas: 0,
      costoVendido: 0,
      costoMermas: 0,
      valorAjustes: 0,
      cambioNeto: 0,
    })
    const fila = ResumenDiario.crear({
      productoId: 'lejia',
      dia: '2026-10-15',
      lineasVendidas: 2,
      cantidadVendida: Cantidad.deEntero(3),
      ventas: Dinero.deCentimos(1050),
      costoVendido: Dinero.deCentimos(720),
      costoMermas: Dinero.deCentimos(240),
      valorAjustes: Dinero.deCentimos(-240),
      cambioNeto: Cantidad.deEntero(-5),
    })
    expect(ResumenDiario.desdeRegistro(fila.aRegistro())).toEqual(fila)
    expect(fila.gananciaBruta.centimos).toBe(330)
    expect(fila.tieneVentas).toBe(true)
    expect(vacia.tieneVentas).toBe(false)
  })

  it('RN-OP-17: una fila es "sin movimiento" solo si todo está en cero (lo que deja una anulación del mismo día)', () => {
    const venta = nuevaOperacion('VENTA', '2026-10-15 10:00', [{ ...LEJIA, cantidad: '2' }])
    const filas = proyectarLibro([venta, anulacionDe(venta, '2026-10-15 10:05')])
    expect(filas.map((f) => esFilaSinMovimiento(f.aRegistro()))).toEqual([true])
    const cero = ResumenDiario.vacio('lejia', '2026-10-15').aRegistro()
    for (const campo of [
      'lineasVendidas',
      'cantidadVendida',
      'ventas',
      'costoVendido',
      'costoMermas',
      'valorAjustes',
      'cambioNeto',
    ] as const) {
      expect(esFilaSinMovimiento({ ...cero, [campo]: 1 })).toBe(false)
    }
  })

  it('no suma filas de distinto producto o día', () => {
    const a = ResumenDiario.vacio('lejia', '2026-10-15')
    expect(() => a.sumar(ResumenDiario.vacio('lejia', '2026-10-14'))).toThrow()
    expect(() => a.sumar(ResumenDiario.vacio('carbon', '2026-10-15'))).toThrow()
  })
})

describe('aportes de una operación a la proyección', () => {
  it('RN-OP-11: el mismo producto en dos líneas cuenta una sola "vez vendido" y suma todo', () => {
    const venta = nuevaOperacion('VENTA', '2026-10-15 10:00', [
      { ...LEJIA, cantidad: '4' },
      { ...LEJIA, cantidad: '1' },
    ])
    const aportes = aportesDeOperacion(venta).filter((a) => a.productoId === 'lejia')
    expect(aportes.reduce((suma, a) => suma + a.lineasVendidas, 0)).toBe(1)
    expect(aportes.reduce((suma, a) => suma + a.cantidadVendida.milesimas, 0)).toBe(5000)
  })

  it('RN-AN-02: una venta de tres líneas suma bien por producto y día', () => {
    const venta = nuevaOperacion('VENTA', '2026-10-15 10:00', [
      { ...LEJIA, cantidad: '2' },
      { ...CARBON, cantidad: '1.25' },
      { ...DETERGENTE, cantidad: '0.333' },
    ])
    const filas = porClave(aportesDeOperacion(venta))
    expect(filas['lejia|2026-10-15']).toMatchObject({
      lineasVendidas: 1,
      cantidadVendida: 2000,
      ventas: 700,
      costoVendido: 480,
      cambioNeto: -2000,
    })
    expect(filas['carbon|2026-10-15']).toMatchObject({
      lineasVendidas: 1,
      cantidadVendida: 1250,
      ventas: 500,
      costoVendido: 344,
      cambioNeto: -1250,
    })
    expect(filas['detergente|2026-10-15']).toMatchObject({
      lineasVendidas: 1,
      cantidadVendida: 333,
      ventas: 263,
      costoVendido: 176,
      cambioNeto: -333,
    })
  })

  it('RN-AN-02: una merma suma su costo en costoMermas, no en ventas', () => {
    const merma = nuevaOperacion('MERMA', '2026-10-15 11:00', [{ ...LEJIA, cantidad: '1' }])
    const [fila] = aportesDeOperacion(merma)
    expect(fila?.aRegistro()).toMatchObject({
      lineasVendidas: 0,
      ventas: 0,
      costoMermas: 240,
      valorAjustes: 0,
      cambioNeto: -1000,
    })
  })

  it('RN-AN-02: un ajuste de −1 de Lejía vale −S/ 2.40 en valorAjustes', () => {
    const ajuste = nuevaOperacion('AJUSTE', '2026-10-15 12:00', [{ ...LEJIA, cantidad: '-1' }])
    const [fila] = aportesDeOperacion(ajuste)
    expect(fila?.aRegistro()).toMatchObject({
      valorAjustes: -240,
      costoMermas: 0,
      cambioNeto: -1000,
    })
  })

  it('el stock inicial y los ingresos solo cambian el stock del día', () => {
    const inicial = nuevaOperacion('STOCK_INICIAL', '2026-08-01 09:00', [
      { ...LEJIA, cantidad: '20' },
    ])
    const ingreso = nuevaOperacion('INGRESO', '2026-08-02 09:00', [{ ...LEJIA, cantidad: '10' }])
    expect(aportesDeOperacion(inicial)[0]?.aRegistro()).toEqual({
      ...ResumenDiario.vacio('lejia', '2026-08-01').aRegistro(),
      cambioNeto: 20000,
    })
    expect(aportesDeOperacion(ingreso)[0]?.aRegistro()).toEqual({
      ...ResumenDiario.vacio('lejia', '2026-08-02').aRegistro(),
      cambioNeto: 10000,
    })
  })

  it('RN-OP-09: una operación con fecha pasada cae en el día en que ocurrió', () => {
    const venta = nuevaOperacion('VENTA', '2026-10-12 19:30', [{ ...LEJIA, cantidad: '1' }], {
      registradaEn: '2026-10-15 09:00',
    })
    expect(aportesDeOperacion(venta)[0]?.dia).toBe('2026-10-12')
  })

  it('RN-AN-01: el día es el de la tienda (America/Lima), no el de UTC', () => {
    const venta = nuevaOperacion('VENTA', '2026-10-15 23:30', [{ ...LEJIA, cantidad: '1' }])
    expect(aportesDeOperacion(venta)[0]?.dia).toBe('2026-10-15')
  })

  it('RN-AN-01: anular una venta de hoy deja sus métricas en 0 y el cambio neto en 0', () => {
    const venta = nuevaOperacion('VENTA', '2026-10-15 10:00', [{ ...LEJIA, cantidad: '3' }])
    const anulacion = anulacionDe(venta, '2026-10-15 10:05')
    const [fila] = proyectarLibro([venta, anulacion])
    expect(fila?.aRegistro()).toEqual(ResumenDiario.vacio('lejia', '2026-10-15').aRegistro())
  })

  it('RN-AN-01: anular hoy una venta de ayer quita las métricas de ayer y mueve el stock en cada día', () => {
    const venta = nuevaOperacion('VENTA', '2026-10-14 17:00', [{ ...LEJIA, cantidad: '2' }])
    const anulacion = anulacionDe(venta, '2026-10-15 09:00')
    const filas = porClave(aportesDeAnulacion(venta, anulacion))
    expect(filas['lejia|2026-10-14']).toEqual({
      ...ResumenDiario.vacio('lejia', '2026-10-14').aRegistro(),
      lineasVendidas: -1,
      cantidadVendida: -2000,
      ventas: -700,
      costoVendido: -480,
    })
    expect(filas['lejia|2026-10-15']).toEqual({
      ...ResumenDiario.vacio('lejia', '2026-10-15').aRegistro(),
      cambioNeto: 2000,
    })

    const libro = porClave(proyectarLibro([venta, anulacion]))
    expect(libro['lejia|2026-10-14']).toEqual({
      ...ResumenDiario.vacio('lejia', '2026-10-14').aRegistro(),
      cambioNeto: -2000,
    })
    expect(libro['lejia|2026-10-15']).toEqual({
      ...ResumenDiario.vacio('lejia', '2026-10-15').aRegistro(),
      cambioNeto: 2000,
    })
  })

  it('RN-AN-01: anular una merma o un ajuste también quita su valor', () => {
    const merma = nuevaOperacion('MERMA', '2026-10-15 10:00', [{ ...LEJIA, cantidad: '1' }])
    const ajuste = nuevaOperacion('AJUSTE', '2026-10-15 11:00', [{ ...LEJIA, cantidad: '-1' }])
    const [fila] = proyectarLibro([
      merma,
      ajuste,
      anulacionDe(merma, '2026-10-15 12:00'),
      anulacionDe(ajuste, '2026-10-15 12:01'),
    ])
    expect(fila?.aRegistro()).toEqual(ResumenDiario.vacio('lejia', '2026-10-15').aRegistro())
  })

  it('el libro se recorre por fecha de registro, sin importar el orden de la lista', () => {
    const venta = nuevaOperacion('VENTA', '2026-10-15 10:00', [{ ...LEJIA, cantidad: '3' }])
    const anulacion = anulacionDe(venta, '2026-10-15 10:05')
    const otra = nuevaOperacion('VENTA', '2026-10-15 10:00', [{ ...LEJIA, cantidad: '1' }])
    const enOrden = porClave(proyectarLibro([venta, otra, anulacion]))
    expect(porClave(proyectarLibro([anulacion, otra, venta]))).toEqual(enOrden)
    expect(enOrden['lejia|2026-10-15']).toMatchObject({ lineasVendidas: 1, ventas: 350 })
  })

  it('una anulación cuya original no está en el libro solo mueve el stock', () => {
    const venta = nuevaOperacion('VENTA', '2026-10-14 10:00', [{ ...LEJIA, cantidad: '2' }])
    const [fila] = proyectarLibro([anulacionDe(venta, '2026-10-15 09:00')])
    expect(fila?.aRegistro()).toEqual({
      ...ResumenDiario.vacio('lejia', '2026-10-15').aRegistro(),
      cambioNeto: 2000,
    })
  })
})
