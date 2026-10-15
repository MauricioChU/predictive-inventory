import { describe, expect, it } from 'vitest'
import { Cantidad } from '../../../shared/domain/cantidad'
import { Dinero } from '../../../shared/domain/dinero'
import type { TotalesDeDia } from '../../../shared/contratos/entre-modulos'
import { hojaDeMovimientos, hojaDeProductos, hojaDeResumen, PLANTILLA } from './hojas-de-excel'

describe('hojaDeProductos (RN-RE-01)', () => {
  it('arma la fila de un producto con sus columnas en orden', () => {
    const hoja = hojaDeProductos([
      {
        nombre: 'Lejía 1 L',
        categoriaNombre: 'Otros',
        unidad: 'UNIDAD',
        precioCompra: Dinero.deTexto('2.40'),
        precioVenta: Dinero.deTexto('3.50'),
        stock: Cantidad.deEntero(8),
        stockMinimo: Cantidad.deEntero(3),
        estado: 'NORMAL',
        activo: true,
      },
    ])

    expect(hoja.nombre).toBe('Productos')
    expect(hoja.columnas).toEqual([
      'nombre',
      'categoría',
      'unidad',
      'precio de compra',
      'precio de venta',
      'stock',
      'stock mínimo',
      'estado de stock',
      'activo/archivado',
    ])
    expect(hoja.filas).toEqual([
      [
        { valor: 'Lejía 1 L' },
        { valor: 'Otros' },
        { valor: 'unid.' },
        { valor: 2.4, formato: '0.00' },
        { valor: 3.5, formato: '0.00' },
        { valor: 8, formato: '0.###' },
        { valor: 3, formato: '0.###' },
        { valor: 'Bien' },
        { valor: 'activo' },
      ],
    ])
  })

  it('un producto archivado no tiene estado de stock', () => {
    const hoja = hojaDeProductos([
      {
        nombre: 'Viejo',
        categoriaNombre: 'Otros',
        unidad: 'UNIDAD',
        precioCompra: Dinero.cero(),
        precioVenta: Dinero.cero(),
        stock: Cantidad.cero(),
        stockMinimo: Cantidad.cero(),
        estado: null,
        activo: false,
      },
    ])
    expect(hoja.filas[0]?.[7]).toEqual({ valor: '' })
    expect(hoja.filas[0]?.[8]).toEqual({ valor: 'archivado' })
  })

  it('traduce AGOTADO y POR_ACABARSE a los textos de la spec', () => {
    const base = {
      nombre: 'X',
      categoriaNombre: 'Otros',
      unidad: 'UNIDAD' as const,
      precioCompra: Dinero.cero(),
      precioVenta: Dinero.cero(),
      stock: Cantidad.cero(),
      stockMinimo: Cantidad.cero(),
      activo: true,
    }
    const hoja = hojaDeProductos([
      { ...base, estado: 'AGOTADO' },
      { ...base, estado: 'POR_ACABARSE' },
    ])
    expect(hoja.filas[0]?.[7]).toEqual({ valor: 'Agotado' })
    expect(hoja.filas[1]?.[7]).toEqual({ valor: 'Queda poco' })
  })
})

