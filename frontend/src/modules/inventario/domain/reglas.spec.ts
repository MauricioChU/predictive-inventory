import { describe, expect, it } from 'vitest'
import { Cantidad } from '@/shared/domain/cantidad'
import { Dinero } from '@/shared/domain/dinero'
import { instanteLocal } from '@/shared/domain/fecha'
import type { OperacionRegistro } from '@/shared/contratos/registros'
import {
  diferenciasDeExistencias,
  exigirOperacion,
  exigirProducto,
  exigirProductoActivo,
  fusionarLineas,
  leerCantidad,
  leerContado,
  leerCosto,
  leerPrecioDeVenta,
  normalizarInstante,
  normalizarNota,
  validarCantidad,
  validarFecha,
  validarMotivoDeMerma,
  validarStock,
  existenciasDelLibro,
  exigirSinAnular,
} from './reglas'
import { resultadoDe } from '../__pruebas__/resultado'

const c = (texto: string) => Cantidad.deTexto(texto, 'KILO')

describe('validarCantidad y leerCantidad', () => {
  it.each([
    ['1', 'registrada'],
    ['0', 'error: La cantidad debe ser mayor que 0'],
    ['-2', 'error: La cantidad debe ser mayor que 0'],
    ['100000', 'error: La cantidad no puede pasar de 99 999'],
    ['99999', 'registrada'],
  ])('RN-OP-03: vender "%s" de Carbón → %s', (cantidad, resultado) => {
    expect(resultadoDe(() => leerCantidad(cantidad, 'KILO'))).toBe(resultado)
  })

  it('RN-OP-03: lee la cantidad en milésimas', () => {
    expect(leerCantidad('99999', 'KILO').milesimas).toBe(99_999_000)
  })

  it.each([
    ['UNIDAD', '2', 'registrada'],
    ['UNIDAD', '1.5', 'error: Este producto se cuenta por unidades enteras'],
    ['KILO', '1.25', 'registrada'],
    ['KILO', '0.125', 'registrada'],
    ['KILO', '0.0005', 'error: Usa como máximo tres decimales'],
  ] as const)('RN-OP-04: %s con "%s" → %s', (unidad, cantidad, resultado) => {
    expect(resultadoDe(() => leerCantidad(cantidad, unidad))).toBe(resultado)
  })

  it('RN-OP-04: lee 0.125 kg como 125 milésimas', () => {
    expect(leerCantidad('0.125', 'KILO').milesimas).toBe(125)
  })

  it('RN-OP-03: validarCantidad devuelve la misma cantidad si es válida', () => {
    const cantidad = c('2.5')
    expect(validarCantidad(cantidad)).toBe(cantidad)
  })
})

describe('leerContado', () => {
  it.each([
    ['8', 'UNIDAD', 'registrada'],
    ['0', 'UNIDAD', 'registrada'],
    ['12.5', 'KILO', 'registrada'],
    ['-1', 'UNIDAD', 'error: La cantidad contada no puede ser negativa'],
    ['100000', 'UNIDAD', 'error: La cantidad no puede pasar de 99 999'],
    ['1.5', 'UNIDAD', 'error: Este producto se cuenta por unidades enteras'],
  ] as const)('RN-OP-16: contar "%s" (%s) → %s', (texto, unidad, resultado) => {
    expect(resultadoDe(() => leerContado(texto, unidad))).toBe(resultado)
  })

  it('RN-OP-16: contar 0 es válido (el estante está vacío)', () => {
    expect(leerContado('0', 'UNIDAD').esCero()).toBe(true)
  })
})

