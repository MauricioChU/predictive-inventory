import { describe, expect, it } from 'vitest'
import { Cantidad } from '@/shared/domain/cantidad'
import { Dinero } from '@/shared/domain/dinero'
import { instanteLocal } from '@/shared/domain/fecha'
import type { OperacionRegistro } from '@/shared/contratos/registros'
import { Operacion } from './operacion'
import { resultadoDe } from '../__pruebas__/resultado'

const soles = (texto: string) => Dinero.deTexto(texto)
const kilos = (texto: string) => Cantidad.deTexto(texto, 'KILO')
const unidades = (n: number) => Cantidad.deEntero(n)
const AHORA = instanteLocal('2026-10-15 10:00')

const datos = (id = 'op-1') => ({
  id,
  ocurridaEn: AHORA,
  registradaEn: AHORA,
  dispositivoId: 'disp-1',
})

const ventaDeTresLineas = () =>
  Operacion.venta(datos(), [
    {
      productoId: 'lejia',
      cantidad: unidades(2),
      precioUnitario: soles('3.50'),
      costoUnitario: soles('2.40'),
    },
    {
      productoId: 'carbon',
      cantidad: kilos('1.25'),
      precioUnitario: soles('4.00'),
      costoUnitario: soles('2.75'),
    },
    {
      productoId: 'detergente',
      cantidad: kilos('0.333'),
      precioUnitario: soles('7.90'),
      costoUnitario: soles('5.30'),
    },
  ])

describe('Operacion.venta', () => {
  it('RN-OP-10 / RN-OP-12: guarda precio y costo, y calcula importe, costo total y ganancia por línea', () => {
    const venta = ventaDeTresLineas()
    const lineas = venta.lineas().map((l) => ({
      productoId: l.productoId,
      cantidad: l.cantidad.milesimas,
      precio: l.precioUnitario?.centimos,
      costo: l.costoUnitario.centimos,
      importe: l.importe?.centimos,
      costoTotal: l.costoTotal.centimos,
      ganancia: l.ganancia?.centimos,
    }))
    expect(lineas).toEqual([
      {
        productoId: 'lejia',
        cantidad: -2000,
        precio: 350,
        costo: 240,
        importe: 700,
        costoTotal: 480,
        ganancia: 220,
      },
      {
        productoId: 'carbon',
        cantidad: -1250,
        precio: 400,
        costo: 275,
        importe: 500,
        costoTotal: 344,
        ganancia: 156,
      },
      {
        productoId: 'detergente',
        cantidad: -333,
        precio: 790,
        costo: 530,
        importe: 263,
        costoTotal: 176,
        ganancia: 87,
      },
    ])
    expect(venta.total()).toEqual(soles('14.63'))
    expect(venta.ganancia()).toEqual(soles('4.63'))
  })

  it('RN-OP-11: con precio especial 3.00, el total es S/ 6.00 y la ganancia S/ 1.20', () => {
    const venta = Operacion.venta(datos(), [
      {
        productoId: 'lejia',
        cantidad: unidades(2),
        precioUnitario: soles('3.00'),
        costoUnitario: soles('2.40'),
      },
    ])
    expect(venta.total()).toEqual(soles('6.00'))
    expect(venta.ganancia()).toEqual(soles('1.20'))
  })

  it('RN-OP-11: el precio de venta debe ser mayor que S/ 0.00', () => {
    expect(() =>
      Operacion.venta(datos(), [
        {
          productoId: 'lejia',
          cantidad: unidades(2),
          precioUnitario: Dinero.cero(),
          costoUnitario: soles('2.40'),
        },
      ]),
    ).toThrow('El precio de venta debe ser mayor que S/ 0.00')
  })

  it('RN-OP-03: cada línea tiene una cantidad mayor que 0 y no mayor a 99 999', () => {
    const linea = (cantidad: Cantidad) => [
      {
        productoId: 'lejia',
        cantidad,
        precioUnitario: soles('3.50'),
        costoUnitario: soles('2.40'),
      },
    ]
    expect(() => Operacion.venta(datos(), linea(Cantidad.cero()))).toThrow(
      'La cantidad debe ser mayor que 0',
    )
    expect(() => Operacion.venta(datos(), linea(unidades(100_000)))).toThrow(
      'La cantidad no puede pasar de 99 999',
    )
  })

  it('RN-OP-02: una venta es inmutable (los movimientos no se pueden cambiar desde afuera)', () => {
    const venta = ventaDeTresLineas()
    expect(Object.isFrozen(venta.movimientos)).toBe(true)
    expect(Object.isFrozen(venta.movimientos[0])).toBe(true)
    expect(venta.productoIds).toEqual(['lejia', 'carbon', 'detergente'])
  })
})

