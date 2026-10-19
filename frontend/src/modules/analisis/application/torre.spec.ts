import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ProductoResumido } from '@/shared/contratos/entre-modulos'
import { formatearCantidad, formatearDinero } from '@/shared/domain/formato'
import { UnidadDeTrabajoEnMemoria } from '@/shared/infrastructure/memoria/unidad-de-trabajo-en-memoria'
import { crearEntorno } from '../__pruebas__/entorno'
import { historial } from '../domain/__pruebas__/historial'
import { anulacionDe, nuevaOperacion } from '../domain/__pruebas__/operaciones'
import {
  BOLSAS,
  CARBON,
  CERA_ROJA,
  DETERGENTE,
  ESCOBA,
  JABON,
  LEJIA,
} from '../domain/__pruebas__/productos'
import type { Periodo } from '../domain/periodos'

function entorno(productos: readonly ProductoResumido[]) {
  return crearEntorno({ productos, uow: (a) => new UnidadDeTrabajoEnMemoria(a) })
}

const LEJIA_LINEA = { producto: 'lejia', precio: '3.50', costo: '2.40' }

function vender(cuando: string, cantidad: string) {
  return nuevaOperacion('VENTA', cuando, [{ ...LEJIA_LINEA, cantidad }])
}

function stockInicial(cantidad: string, dia = '2026-08-01') {
  return nuevaOperacion('STOCK_INICIAL', `${dia} 08:00`, [{ ...LEJIA_LINEA, cantidad }])
}

