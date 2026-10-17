import { describe, expect, it } from 'vitest'
import type { ProductoResumido } from '@/shared/contratos/entre-modulos'
import { Cantidad } from '@/shared/domain/cantidad'
import { sumarDias, type Dia } from '@/shared/domain/fecha'
import { formatearCantidad, formatearDinero, formatearNumero } from '@/shared/domain/formato'
import { historial, prediccionCon } from './__pruebas__/historial'
import { anulacionDe, nuevaOperacion } from './__pruebas__/operaciones'
import {
  BOLSAS,
  CARBON,
  CERA_ROJA,
  DESATORADOR,
  DETERGENTE,
  ESCOBA,
  JABON,
  LEJIA,
  producto,
  RECOGEDOR,
  soles,
  TRAPEADOR,
} from './__pruebas__/productos'
import { evaluarSituacion } from './situacion'
import {
  diasSinVender,
  masVendidos,
  mejorDiaDeLaSemana,
  podriaEstarParado,
  preciosParaRevisar,
  productosEnAtencion,
  productosParados,
  semanaContraSemana,
  tendencia,
  ultimoDiaConVenta,
  vecesVendido,
} from './observaciones'
import { rangoDePeriodo } from './periodos'
import { proyectarLibro, ResumenDiario } from './resumen-diario'

const HOY = '2026-10-15'
const ANTECEDENTES = [LEJIA, CARBON, JABON, BOLSAS, DETERGENTE]

function linea(p: ProductoResumido, cantidad: string) {
  return {
    producto: p.id,
    cantidad,
    precio: formatearDinero(p.precioVenta),
    costo: formatearDinero(p.precioCompra),
  }
}

function vender(cuando: string, p: ProductoResumido, cantidad: string) {
  return nuevaOperacion('VENTA', cuando, [linea(p, cantidad)])
}

function stockInicial(p: ProductoResumido, cantidad: string, dia: Dia) {
  return nuevaOperacion('STOCK_INICIAL', `${dia} 08:00`, [linea(p, cantidad)])
}

