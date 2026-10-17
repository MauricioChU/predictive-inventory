import { describe, expect, it } from 'vitest'
import { Cantidad } from '@/shared/domain/cantidad'
import { Dinero } from '@/shared/domain/dinero'
import { esErrorDeDominio } from '@/shared/domain/errores'
import {
  leerNombre,
  leerPrecioCompra,
  leerPrecioVenta,
  leerStockInicial,
  leerStockMinimo,
} from './validaciones'

describe('leerNombre', () => {
  it('RN-CAT-01: rechaza el nombre vacío (tras recortar espacios)', () => {
    expect(() => leerNombre('   ')).toThrowError('Escribe el nombre del producto')
  })
  it('RN-CAT-01: rechaza un nombre de 1 letra', () => {
    expect(() => leerNombre('L')).toThrowError('El nombre debe tener entre 2 y 80 letras')
  })
  it('RN-CAT-01: rechaza un nombre de 81 letras', () => {
    expect(() => leerNombre('a'.repeat(81))).toThrowError(
      'El nombre debe tener entre 2 y 80 letras',
    )
  })
  it('RN-CAT-01: acepta un nombre de 80 letras', () => {
    const nombre = 'a'.repeat(80)
    expect(leerNombre(nombre)).toBe(nombre)
  })
  it('RN-CAT-01: recorta los espacios exteriores', () => {
    expect(leerNombre('  Lejía 1 L  ')).toBe('Lejía 1 L')
  })
})

describe('leerPrecioCompra', () => {
  it('RN-CAT-04: acepta "2.40"', () => {
    expect(leerPrecioCompra('2.40').igualA(Dinero.deTexto('2.40'))).toBe(true)
  })
  it('RN-CAT-04: acepta "2,40" (coma como separador decimal)', () => {
    expect(leerPrecioCompra('2,40').igualA(Dinero.deTexto('2.40'))).toBe(true)
  })
  it('RN-CAT-04: acepta "0.00"', () => {
    expect(leerPrecioCompra('0.00').esCero()).toBe(true)
  })
  it('RN-CAT-04: rechaza un precio de compra negativo', () => {
    expect(() => leerPrecioCompra('-1.00')).toThrowError(
      'El precio de compra no puede ser negativo',
    )
  })
  it('RN-CAT-04: rechaza más de dos decimales con el mensaje de Dinero.deTexto', () => {
    expect(() => leerPrecioCompra('2.405')).toThrowError('Usa como máximo dos decimales')
  })
  it('RN-CAT-04: rechaza un precio mayor a S/ 99 999.99', () => {
    expect(() => leerPrecioCompra('100000.00')).toThrowError(
      'El precio no puede pasar de S/ 99 999.99',
    )
  })
  it('RN-CAT-04: acepta exactamente S/ 99 999.99', () => {
    expect(() => leerPrecioCompra('99999.99')).not.toThrow()
  })
  it('RN-CAT-04: el error sigue siendo un ErrorDeDominio', () => {
    let error: unknown
    try {
      leerPrecioCompra('-1.00')
    } catch (e) {
      error = e
    }
    expect(esErrorDeDominio(error)).toBe(true)
  })
})

describe('leerPrecioVenta', () => {
  it('RN-CAT-04: acepta "3.50"', () => {
    expect(leerPrecioVenta('3.50').igualA(Dinero.deTexto('3.50'))).toBe(true)
  })
  it('RN-CAT-04: rechaza un precio de venta igual a cero', () => {
    expect(() => leerPrecioVenta('0.00')).toThrowError(
      'El precio de venta debe ser mayor que S/ 0.00',
    )
  })
  it('RN-CAT-04: rechaza un precio de venta negativo', () => {
    expect(() => leerPrecioVenta('-1.00')).toThrowError(
      'El precio de venta debe ser mayor que S/ 0.00',
    )
  })
  it('RN-CAT-04: rechaza un precio mayor a S/ 99 999.99', () => {
    expect(() => leerPrecioVenta('100000.00')).toThrowError(
      'El precio no puede pasar de S/ 99 999.99',
    )
  })
})

describe('leerStockMinimo', () => {
  it('RN-CAT-06: acepta 3 unidades', () => {
    expect(leerStockMinimo('3', 'UNIDAD').igualA(Cantidad.deEntero(3))).toBe(true)
  })
  it('RN-CAT-06: acepta 0 unidades', () => {
    expect(leerStockMinimo('0', 'UNIDAD').esCero()).toBe(true)
  })
  it('RN-CAT-06: rechaza decimales en UNIDAD', () => {
    expect(() => leerStockMinimo('2.5', 'UNIDAD')).toThrowError(
      'Este producto se cuenta por unidades enteras',
    )
  })
  it('RN-CAT-06: acepta decimales en KILO', () => {
    expect(leerStockMinimo('2.5', 'KILO').igualA(Cantidad.deMilesimas(2500))).toBe(true)
  })
  it('RN-CAT-06: rechaza más de tres decimales', () => {
    expect(() => leerStockMinimo('0.0005', 'KILO')).toThrowError('Usa como máximo tres decimales')
  })
  it('RN-CAT-06: rechaza un mínimo negativo', () => {
    expect(() => leerStockMinimo('-1', 'LITRO')).toThrowError(
      'El stock mínimo no puede ser negativo',
    )
  })
})

describe('leerStockInicial', () => {
  it('RN-CAT-08: texto vacío o indefinido es stock cero', () => {
    expect(leerStockInicial(undefined, 'UNIDAD').esCero()).toBe(true)
    expect(leerStockInicial('', 'UNIDAD').esCero()).toBe(true)
    expect(leerStockInicial('   ', 'UNIDAD').esCero()).toBe(true)
  })
  it('RN-CAT-08: acepta un stock inicial positivo', () => {
    expect(leerStockInicial('12', 'UNIDAD').igualA(Cantidad.deEntero(12))).toBe(true)
  })
  it('RN-CAT-08: rechaza un stock inicial negativo', () => {
    expect(() => leerStockInicial('-1', 'UNIDAD')).toThrowError(
      'El stock inicial no puede ser negativo',
    )
  })
  it('RN-CAT-08: respeta la precisión de la unidad', () => {
    expect(() => leerStockInicial('2.5', 'UNIDAD')).toThrowError(
      'Este producto se cuenta por unidades enteras',
    )
  })
})