describe('Operacion.ingreso, merma, ajuste y stock inicial', () => {
  it('INGRESO: cantidades positivas con el costo de cada línea, sin precio ni total', () => {
    const ingreso = Operacion.ingreso(datos(), [
      { productoId: 'lejia', cantidad: unidades(6), costoUnitario: soles('2.60') },
    ])
    expect(ingreso.tipo).toBe('INGRESO')
    expect(ingreso.movimientos).toEqual([
      {
        productoId: 'lejia',
        cantidad: unidades(6),
        costoUnitario: soles('2.60'),
        precioUnitario: null,
      },
    ])
    expect(ingreso.lineas()[0]).toMatchObject({
      importe: null,
      ganancia: null,
      costoTotal: soles('15.60'),
    })
    expect(ingreso.total()).toBeNull()
    expect(ingreso.ganancia()).toBeNull()
  })

  it('RN-OP-14: el costo de un ingreso no puede ser negativo', () => {
    expect(() =>
      Operacion.ingreso(datos(), [
        { productoId: 'lejia', cantidad: unidades(6), costoUnitario: soles('-1.00') },
      ]),
    ).toThrow('El precio de compra no puede ser negativo')
  })

  it('RN-OP-15: una merma resta la cantidad y guarda el motivo', () => {
    const merma = Operacion.merma(
      { ...datos(), motivo: 'Se derramó' },
      {
        productoId: 'lejia',
        cantidad: unidades(2),
        costoUnitario: soles('2.40'),
      },
    )
    expect(merma.tipo).toBe('MERMA')
    expect(merma.motivo).toBe('Se derramó')
    expect(merma.movimientos[0]?.cantidad).toEqual(unidades(-2))
    expect(merma.lineas()[0]?.costoTotal).toEqual(soles('4.80'))
  })

  it.each([
    ['Se venció', '', 'registrada'],
    ['Otro', 'Se lo llevó un niño', 'registrada'],
    ['Otro', '', 'error: Cuéntanos qué pasó'],
    ['', '', 'error: Elige qué pasó con el producto'],
  ])('RN-OP-15: merma con motivo "%s" y nota "%s" → %s', (motivo, nota, resultado) => {
    const crear = () =>
      Operacion.merma(
        { ...datos(), motivo, nota },
        {
          productoId: 'lejia',
          cantidad: unidades(1),
          costoUnitario: soles('2.40'),
        },
      )
    expect(resultadoDe(crear)).toBe(resultado)
  })

  it('RN-OP-15: con motivo "Otro" guarda la nota', () => {
    const merma = Operacion.merma(
      { ...datos(), motivo: 'Otro', nota: ' Se lo llevó un niño ' },
      { productoId: 'lejia', cantidad: unidades(1), costoUnitario: soles('2.40') },
    )
    expect(merma.nota).toBe('Se lo llevó un niño')
  })

  it('RN-OP-16: un ajuste guarda la diferencia con signo y su motivo', () => {
    const ajuste = Operacion.ajuste(
      { ...datos(), motivo: 'Conteo de stock' },
      {
        productoId: 'lejia',
        diferencia: unidades(-2),
        costoUnitario: soles('2.40'),
      },
    )
    expect(ajuste.tipo).toBe('AJUSTE')
    expect(ajuste.movimientos[0]?.cantidad).toEqual(unidades(-2))
    expect(ajuste.lineas()[0]?.costoTotal).toEqual(soles('4.80'))
  })

  it('RN-OP-16: un ajuste sin diferencia no existe', () => {
    expect(() =>
      Operacion.ajuste(
        { ...datos(), motivo: 'Conteo de stock' },
        {
          productoId: 'lejia',
          diferencia: Cantidad.cero(),
          costoUnitario: soles('2.40'),
        },
      ),
    ).toThrow('Un movimiento no puede tener cantidad 0')
  })

  it('STOCK_INICIAL: suma la cantidad con el costo recibido', () => {
    const inicial = Operacion.stockInicial(datos(), {
      productoId: 'lejia',
      cantidad: unidades(10),
      costoUnitario: soles('2.40'),
    })
    expect(inicial.tipo).toBe('STOCK_INICIAL')
    expect(inicial.movimientos[0]).toEqual({
      productoId: 'lejia',
      cantidad: unidades(10),
      costoUnitario: soles('2.40'),
      precioUnitario: null,
    })
  })
})