describe('RN-AN-09: más vendidos', () => {
  const filas = proyectarLibro([
    ...ANTECEDENTES.map((p) => stockInicial(p, '100', '2026-08-01')),
    vender('2026-10-10 10:00', LEJIA, '1'),
    vender('2026-10-11 10:00', LEJIA, '1'),
    vender('2026-10-12 10:00', LEJIA, '1'),
    vender('2026-10-13 10:00', LEJIA, '1'),
    vender('2026-10-14 10:00', LEJIA, '1'),
    vender('2026-10-12 11:00', CARBON, '5'),
    vender('2026-10-14 11:00', CARBON, '5'),
    vender('2026-10-11 12:00', JABON, '1'),
    vender('2026-10-13 12:00', JABON, '1'),
    vender('2026-10-15 12:00', JABON, '1'),
    nuevaOperacion('INGRESO', '2026-10-13 09:00', [linea(BOLSAS, '50')]),
  ])

  it('RN-AN-09: por veces vendido y por ganancia en 7 días', () => {
    const { porVeces, porGanancia } = masVendidos(
      filas,
      ANTECEDENTES,
      rangoDePeriodo('7_DIAS', HOY),
    )
    expect(
      porVeces.map((f) => ({
        producto: f.nombre,
        veces: f.veces,
        cantidad: formatearCantidad(f.cantidad, f.unidad),
      })),
    ).toEqual([
      { producto: 'Lejía 1 L', veces: 5, cantidad: '5 unid.' },
      { producto: 'Jabón', veces: 3, cantidad: '3 unid.' },
      { producto: 'Carbón', veces: 2, cantidad: '10 kg' },
    ])
    expect(porGanancia.map((f) => [f.nombre, formatearDinero(f.ganancia)])).toEqual([
      ['Carbón', 'S/ 12.50'],
      ['Lejía 1 L', 'S/ 5.50'],
      ['Jabón', 'S/ 2.40'],
    ])
    expect(porGanancia[0]).toMatchObject({ productoId: 'carbon', ventas: soles('40.00') })
  })

  it('RN-AN-09: solo cuentan los productos con alguna venta en el periodo', () => {
    const { porVeces } = masVendidos(filas, ANTECEDENTES, { desde: HOY, hasta: HOY })
    expect(porVeces.map((f) => f.nombre)).toEqual(['Jabón'])
  })

  it('RN-AN-09: empates: más ventas en soles primero, luego por nombre; hasta 5', () => {
    const productos = ['F', 'E', 'D', 'C', 'B', 'A'].map((n) =>
      producto(n, `Producto ${n}`, 'UNIDAD', '1.00', n === 'F' ? '3.00' : '2.00', '1'),
    )
    const empatadas = proyectarLibro(productos.map((p) => vender('2026-10-14 10:00', p, '1')))
    const { porVeces, porGanancia } = masVendidos(
      empatadas,
      productos,
      rangoDePeriodo('7_DIAS', HOY),
    )
    expect(porVeces.map((f) => f.productoId)).toEqual(['F', 'A', 'B', 'C', 'D'])
    expect(porGanancia.map((f) => f.productoId)).toEqual(['F', 'A', 'B', 'C', 'D'])
  })

  it('RN-AN-09: por ganancia, a igual ganancia van primero las más ventas', () => {
    const caro = producto('caro', 'Caro', 'UNIDAD', '9.00', '10.00', '1')
    const barato = producto('barato', 'Barato', 'UNIDAD', '1.00', '2.00', '1')
    const f = proyectarLibro([
      vender('2026-10-14 10:00', caro, '1'),
      vender('2026-10-14 10:00', barato, '1'),
    ])
    const { porGanancia } = masVendidos(f, [barato, caro], rangoDePeriodo('7_DIAS', HOY))
    expect(porGanancia.map((x) => x.nombre)).toEqual(['Caro', 'Barato'])
  })

  it('RN-AN-09: una fila de un producto que no está en el catálogo se ignora', () => {
    const { porVeces } = masVendidos(filas, [LEJIA], rangoDePeriodo('7_DIAS', HOY))
    expect(porVeces.map((f) => f.nombre)).toEqual(['Lejía 1 L'])
  })
})

describe('veces vendido por producto', () => {
  it('RN-AN-01: cuenta las líneas de venta no anuladas de cada producto en el rango', () => {
    const venta = vender('2026-10-14 10:00', LEJIA, '3')
    const filas = proyectarLibro([
      stockInicial(CARBON, '10', '2026-10-01'),
      vender('2026-10-15 09:00', LEJIA, '2'),
      venta,
      anulacionDe(venta, '2026-10-15 10:00'),
      vender('2026-10-15 10:00', JABON, '1'),
      vender('2026-10-15 11:00', JABON, '1'),
      vender('2026-10-01 11:00', JABON, '1'),
    ])
    expect(vecesVendido(filas, rangoDePeriodo('7_DIAS', HOY))).toEqual(
      new Map([
        ['lejia', 1],
        ['jabon', 2],
      ]),
    )
  })
})