describe('validarFecha', () => {
  const ahora = instanteLocal('2026-10-15 10:00')

  it.each([
    ['2026-10-15 09:00', 'registrada'],
    ['2026-10-14 18:30', 'registrada'],
    ['2026-10-08 10:00', 'registrada'],
    ['2026-10-08 00:00', 'registrada'],
    ['2026-10-15 10:00', 'registrada'],
    ['2026-10-07 23:59', 'error: Solo puedes anotar hasta 7 días atrás'],
    ['2026-10-16 08:00', 'error: La fecha no puede ser futura'],
  ])('RN-OP-09: con fecha %s → %s', (fecha, resultado) => {
    expect(resultadoDe(() => validarFecha(instanteLocal(fecha), ahora))).toBe(resultado)
  })

  it('RN-OP-09: una fecha con zona horaria se guarda como instante UTC', () => {
    expect(normalizarInstante('2026-10-14T18:30:00-05:00')).toBe('2026-10-14T23:30:00.000Z')
    expect(normalizarInstante('2026-10-14T23:30:00Z')).toBe('2026-10-14T23:30:00.000Z')
  })

  it('RN-OP-09: una fecha sin hora se rechaza', () => {
    expect(() => normalizarInstante('2026-10-15')).toThrow('Elige la fecha y la hora')
    expect(() => normalizarInstante(' 2026-10-15 ')).toThrow('Elige la fecha y la hora')
  })

  it('RN-OP-09: una fecha que no se puede leer sigue siendo un error de programación', () => {
    expect(() => normalizarInstante('ayer')).toThrow('Fecha inválida: ayer')
  })

  it('RN-OP-09: una fecha que no se puede leer es un error de programación', () => {
    expect(() => validarFecha('ayer', ahora)).toThrow('Fecha inválida: ayer')
  })
})

describe('validarStock', () => {
  const productos = new Map([
    ['lejia', { nombre: 'Lejía 1 L', unidad: 'UNIDAD' as const }],
    ['carbon', { nombre: 'Carbón', unidad: 'KILO' as const }],
    ['detergente', { nombre: 'Detergente a granel', unidad: 'KILO' as const }],
  ])
  const stock = new Map([
    ['lejia', Cantidad.deEntero(10)],
    ['carbon', Cantidad.deEntero(10)],
    ['detergente', Cantidad.deEntero(1)],
  ])

  it('RN-OP-05: devuelve el stock resultante de cada producto', () => {
    const resultantes = validarStock(
      [
        { productoId: 'lejia', cantidad: Cantidad.deEntero(-2) },
        { productoId: 'carbon', cantidad: Cantidad.deEntero(5) },
      ],
      stock,
      productos,
    )
    expect(resultantes.get('lejia')).toEqual(Cantidad.deEntero(8))
    expect(resultantes.get('carbon')).toEqual(Cantidad.deEntero(15))
  })

  it('RN-OP-05: dejar el stock exactamente en 0 está permitido', () => {
    const resultantes = validarStock(
      [{ productoId: 'lejia', cantidad: Cantidad.deEntero(-10) }],
      stock,
      productos,
    )
    expect(resultantes.get('lejia')?.esCero()).toBe(true)
  })

  it('RN-OP-05: con 10 unid. dice "Solo quedan 10 unid. de Lejía 1 L"', () => {
    expect(() =>
      validarStock([{ productoId: 'lejia', cantidad: Cantidad.deEntero(-11) }], stock, productos),
    ).toThrow('Solo quedan 10 unid. de Lejía 1 L')
  })

  it('RN-OP-05: con 1 kg dice "Solo queda 1 kg de Detergente a granel"', () => {
    expect(() =>
      validarStock([{ productoId: 'detergente', cantidad: c('-1.5') }], stock, productos),
    ).toThrow('Solo queda 1 kg de Detergente a granel')
  })

  it('RN-OP-05: con stock 0 dice "Ya no queda Lejía 1 L" (sin registro de existencia = 0)', () => {
    expect(() =>
      validarStock(
        [{ productoId: 'lejia', cantidad: Cantidad.deEntero(-1) }],
        new Map(),
        productos,
      ),
    ).toThrow('Ya no queda Lejía 1 L')
  })

  it('RN-OP-05: informa el primer producto que falla, en el orden de las líneas', () => {
    expect(() =>
      validarStock(
        [
          { productoId: 'lejia', cantidad: Cantidad.deEntero(-2) },
          { productoId: 'carbon', cantidad: Cantidad.deEntero(-20) },
          { productoId: 'detergente', cantidad: Cantidad.deEntero(-5) },
        ],
        stock,
        productos,
      ),
    ).toThrow('Solo quedan 10 kg de Carbón')
  })

  it('RN-OP-05: un producto sin datos que deja stock negativo es un error de programación', () => {
    expect(() =>
      validarStock([{ productoId: 'otro', cantidad: Cantidad.deEntero(-1) }], stock, productos),
    ).toThrow('Faltan los datos del producto otro')
  })
})