describe('invariantes', () => {
  it('RN-OP-07: una operación no repite un producto', () => {
    expect(() =>
      Operacion.ingreso(datos(), [
        { productoId: 'lejia', cantidad: unidades(1), costoUnitario: soles('2.40') },
        { productoId: 'lejia', cantidad: unidades(2), costoUnitario: soles('2.40') },
      ]),
    ).toThrow('La operación repite el producto lejia')
  })

  it('una operación tiene al menos un movimiento', () => {
    expect(() => Operacion.ingreso(datos(), [])).toThrow(
      'Una operación necesita al menos un movimiento',
    )
  })

  it('la nota tiene como máximo 200 caracteres', () => {
    expect(() =>
      Operacion.ingreso({ ...datos(), nota: 'x'.repeat(201) }, [
        { productoId: 'lejia', cantidad: unidades(1), costoUnitario: soles('2.40') },
      ]),
    ).toThrow('La nota puede tener hasta 200 caracteres')
  })
})

describe('Operacion.anulacionDe', () => {
  it('RN-OP-17: invierte todos los movimientos, conserva los costos y apunta a la original', () => {
    const venta = ventaDeTresLineas()
    const anulacion = Operacion.anulacionDe(venta, { ...datos('op-2'), motivo: '  Me equivoqué ' })
    expect(anulacion.tipo).toBe('ANULACION')
    expect(anulacion.anulaA).toBe('op-1')
    expect(anulacion.motivo).toBe('Me equivoqué')
    expect(anulacion.movimientos.map((m) => [m.productoId, m.cantidad.milesimas])).toEqual([
      ['lejia', 2000],
      ['carbon', 1250],
      ['detergente', 333],
    ])
    expect(anulacion.movimientos.map((m) => m.costoUnitario.centimos)).toEqual([240, 275, 530])
    expect(anulacion.movimientos.every((m) => m.precioUnitario === null)).toBe(true)
    expect(anulacion.total()).toBeNull()
  })

  it('RN-OP-18: sin motivo, la anulación queda sin motivo', () => {
    const anulacion = Operacion.anulacionDe(ventaDeTresLineas(), datos('op-2'))
    expect(anulacion.motivo).toBeNull()
  })

  it('RN-OP-17: una anulación no se puede anular', () => {
    const anulacion = Operacion.anulacionDe(ventaDeTresLineas(), datos('op-2'))
    expect(() => Operacion.anulacionDe(anulacion, datos('op-3'))).toThrow(
      'Una anulación no se puede anular. Registra la operación de nuevo',
    )
  })
})

describe('registros', () => {
  it('aRegistro guarda céntimos y milésimas, con el índice de productos', () => {
    const merma = Operacion.merma(
      { ...datos(), motivo: 'Otro', nota: 'Se lo llevó un niño' },
      { productoId: 'carbon', cantidad: kilos('0.5'), costoUnitario: soles('2.75') },
    )
    expect(merma.aRegistro()).toEqual<OperacionRegistro>({
      id: 'op-1',
      tipo: 'MERMA',
      movimientos: [
        { productoId: 'carbon', cantidad: -500, costoUnitario: 275, precioUnitario: null },
      ],
      productoIds: ['carbon'],
      ocurridaEn: AHORA,
      registradaEn: AHORA,
      motivo: 'Otro',
      nota: 'Se lo llevó un niño',
      anulaA: null,
      dispositivoId: 'disp-1',
    })
  })

  it('desdeRegistro y aRegistro son inversas', () => {
    const venta = ventaDeTresLineas()
    const anulacion = Operacion.anulacionDe(venta, { ...datos('op-2'), motivo: 'Error' })
    for (const operacion of [venta, anulacion]) {
      const registro = operacion.aRegistro()
      const reconstruida = Operacion.desdeRegistro(registro)
      expect(reconstruida.aRegistro()).toEqual(registro)
      expect(reconstruida.total()).toEqual(operacion.total())
    }
  })

  it('expone los datos comunes', () => {
    const venta = ventaDeTresLineas()
    expect({
      id: venta.id,
      ocurridaEn: venta.ocurridaEn,
      registradaEn: venta.registradaEn,
      dispositivoId: venta.dispositivoId,
      nota: venta.nota,
      motivo: venta.motivo,
      anulaA: venta.anulaA,
    }).toEqual({
      id: 'op-1',
      ocurridaEn: AHORA,
      registradaEn: AHORA,
      dispositivoId: 'disp-1',
      nota: null,
      motivo: null,
      anulaA: null,
    })
  })
})