describe('RN-AN-10: precios para revisar', () => {
  it('RN-AN-10: productos activos con venta ≤ compra, mayor pérdida primero', () => {
    const archivado = producto('viejo', 'Viejo', 'UNIDAD', '9.00', '1.00', '1', { activo: false })
    const revisar = preciosParaRevisar([...ANTECEDENTES, DESATORADOR, CERA_ROJA, archivado])
    expect(revisar.map((p) => [p.nombre, formatearDinero(p.perdidaPorUnidad)])).toEqual([
      ['Cera roja', 'S/ 0.50'],
      ['Desatorador', 'S/ 0.00'],
    ])
    expect(revisar[0]?.productoId).toBe('cera')
  })

  // Plan 13: Control dice "por unidad", "por kilo" o "por litro".
  it('RN-AN-10: cada precio para revisar lleva la unidad del producto', () => {
    const carbon = producto('carbon', 'Carbón', 'KILO', '4.00', '3.50', '1')
    expect(preciosParaRevisar([carbon, CERA_ROJA]).map((p) => [p.nombre, p.unidad])).toEqual([
      ['Carbón', 'KILO'],
      ['Cera roja', 'UNIDAD'],
    ])
  })

  it('RN-AN-10: a igual pérdida, por nombre', () => {
    const b = producto('b', 'Bórax', 'UNIDAD', '2.00', '2.00', '1')
    const a = producto('a', 'Ácido', 'UNIDAD', '3.00', '3.00', '1')
    expect(preciosParaRevisar([b, a]).map((p) => p.nombre)).toEqual(['Ácido', 'Bórax'])
  })
})

describe('RN-AN-11: productos parados', () => {
  const libro = [
    stockInicial(ESCOBA, '5', '2026-07-17'),
    vender('2026-08-31 10:00', ESCOBA, '1'),
    stockInicial(TRAPEADOR, '2', '2026-09-05'),
    stockInicial(RECOGEDOR, '3', '2026-10-05'),
    stockInicial(LEJIA, '20', '2026-08-01'),
    vender('2026-10-14 10:00', LEJIA, '1'),
  ]
  const filas = proyectarLibro(libro)

  function evaluar(p: ProductoResumido) {
    const propias = filas.filter((f) => f.productoId === p.id)
    const stock = Cantidad.sumarTodas(propias.map((f) => f.cambioNeto))
    const primerDia = propias.map((f) => f.dia).sort()[0] ?? null
    const dias = diasSinVender({
      hoy: HOY,
      stock,
      primerDia,
      ultimoDiaConVenta: ultimoDiaConVenta(propias, HOY),
    })
    return { producto: p, stock, diasSinVender: dias }
  }

  it('RN-AN-11: parados con dinero inmovilizado, más dinero primero, y su total', () => {
    const evaluados = [ESCOBA, TRAPEADOR, RECOGEDOR, LEJIA].map(evaluar)
    expect(evaluados.map((e) => e.diasSinVender)).toEqual([45, 40, null, null])
    const parados = productosParados(
      evaluados.flatMap((e) =>
        e.diasSinVender === null ? [] : [{ ...e, diasSinVender: e.diasSinVender }],
      ),
    )
    expect(
      parados.productos.map((p) => ({
        producto: p.nombre,
        stock: formatearCantidad(p.stock, p.unidad),
        dinero: formatearDinero(p.dineroInmovilizado),
        dias: p.diasSinVender,
      })),
    ).toEqual([
      { producto: 'Escoba', stock: '4 unid.', dinero: 'S/ 24.00', dias: 45 },
      { producto: 'Trapeador', stock: '2 unid.', dinero: 'S/ 16.00', dias: 40 },
    ])
    expect(formatearDinero(parados.total)).toBe('S/ 40.00')
    expect(parados.productos[0]?.productoId).toBe('escoba')
  })

  it('RN-AN-11: sin stock no está parado', () => {
    expect(
      diasSinVender({
        hoy: HOY,
        stock: Cantidad.cero(),
        primerDia: '2026-07-17',
        ultimoDiaConVenta: null,
      }),
    ).toBeNull()
    expect(podriaEstarParado({ hoy: HOY, stock: Cantidad.cero(), primerDia: '2026-07-17' })).toBe(
      false,
    )
  })

  it('RN-AN-11: el primer movimiento debe ser de hace 30 días o más', () => {
    const datos = { hoy: HOY, stock: Cantidad.deEntero(1), ultimoDiaConVenta: null }
    expect(diasSinVender({ ...datos, primerDia: '2026-09-15' })).toBe(30)
    expect(diasSinVender({ ...datos, primerDia: '2026-09-16' })).toBeNull()
    expect(diasSinVender({ ...datos, primerDia: null })).toBeNull()
    expect(podriaEstarParado({ ...datos, primerDia: '2026-09-15' })).toBe(true)
    expect(podriaEstarParado({ ...datos, primerDia: null })).toBe(false)
  })

  it('RN-AN-11: una venta en los últimos 30 días (incluye hoy) lo saca de parados', () => {
    const datos = { hoy: HOY, stock: Cantidad.deEntero(1), primerDia: '2026-07-01' }
    expect(diasSinVender({ ...datos, ultimoDiaConVenta: '2026-09-16' })).toBeNull()
    expect(diasSinVender({ ...datos, ultimoDiaConVenta: '2026-09-15' })).toBe(30)
  })

  it('RN-AN-11: el último día con venta ignora las filas sin ventas y las de después de hoy', () => {
    const fila = (dia: Dia, lineasVendidas: number) =>
      ResumenDiario.crear({ productoId: 'p', dia, lineasVendidas })
    expect(
      ultimoDiaConVenta(
        [
          fila('2026-10-05', 2),
          fila('2026-10-01', 1),
          fila('2026-10-10', 0),
          fila('2026-10-16', 1),
        ],
        HOY,
      ),
    ).toBe('2026-10-05')
    expect(ultimoDiaConVenta([fila('2026-10-10', 0)], HOY)).toBeNull()
  })

  it('RN-AN-11: a igual dinero inmovilizado, por nombre', () => {
    const b = producto('b', 'Bórax', 'UNIDAD', '2.00', '3.00', '1')
    const a = producto('a', 'Ácido', 'UNIDAD', '2.00', '3.00', '1')
    const { productos } = productosParados([
      { producto: b, stock: Cantidad.deEntero(1), diasSinVender: 31 },
      { producto: a, stock: Cantidad.deEntero(1), diasSinVender: 31 },
    ])
    expect(productos.map((p) => p.nombre)).toEqual(['Ácido', 'Bórax'])
  })
})

