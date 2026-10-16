import { describe, expect, it } from 'vitest'
import { formatearProblema, leerFilas } from './importacion'

const ENCABEZADOS = [
  'nombre',
  'categoría',
  'unidad',
  'precio de compra',
  'precio de venta',
  'stock mínimo',
  'stock inicial',
]

describe('leerFilas: encabezados', () => {
  it('RN-RE-07: falta una columna obligatoria', () => {
    const sinPrecioVenta = ENCABEZADOS.filter((c) => c !== 'precio de venta')
    expect(() => leerFilas([sinPrecioVenta])).toThrow(
      'El archivo no tiene la columna "precio de venta". Usa la plantilla',
    )
  })

  it('los encabezados se comparan con normalizar (mayúsculas, tildes, espacios)', () => {
    const variados = [
      'Nombre',
      'Categoría ',
      'UNIDAD',
      'Precio De Compra',
      'precio de venta',
      'Stock Mínimo',
      'stock inicial',
    ]
    expect(() => leerFilas([variados])).not.toThrow()
  })
})

describe('leerFilas: RN-RE-07 (vista previa de importación)', () => {
  // Mismas filas del escenario de la .feature. La fila 5 (Bolsas chicas) no tiene ningún
  // problema a nivel de dominio: su único problema (CANTIDAD_ENTERA) viene del catálogo
  // (paso 4), que se valida en application/importar.spec.ts con un catálogo falso.
  const filas = [
    ENCABEZADOS,
    ['Jabón Bolívar', 'Detergentes', 'unid', '1.20', '2.00', '5', '24'],
    ['Ambientador Glade', 'Ambientadores', 'unid', '6.50', '9.00', '2', '6'],
    ['Cera roja', 'Limpiadores', 'L', '8.00', '', '1', ''],
    ['Bolsas chicas', 'Bolsas', 'unid', '0.05', '0.10', '1.5', '100'],
  ]

  it('3 filas válidas a nivel de dominio (2, 3 y 5) y 1 con problema (4)', () => {
    const { validas, conProblemas } = leerFilas(filas)
    expect(validas.map((f) => f.fila)).toEqual([2, 3, 5])
    expect(conProblemas).toEqual([{ fila: 4, problema: 'falta el precio de venta' }])
  })

  it('el mensaje final de la fila 4 es exactamente "Fila 4: falta el precio de venta"', () => {
    const { conProblemas } = leerFilas(filas)
    expect(formatearProblema(conProblemas[0]!.fila, conProblemas[0]!.problema)).toBe(
      'Fila 4: falta el precio de venta',
    )
  })

  it('la fila válida de "Bolsas chicas" queda con sus datos como se escribieron', () => {
    const { validas } = leerFilas(filas)
    const bolsas = validas.find((f) => f.nombre === 'Bolsas chicas')
    expect(bolsas).toMatchObject({
      fila: 5,
      categoriaNombre: 'Bolsas',
      unidad: 'UNIDAD',
      precioCompra: '0.05',
      precioVenta: '0.10',
      stockMinimo: '1.5',
      stockInicial: '100',
    })
  })
})

describe('leerFilas: RN-RE-08 (repetidos dentro del archivo y categorías nuevas)', () => {
  const filas = [
    ENCABEZADOS,
    ['lejia 1 l', 'Otros', 'unid', '2.40', '3.50', '3', ''],
    ['Detergente', 'Detergentes', 'kg', '5.30', '7.90', '2', '10'],
    ['detergente', 'Detergentes', 'kg', '5.30', '7.90', '2', ''],
  ]

  it('2 válidas a nivel de dominio (2 y 3) y la fila 4 repetida contra la fila 3', () => {
    const { validas, conProblemas } = leerFilas(filas)
    expect(validas.map((f) => f.fila)).toEqual([2, 3])
    expect(conProblemas).toEqual([{ fila: 4, problema: '"detergente" está repetido en la fila 3' }])
  })

  it('el mensaje final usa el nombre tal cual se escribió en la fila repetida', () => {
    const { conProblemas } = leerFilas(filas)
    expect(formatearProblema(conProblemas[0]!.fila, conProblemas[0]!.problema)).toBe(
      'Fila 4: "detergente" está repetido en la fila 3',
    )
  })
})