describe('fusionarLineas', () => {
  const soles = (texto: string) => Dinero.deTexto(texto)
  const precioDe = (linea: { precio: Dinero }) => linea.precio

  it('RN-OP-07: suma las cantidades del mismo producto en una sola línea, en el orden de aparición', () => {
    const lineas = fusionarLineas(
      [
        { productoId: 'lejia', cantidad: Cantidad.deEntero(1), precio: soles('3.50') },
        { productoId: 'carbon', cantidad: c('1.25'), precio: soles('4.00') },
        { productoId: 'lejia', cantidad: Cantidad.deEntero(2), precio: soles('3.50') },
      ],
      precioDe,
    )
    expect(lineas).toEqual([
      { productoId: 'lejia', cantidad: Cantidad.deEntero(3), precio: soles('3.50') },
      { productoId: 'carbon', cantidad: c('1.25'), precio: soles('4.00') },
    ])
  })

  it('RN-OP-07: el mismo producto con distinto precio no se suma: se rechaza', () => {
    expect(() =>
      fusionarLineas(
        [
          { productoId: 'lejia', cantidad: Cantidad.deEntero(1), precio: soles('3.50') },
          { productoId: 'lejia', cantidad: Cantidad.deEntero(2), precio: soles('3.00') },
        ],
        precioDe,
      ),
    ).toThrow('Pusiste el mismo producto dos veces con distinto precio. Déjalo en una sola línea.')
  })
})

describe('exigirProducto', () => {
  it('acepta un producto archivado (p. ej. para anular una operación pasada)', () => {
    const producto = { nombre: 'Escoba', activo: false }
    expect(exigirProducto(producto)).toBe(producto)
  })

  it('rechaza un producto que no existe', () => {
    expect(() => exigirProducto(null)).toThrow('No encontramos ese producto')
  })
})

describe('exigirProductoActivo', () => {
  it('RN-OP-08: rechaza un producto archivado', () => {
    expect(() => exigirProductoActivo({ nombre: 'Escoba', activo: false })).toThrow(
      'Escoba está archivado. Reactívalo para usarlo',
    )
  })

  it('RN-OP-08: rechaza un producto que no existe', () => {
    expect(() => exigirProductoActivo(null)).toThrow('No encontramos ese producto')
  })

  it('RN-OP-08: devuelve el producto activo', () => {
    const producto = { nombre: 'Lejía 1 L', activo: true }
    expect(exigirProductoActivo(producto)).toBe(producto)
  })
})

describe('precios', () => {
  it.each([
    ['3.00', 'registrada'],
    ['0.00', 'error: El precio de venta debe ser mayor que S/ 0.00'],
    ['-1.00', 'error: El precio de venta debe ser mayor que S/ 0.00'],
    ['100000.00', 'error: El precio no puede pasar de S/ 99 999.99'],
    ['3.005', 'error: Usa como máximo dos decimales'],
  ])('RN-OP-11: precio especial "%s" → %s', (texto, resultado) => {
    expect(resultadoDe(() => leerPrecioDeVenta(texto))).toBe(resultado)
  })

  it('RN-OP-11: lee el precio especial en céntimos', () => {
    expect(leerPrecioDeVenta('3.00')).toEqual(Dinero.deCentimos(300))
  })

  it.each([
    ['2.60', 'registrada'],
    ['0.00', 'registrada'],
    ['-1.00', 'error: El precio de compra no puede ser negativo'],
    ['100000.00', 'error: El precio no puede pasar de S/ 99 999.99'],
  ])('RN-OP-14: costo de ingreso "%s" → %s', (texto, resultado) => {
    expect(resultadoDe(() => leerCosto(texto))).toBe(resultado)
  })

  it('RN-OP-14: lee el costo en céntimos', () => {
    expect(leerCosto('2.60')).toEqual(Dinero.deCentimos(260))
  })
})