describe('RN-AN-12: semana contra semana', () => {
  function semana(dia: Dia, ventas: string, costo: string, mermas = '0') {
    return ResumenDiario.crear({
      productoId: 'lejia',
      dia,
      lineasVendidas: 1,
      ventas: soles(ventas),
      costoVendido: soles(costo),
      costoMermas: soles(mermas),
    })
  }

  it('RN-AN-12: compara los últimos 7 días completos con los 7 anteriores', () => {
    const comparacion = semanaContraSemana(
      [
        semana('2026-10-01', '100.00', '70.00'),
        semana('2026-10-07', '212.50', '142.50'),
        semana('2026-10-08', '150.00', '100.00'),
        semana('2026-10-14', '200.00', '150.00', '10.00'),
        semana('2026-10-15', '80.00', '40.00'),
        semana('2026-09-30', '999.00', '0.00'),
      ],
      HOY,
    )
    expect(comparacion).toEqual({
      tipo: 'comparacion',
      filas: [
        {
          concepto: 'Ventas',
          actual: soles('350.00'),
          anterior: soles('312.50'),
          cambio: '▲ 12 % más',
        },
        {
          concepto: 'Ganancia neta',
          actual: soles('90.00'),
          anterior: soles('100.00'),
          cambio: '▼ 10 % menos',
        },
      ],
    })
  })

  it('RN-AN-12: sin ventas la semana anterior no hay comparación', () => {
    expect(semanaContraSemana([semana('2026-10-10', '350.00', '260.00')], HOY)).toEqual({
      tipo: 'sin-datos',
      mensaje: 'Sin datos de la semana anterior',
    })
    expect(semanaContraSemana([], HOY).tipo).toBe('sin-datos')
  })

  it('RN-AN-12: igual, con anterior en 0 o negativa, y redondeo al entero', () => {
    const comparacion = semanaContraSemana(
      [semana('2026-10-03', '300.00', '300.00'), semana('2026-10-10', '300.00', '200.00')],
      HOY,
    )
    expect(comparacion).toMatchObject({
      filas: [{ cambio: '= igual' }, { cambio: 'Sin datos de la semana anterior' }],
    })
    const negativa = semanaContraSemana(
      [semana('2026-10-03', '100.00', '50.00', '100.00'), semana('2026-10-10', '200.00', '100.00')],
      HOY,
    )
    // Ganancia neta: −50 → 100: (100 + 50) ÷ 50 = 300 %.
    expect(negativa).toMatchObject({
      filas: [{ cambio: '▲ 100 % más' }, { cambio: '▲ 300 % más' }],
    })
    const mitad = semanaContraSemana(
      [semana('2026-10-03', '200.00', '0.00'), semana('2026-10-10', '201.00', '0.00')],
      HOY,
    )
    // 0.5 % se redondea alejándose de cero: 1 %.
    expect(mitad).toMatchObject({ filas: [{ cambio: '▲ 1 % más' }, { cambio: '▲ 1 % más' }] })
  })
})