describe('leerFilas: filas vacías, requeridos y unidades', () => {
  it('ignora filas totalmente vacías', () => {
    const filas = [
      ENCABEZADOS,
      ['', '', '', '', '', '', ''],
      ['X', 'Otros', 'unid', '1', '2', '1', ''],
    ]
    const { validas, conProblemas } = leerFilas(filas)
    expect(conProblemas).toEqual([])
    expect(validas.map((f) => f.fila)).toEqual([3])
  })

  it.each([
    [['', 'Otros', 'unid', '1', '2', '1', ''], 'falta el nombre'],
    [['X', '', 'unid', '1', '2', '1', ''], 'falta la categoría'],
    [['X', 'Otros', '', '1', '2', '1', ''], 'falta la unidad'],
    [['X', 'Otros', 'unid', '', '2', '1', ''], 'falta el precio de compra'],
    [['X', 'Otros', 'unid', '1', '', '1', ''], 'falta el precio de venta'],
    [['X', 'Otros', 'unid', '1', '2', '', ''], 'falta el stock mínimo'],
  ])('requerido vacío: %s → %s', (fila, mensaje) => {
    const { conProblemas } = leerFilas([ENCABEZADOS, fila])
    expect(conProblemas).toEqual([{ fila: 2, problema: mensaje }])
  })

  it.each([
    ['unid', 'UNIDAD'],
    ['unidad', 'UNIDAD'],
    ['unidades', 'UNIDAD'],
    ['u', 'UNIDAD'],
    ['kg', 'KILO'],
    ['kilo', 'KILO'],
    ['kilos', 'KILO'],
    ['l', 'LITRO'],
    ['lt', 'LITRO'],
    ['litro', 'LITRO'],
    ['litros', 'LITRO'],
    ['Kg', 'KILO'],
    ['L', 'LITRO'],
  ])('unidad válida: "%s" → %s', (texto, unidad) => {
    const { validas } = leerFilas([ENCABEZADOS, ['X', 'Otros', texto, '1', '2', '1', '']])
    expect(validas[0]?.unidad).toBe(unidad)
  })

  it('unidad inválida', () => {
    const { conProblemas } = leerFilas([ENCABEZADOS, ['X', 'Otros', 'bolsas', '1', '2', '1', '']])
    expect(conProblemas).toEqual([
      { fila: 2, problema: 'la unidad "bolsas" no es válida: usa unid, kg o L' },
    ])
  })

  it('stock inicial en blanco queda como undefined', () => {
    const { validas } = leerFilas([ENCABEZADOS, ['X', 'Otros', 'unid', '1', '2', '1', '']])
    expect(validas[0]?.stockInicial).toBeUndefined()
  })
})

describe('leerFilas: columna "stock inicial" opcional y "unid."', () => {
  it('una hoja sin la columna "stock inicial" se acepta y no trae stock inicial', () => {
    const sinStock = ENCABEZADOS.filter((c) => c !== 'stock inicial')
    const { validas, conProblemas } = leerFilas([sinStock, ['X', 'Otros', 'unid', '1', '2', '1']])
    expect(conProblemas).toEqual([])
    expect(validas[0]?.stockInicial).toBeUndefined()
  })

  it('una fila más corta (sin la celda de stock inicial) se acepta', () => {
    const { validas } = leerFilas([ENCABEZADOS, ['X', 'Otros', 'unid', '1', '2', '1']])
    expect(validas).toHaveLength(1)
  })

  it.each(['unid.', 'Unid.', 'UNID'])('acepta "%s" como unidad', (texto) => {
    const { validas } = leerFilas([ENCABEZADOS, ['X', 'Otros', texto, '1', '2', '1', '']])
    expect(validas[0]?.unidad).toBe('UNIDAD')
  })
})