describe('validarMotivoDeMerma', () => {
  it.each([
    ['Se venció', '', 'registrada'],
    ['Otro', 'Se lo llevó un niño', 'registrada'],
    ['Otro', '', 'error: Cuéntanos qué pasó'],
    ['Otro', '   ', 'error: Cuéntanos qué pasó'],
    ['', '', 'error: Elige qué pasó con el producto'],
    ['Se lo comió el perro', '', 'error: Elige qué pasó con el producto'],
  ])('RN-OP-15: motivo "%s" y nota "%s" → %s', (motivo, nota, resultado) => {
    expect(resultadoDe(() => validarMotivoDeMerma(motivo, nota))).toBe(resultado)
  })

  it('RN-OP-15: acepta el motivo con espacios alrededor', () => {
    expect(validarMotivoDeMerma('  Se derramó ', null)).toBe('Se derramó')
  })
})

describe('normalizarNota', () => {
  it('recorta la nota y la deja en null si queda vacía', () => {
    expect(normalizarNota('  Se cayó  ')).toBe('Se cayó')
    expect(normalizarNota('   ')).toBeNull()
    expect(normalizarNota(undefined)).toBeNull()
    expect(normalizarNota(null)).toBeNull()
  })

  it('la nota tiene como máximo 200 caracteres', () => {
    expect(normalizarNota('a'.repeat(200))).toHaveLength(200)
    expect(() => normalizarNota('a'.repeat(201))).toThrow(
      'La nota puede tener hasta 200 caracteres',
    )
  })
})

describe('anulaciones', () => {
  it('RN-OP-17: una operación que no existe no se puede anular', () => {
    expect(() => exigirOperacion(null)).toThrow('No encontramos esa operación')
    const registro = { id: 'op-1' }
    expect(exigirOperacion(registro)).toBe(registro)
  })

  it('RN-OP-17: una operación solo se anula una vez', () => {
    expect(() => exigirSinAnular({ id: 'op-2' })).toThrow('Esta operación ya fue anulada')
    expect(() => exigirSinAnular(null)).not.toThrow()
  })
})

describe('integridad (RN-OP-19)', () => {
  const operacion = (id: string, movimientos: [string, number][]): OperacionRegistro => ({
    id,
    tipo: 'AJUSTE',
    movimientos: movimientos.map(([productoId, cantidad]) => ({
      productoId,
      cantidad,
      costoUnitario: 100,
      precioUnitario: null,
    })),
    productoIds: movimientos.map(([productoId]) => productoId),
    ocurridaEn: '2026-10-15T15:00:00.000Z',
    registradaEn: '2026-10-15T15:00:00.000Z',
    motivo: null,
    nota: null,
    anulaA: null,
    dispositivoId: 'd',
  })

  it('RN-OP-19: la existencia de cada producto es la suma de sus movimientos', () => {
    expect(
      existenciasDelLibro([
        operacion('op-1', [
          ['lejia', 10_000],
          ['carbon', 10_000],
        ]),
        operacion('op-2', [['lejia', -3000]]),
        operacion('op-3', [['carbon', -10_000]]),
      ]),
    ).toEqual(
      new Map([
        ['lejia', Cantidad.deEntero(7)],
        ['carbon', Cantidad.cero()],
      ]),
    )
  })

  it('RN-OP-19: compara las existencias guardadas con las del libro (sin registro = 0)', () => {
    const guardadas = new Map([
      ['lejia', Cantidad.deEntero(10)],
      ['carbon', Cantidad.deEntero(7)],
      ['huerfano', Cantidad.deEntero(2)],
      ['vacio', Cantidad.cero()],
    ])
    const delLibro = new Map([
      ['lejia', Cantidad.deEntero(10)],
      ['carbon', Cantidad.deEntero(10)],
      ['detergente', Cantidad.deEntero(5)],
    ])
    expect(diferenciasDeExistencias(guardadas, delLibro)).toEqual([
      { productoId: 'carbon', antes: Cantidad.deEntero(7), despues: Cantidad.deEntero(10) },
      { productoId: 'huerfano', antes: Cantidad.deEntero(2), despues: Cantidad.cero() },
      { productoId: 'detergente', antes: Cantidad.cero(), despues: Cantidad.deEntero(5) },
    ])
    expect(diferenciasDeExistencias(delLibro, delLibro)).toEqual([])
  })
})