describe('RN-AN-13: mejor día de la semana', () => {
  function ventasDiarias(desde: Dia, hasta: Dia, monto: (dia: Dia) => string | null) {
    const filas: ResumenDiario[] = []
    for (let d = desde; d <= hasta; d = sumarDias(d, 1)) {
      const m = monto(d)
      if (m !== null)
        filas.push(ResumenDiario.crear({ productoId: 'lejia', dia: d, ventas: soles(m) }))
    }
    return filas
  }
  const SABADOS = new Set(['2026-08-22', '2026-08-29'])

  it('RN-AN-13: promedio por día de la semana en los 56 días completos', () => {
    const filas = ventasDiarias('2026-08-01', HOY, (d) => {
      const dia = new Date(`${d}T00:00:00Z`).getUTCDay()
      if (dia === 0) return null
      return dia === 6 ? '200.00' : '100.00'
    })
    const mejor = mejorDiaDeLaSemana(filas, HOY, '2026-08-01')
    expect(mejor.tipo).toBe('calculado')
    if (mejor.tipo !== 'calculado') return
    expect(mejor.promedios.map((p) => [p.dia, formatearDinero(p.promedio)])).toEqual([
      ['lunes', 'S/ 100.00'],
      ['martes', 'S/ 100.00'],
      ['miércoles', 'S/ 100.00'],
      ['jueves', 'S/ 100.00'],
      ['viernes', 'S/ 100.00'],
      ['sábado', 'S/ 200.00'],
      ['domingo', 'S/ 0.00'],
    ])
    expect(mejor.mejor).toBe('sábado')
  })

  it('RN-AN-13: con menos de 14 días de historia no se calcula', () => {
    const esperado = {
      tipo: 'insuficiente',
      mensaje: 'Necesito al menos 2 semanas de ventas para saberlo',
    }
    expect(mejorDiaDeLaSemana([], HOY, '2026-10-05')).toEqual(esperado)
    expect(mejorDiaDeLaSemana([], HOY, '2026-10-02')).toEqual(esperado)
    expect(mejorDiaDeLaSemana([], HOY, null)).toEqual(esperado)
  })

  it('RN-AN-13: cuenta solo desde la primera operación; un día sin ventas vale S/ 0', () => {
    // Del 01/10 (jueves) al 14/10: dos de cada día; solo un lunes vendió.
    const filas = ventasDiarias('2026-10-01', HOY, (d) => (d === '2026-10-05' ? '100.01' : null))
    const mejor = mejorDiaDeLaSemana(filas, HOY, '2026-10-01')
    expect(mejor).toMatchObject({ tipo: 'calculado', mejor: 'lunes' })
    if (mejor.tipo !== 'calculado') return
    expect(formatearDinero(mejor.promedios[0]!.promedio)).toBe('S/ 50.01')
    expect(formatearDinero(mejor.promedios[1]!.promedio)).toBe('S/ 0.00')
  })

  it('RN-AN-13: en un empate gana el primero de la semana', () => {
    const filas = ventasDiarias('2026-08-01', HOY, (d) =>
      SABADOS.has(d) || d === '2026-08-24' || d === '2026-08-31' ? '50.00' : null,
    )
    const mejor = mejorDiaDeLaSemana(filas, HOY, '2026-08-01')
    expect(mejor).toMatchObject({ tipo: 'calculado', mejor: 'lunes' })
  })

  // Ola 3 (ruling de la Ola 2): sin ventas no hay un "mejor día" que marcar.
  it('RN-AN-13: con historia suficiente pero todos los promedios en S/ 0.00, todavía no se sabe', () => {
    const esperado = { tipo: 'insuficiente', mensaje: 'Todavía no hay ventas para saberlo' }
    expect(mejorDiaDeLaSemana([], HOY, '2026-08-01')).toEqual(esperado)
    const sinVentas = ventasDiarias('2026-08-01', HOY, () => null)
    expect(mejorDiaDeLaSemana(sinVentas, HOY, '2026-08-01')).toEqual(esperado)
  })
})