/** Estado de los productos del escenario de la lista para comprar (stock y VPD). */
function historialesDelEscenario() {
  return [
    historial('lejia').primerMovimiento('2026-08-01', 61).vendio(56, '2026-09-17', '2026-10-14'),
    historial('carbon', { precioVenta: '4.00', precioCompra: '2.75' })
      .primerMovimiento('2026-08-01', 28)
      .vendio(21, '2026-09-17', '2026-10-14'),
    historial('jabon', { precioVenta: '2.00', precioCompra: '1.20' }).primerMovimiento(
      '2026-10-12',
      2,
    ),
    historial('detergente', { precioVenta: '7.90', precioCompra: '5.30' })
      .primerMovimiento('2026-08-01', 34)
      .vendio(14, '2026-09-17', '2026-10-14'),
    historial('cera', { precioVenta: '4.50', precioCompra: '5.00' }).primerMovimiento(
      '2026-10-12',
      10,
    ),
  ].map((h) => h.construir())
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('Torre de control', () => {
  it('RN-AN-15: con datos vacíos arma todas las secciones sin fallar', async () => {
    const torre = await entorno([]).modulo.consultarTorre()
    expect(Object.keys(torre)).toEqual([
      'resumen',
      'alquiler',
      'atencion',
      'productosEnAtencion',
      'paraComprar',
      'masVendidos',
      'semana',
      'mejorDia',
      'parados',
      'preciosParaRevisar',
    ])
    expect(Object.values(torre.resumen).every((d) => d.esCero())).toBe(true)
    expect(torre.atencion).toEqual({ agotados: 0, porAcabarse: 0, preciosParaRevisar: 0 })
    expect(torre.productosEnAtencion).toEqual({ agotados: [], porAcabarse: [] })
    expect(torre.paraComprar.lineas).toEqual([])
    expect(torre.paraComprar.total.esCero()).toBe(true)
    expect(torre.masVendidos).toEqual({ porVeces: [], porGanancia: [] })
    expect(torre.semana).toEqual({ tipo: 'sin-datos', mensaje: 'Sin datos de la semana anterior' })
    expect(torre.mejorDia).toEqual({
      tipo: 'insuficiente',
      mensaje: 'Necesito al menos 2 semanas de ventas para saberlo',
    })
    expect(torre.parados.productos).toEqual([])
    expect(torre.parados.total.esCero()).toBe(true)
    expect(torre.preciosParaRevisar).toEqual([])
  })

  it('RN-AN-15: la Torre de control funciona sin internet', async () => {
    const red = vi.fn(() => Promise.reject(new Error('Sin conexión')))
    vi.stubGlobal('fetch', red)
    const e = entorno([LEJIA])
    await e.registrar(stockInicial('20'), vender('2026-10-15 10:00', '2'))
    const torre = await e.modulo.consultarTorre()
    expect(formatearDinero(torre.resumen.ventas)).toBe('S/ 7.00')
    expect(red).not.toHaveBeenCalled()
  })

  it('RN-AN-01: las operaciones anuladas no cuentan', async () => {
    const e = entorno([LEJIA])
    const ultima = vender('2026-10-15 10:05', '3')
    await e.registrar(stockInicial('20'), vender('2026-10-15 10:00', '2'), ultima)
    await e.anular(ultima, anulacionDe(ultima, '2026-10-15 10:06'))
    const hoy = await e.modulo.consultarResumen('HOY')
    expect(formatearDinero(hoy.ventas)).toBe('S/ 7.00')
    const veces = await e.modulo.consultable.vecesVendido('2026-10-09', '2026-10-15')
    expect(veces.get('lejia')).toBe(1)
  })

  it('RN-AN-02: ventas, ganancias, mermas y diferencias de conteo de hoy', async () => {
    const e = entorno([LEJIA])
    await e.registrar(
      stockInicial('20'),
      vender('2026-10-15 10:00', '4'),
      nuevaOperacion('MERMA', '2026-10-15 11:00', [{ ...LEJIA_LINEA, cantidad: '1' }]),
      nuevaOperacion('AJUSTE', '2026-10-15 12:00', [{ ...LEJIA_LINEA, cantidad: '-1' }]),
    )
    const r = await e.modulo.consultarResumen('HOY')
    expect(Object.fromEntries(Object.entries(r).map(([k, v]) => [k, formatearDinero(v)]))).toEqual({
      ventas: 'S/ 14.00',
      costoVendido: 'S/ 9.60',
      gananciaBruta: 'S/ 4.40',
      mermas: 'S/ 2.40',
      gananciaNeta: 'S/ 2.00',
      diferenciasDeConteo: '-S/ 2.40',
    })
    expect(e.inventario.stock.get('lejia')?.milesimas).toBe(14000)
  })

  it.each([
    ['HOY', 'S/ 10.50'],
    ['AYER', 'S/ 7.00'],
    ['7_DIAS', 'S/ 21.00'],
    ['30_DIAS', 'S/ 56.00'],
  ] as [Periodo, string][])('RN-AN-03: las ventas de %s son %s', async (periodo, ventas) => {
    const e = entorno([LEJIA])
    await e.registrar(
      stockInicial('100'),
      vender('2026-10-15 09:00', '3'),
      vender('2026-10-14 17:00', '2'),
      vender('2026-10-10 12:00', '1'),
      vender('2026-09-25 12:00', '10'),
      vender('2026-09-05 12:00', '1'),
    )
    expect(formatearDinero((await e.modulo.consultarResumen(periodo)).ventas)).toBe(ventas)
    const torre = await e.modulo.consultarTorre({ periodo })
    expect(formatearDinero(torre.resumen.ventas)).toBe(ventas)
  })

  it('RN-AN-07 / RN-AN-09 / RN-AN-10 / RN-AN-11: arma todas las secciones con los datos de la tienda', async () => {
    const e = entorno([LEJIA, CARBON, JABON, BOLSAS, DETERGENTE, CERA_ROJA, ESCOBA])
    await e.cargar(...historialesDelEscenario())
    await e.registrar(
      nuevaOperacion('STOCK_INICIAL', '2026-07-17 08:00', [
        { producto: 'escoba', cantidad: '5', costo: '6.00' },
      ]),
      nuevaOperacion('VENTA', '2026-08-31 10:00', [
        { producto: 'escoba', cantidad: '1', precio: '9.00', costo: '6.00' },
      ]),
    )
    await e.modulo.cambiarCantidadEnLista('lejia', '24')

    const torre = await e.modulo.consultarTorre({ periodo: 'AYER' })
    expect(formatearDinero(torre.resumen.ventas)).toBe('S/ 13.95')
    expect(torre.atencion).toEqual({ agotados: 1, porAcabarse: 2, preciosParaRevisar: 1 })
    expect(
      torre.paraComprar.lineas.map((l) => [l.nombre, formatearDinero(l.costoEstimado)]),
    ).toEqual([
      ['Bolsas', 'S/ 0.05'],
      ['Lejía 1 L', 'S/ 57.60'],
      ['Jabón', 'S/ 4.80'],
      ['Carbón', 'S/ 4.13'],
    ])
    expect(formatearDinero(torre.paraComprar.total)).toBe('S/ 66.58')
    expect(torre.masVendidos.porVeces.map((f) => [f.nombre, f.veces])).toEqual([
      ['Lejía 1 L', 6],
      ['Detergente a granel', 6],
      ['Carbón', 6],
    ])
    expect(torre.semana).toMatchObject({
      tipo: 'comparacion',
      filas: [{ cambio: '= igual' }, { cambio: '= igual' }],
    })
    expect(torre.mejorDia).toMatchObject({ tipo: 'calculado' })
    expect(
      torre.parados.productos.map((p) => [
        p.nombre,
        p.diasSinVender,
        formatearDinero(p.dineroInmovilizado),
      ]),
    ).toEqual([['Escoba', 45, 'S/ 24.00']])
    expect(formatearDinero(torre.parados.total)).toBe('S/ 24.00')
    expect(
      torre.preciosParaRevisar.map((p) => [p.nombre, formatearDinero(p.perdidaPorUnidad)]),
    ).toEqual([['Cera roja', 'S/ 0.50']])
  })

  // Plan 13: en Control, "Atención" abre la lista de cada grupo (04-torre-de-control). La lista
  // de compras no sirve para eso: el usuario puede haber quitado productos de la lista de hoy.
  it('Atención: la lista de agotados y la de por acabarse, aunque se hayan quitado de la lista para comprar', async () => {
    const e = entorno([LEJIA, CARBON, JABON, BOLSAS, DETERGENTE, CERA_ROJA])
    await e.cargar(...historialesDelEscenario())
    await e.modulo.quitarDeLista('lejia')
    await e.modulo.quitarDeLista('bolsas')

    const { agotados, porAcabarse } = (await e.modulo.consultarTorre()).productosEnAtencion
    const filas = (lista: typeof agotados) =>
      lista.map((p) => [p.productoId, p.nombre, formatearCantidad(p.stock, p.unidad), p.cobertura])
    expect(filas(agotados)).toEqual([['bolsas', 'Bolsas', '0 unid.', null]])
    // Menos días de cobertura primero; sin predicción, al final.
    expect(filas(porAcabarse)).toEqual([
      ['lejia', 'Lejía 1 L', '5 unid.', 'Se acaba en ~2 días'],
      ['jabon', 'Jabón', '2 unid.', null],
    ])
  })

  it('RN-AN-09: los más vendidos pueden mirar 30 días', async () => {
    const e = entorno([LEJIA, CARBON, JABON, BOLSAS, DETERGENTE, CERA_ROJA])
    await e.cargar(...historialesDelEscenario())
    const torre = await e.modulo.consultarTorre({ periodoMasVendidos: 30 })
    expect(torre.masVendidos.porVeces.map((f) => f.veces)).toEqual([28, 28, 28])
    expect(torre.masVendidos.porGanancia.map((f) => f.nombre)).toEqual([
      'Lejía 1 L',
      'Detergente a granel',
      'Carbón',
    ])
  })

  it('RN-SIS-09: la Torre de control lee la proyección de la tienda una sola vez', async () => {
    const e = entorno([LEJIA, CARBON, JABON, BOLSAS, DETERGENTE, CERA_ROJA])
    await e.cargar(...historialesDelEscenario())
    const entre = vi.spyOn(e.resumenes, 'entre')
    await e.modulo.consultarTorre()
    expect(entre).toHaveBeenCalledTimes(1)
  })

  describe('Alquiler del local (RN-AN-17 a RN-AN-19)', () => {
    it('sin configurar, la Torre lo avisa para que Control pregunte', async () => {
      const torre = await entorno([LEJIA]).modulo.consultarTorre()
      expect(torre.alquiler).toEqual({ estado: 'SIN_CONFIGURAR' })
    })

    it('con No pago, no hay avance que mostrar', async () => {
      const e = entorno([LEJIA])
      e.tienda.config = { ...e.tienda.config, alquilerDelLocal: { tipo: 'NO_PAGA' } }
      expect((await e.modulo.consultarTorre()).alquiler).toEqual({ estado: 'NO_PAGA' })
    })

    it('con pago, cuenta la ganancia neta desde el último pago (las ventas anteriores no cuentan)', async () => {
      const e = entorno([LEJIA])
      e.tienda.config = {
        ...e.tienda.config,
        alquilerDelLocal: { tipo: 'QUINCENAL', montoCentimos: 60000, dias: [5, 20] },
      }
      // Hoy es 15/10: último pago 05/10, próximo pago 20/10.
      await e.registrar(
        stockInicial('500'),
        vender('2026-10-04 12:00', '10'),
        vender('2026-10-05 08:00', '1'),
        vender('2026-10-06 12:00', '100'),
      )
      const { alquiler } = await e.modulo.consultarTorre()
      if (alquiler.estado !== 'CON_PAGO') throw new Error(`estado inesperado: ${alquiler.estado}`)
      expect(formatearDinero(alquiler.avance.llevas)).toBe('S/ 111.10')
      expect(alquiler.avance.proximoPago).toBe('2026-10-20')
      expect(alquiler.avance.porcentaje).toBe(18)
      expect(alquiler.textos).toEqual([
        'Para el pago del 20/10 llevas S/ 111.10 de S/ 600.00',
        'Te falta S/ 488.90',
      ])
    })

    it('no depende del periodo elegido en el Resumen', async () => {
      const e = entorno([LEJIA])
      e.tienda.config = {
        ...e.tienda.config,
        alquilerDelLocal: { tipo: 'MENSUAL', montoCentimos: 60000, dias: [5] },
      }
      await e.registrar(stockInicial('500'), vender('2026-10-06 12:00', '100'))
      const hoy = await e.modulo.consultarTorre({ periodo: 'HOY' })
      const mes = await e.modulo.consultarTorre({ periodo: '30_DIAS' })
      expect(hoy.alquiler).toEqual(mes.alquiler)
    })
  })
})