describe('hojaDeMovimientos', () => {
  it('RN-RE-01: una fila por movimiento', () => {
    const hoja = hojaDeMovimientos([
      {
        ocurridaEn: '2026-10-15T20:30:00.000Z',
        tipo: 'VENTA',
        productoNombre: 'Lejía 1 L',
        cantidad: Cantidad.deEntero(-2),
        precioUnitario: Dinero.deTexto('3.50'),
        costoUnitario: Dinero.deTexto('2.40'),
        importe: Dinero.deTexto('7.00'),
        anulada: false,
        nota: null,
      },
      {
        ocurridaEn: '2026-10-01T05:00:00.000Z',
        tipo: 'STOCK_INICIAL',
        productoNombre: 'Lejía 1 L',
        cantidad: Cantidad.deEntero(10),
        precioUnitario: null,
        costoUnitario: Dinero.deTexto('2.40'),
        importe: Dinero.deTexto('24.00'),
        anulada: false,
        nota: null,
      },
    ])

    expect(hoja.nombre).toBe('Movimientos')
    expect(hoja.columnas).toEqual([
      'fecha',
      'tipo',
      'producto',
      'cantidad',
      'precio',
      'costo',
      'importe',
      'anulada',
      'nota',
    ])
    expect(hoja.filas).toHaveLength(2)
    expect(hoja.filas[0]).toEqual([
      { valor: '15/10/2026 15:30' },
      { valor: 'VENTA' },
      { valor: 'Lejía 1 L' },
      { valor: -2, formato: '0.###' },
      { valor: 3.5, formato: '0.00' },
      { valor: 2.4, formato: '0.00' },
      { valor: 7, formato: '0.00' },
      { valor: 'no' },
      { valor: '' },
    ])
    expect(hoja.filas[1]?.[4]).toEqual({ valor: '' })
  })

  it('marca "sí" en la columna anulada cuando corresponde', () => {
    const hoja = hojaDeMovimientos([
      {
        ocurridaEn: '2026-10-15T20:30:00.000Z',
        tipo: 'VENTA',
        productoNombre: 'X',
        cantidad: Cantidad.deEntero(-1),
        precioUnitario: Dinero.cero(),
        costoUnitario: Dinero.cero(),
        importe: Dinero.cero(),
        anulada: true,
        nota: 'Se anuló por error',
      },
    ])
    expect(hoja.filas[0]?.[7]).toEqual({ valor: 'sí' })
    expect(hoja.filas[0]?.[8]).toEqual({ valor: 'Se anuló por error' })
  })
})

describe('hojaDeResumen', () => {
  it('RN-RE-01: fila "15/10/2026 | 7.00 | 2.20 | 0.00 | 2.20"', () => {
    const dias: TotalesDeDia[] = [
      {
        dia: '2026-10-15',
        ventas: Dinero.deTexto('7.00'),
        costoVendido: Dinero.deTexto('4.80'),
        gananciaBruta: Dinero.deTexto('2.20'),
        mermas: Dinero.cero(),
        gananciaNeta: Dinero.deTexto('2.20'),
        diferenciasDeConteo: Dinero.cero(),
      },
    ]
    const hoja = hojaDeResumen(dias)
    expect(hoja.nombre).toBe('Resumen diario')
    expect(hoja.columnas).toEqual(['fecha', 'ventas', 'ganancia bruta', 'mermas', 'ganancia neta'])
    expect(hoja.filas).toEqual([
      [
        { valor: '15/10/2026' },
        { valor: 7, formato: '0.00' },
        { valor: 2.2, formato: '0.00' },
        { valor: 0, formato: '0.00' },
        { valor: 2.2, formato: '0.00' },
      ],
    ])
  })
})

describe('PLANTILLA (RN-RE-07)', () => {
  it('tiene la hoja Productos con las columnas exactas y sin filas', () => {
    const productos = PLANTILLA.find((h) => h.nombre === 'Productos')
    expect(productos?.columnas).toEqual([
      'nombre',
      'categoría',
      'unidad',
      'precio de compra',
      'precio de venta',
      'stock mínimo',
      'stock inicial',
    ])
    expect(productos?.filas).toEqual([])
  })

  it('tiene una hoja Instrucciones con una fila por columna', () => {
    const instrucciones = PLANTILLA.find((h) => h.nombre === 'Instrucciones')
    expect(instrucciones?.filas).toHaveLength(7)
    const filaUnidad = instrucciones?.filas.find((f) => f[0]?.valor === 'unidad')
    expect(String(filaUnidad?.[1]?.valor)).toMatch(/unid.*kg.*L/i)
  })
})