describe('RN-AN-14: tendencia de 8 semanas', () => {
  it('RN-AN-14: cantidad vendida en los últimos 8 bloques de 7 días completos', () => {
    const h = historial()
      .primerMovimiento('2026-08-01', 500)
      .vendio(7, '2026-08-01', '2026-08-19')
      .vendioPorBloques(HOY, [10, 12, 9, 14, 15, 13, 16, 18])
      .vendio(4, HOY)
      .construir()
    expect(tendencia(h.filas, HOY).map(formatearNumero).join(', ')).toBe(
      '10, 12, 9, 14, 15, 13, 16, 18',
    )
  })

  it('RN-AN-14: sin ventas, los 8 bloques están en 0', () => {
    expect(tendencia([], HOY).map((c) => c.milesimas)).toEqual([0, 0, 0, 0, 0, 0, 0, 0])
  })
})

describe('Atención: agotados y por acabarse (Control)', () => {
  function situacion(p: ProductoResumido, stock: string, vpd: string | null) {
    return evaluarSituacion({
      producto: p,
      stock: Cantidad.deTexto(stock, p.unidad),
      prediccion: vpd === null ? null : prediccionCon(vpd),
      diasEntreCompras: 7,
      diasAnticipacion: 3,
    })
  }

  it('separa por estado y ordena como Para comprar (RN-AN-07): menos cobertura, sin predicción al final, nombre', () => {
    const { agotados, porAcabarse } = productosEnAtencion([
      situacion(JABON, '2', null),
      situacion(DETERGENTE, '20', '0.5'),
      situacion(CARBON, '2', '0.5'),
      situacion(BOLSAS, '0', null),
      situacion(LEJIA, '5', '2'),
      situacion(CERA_ROJA, '1', null),
      situacion(ESCOBA, '0', '1'),
    ])
    // Ronda 1: el mismo orden que Para comprar (RN-AN-07): Escoba (con predicción, 0 días)
    // antes que Bolsas (sin predicción).
    expect(agotados.map((p) => [p.nombre, p.cobertura])).toEqual([
      ['Escoba', null],
      ['Bolsas', null],
    ])
    expect(
      porAcabarse.map((p) => [p.nombre, formatearCantidad(p.stock, p.unidad), p.cobertura]),
    ).toEqual([
      ['Lejía 1 L', '5 unid.', 'Se acaba en ~2 días'],
      ['Carbón', '2 kg', 'Se acaba en ~4 días'],
      ['Cera roja', '1 unid.', null],
      ['Jabón', '2 unid.', null],
    ])
  })
})
