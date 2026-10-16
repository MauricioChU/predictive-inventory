import { describe, expect, it, vi } from 'vitest'
import type { ProductoResumido } from '@/shared/contratos/entre-modulos'
import { UnidadDeTrabajoEnMemoria } from '@/shared/infrastructure/memoria/unidad-de-trabajo-en-memoria'
import { crearEntorno } from '../__pruebas__/entorno'
import { historial } from '../domain/__pruebas__/historial'
import { anulacionDe, nuevaOperacion } from '../domain/__pruebas__/operaciones'
import { cant, ESCOBA, LEJIA, producto, TRAPEADOR } from '../domain/__pruebas__/productos'

function entorno(productos: readonly ProductoResumido[]) {
  return crearEntorno({ productos, uow: (a) => new UnidadDeTrabajoEnMemoria(a) })
}

const LEJIA_56_EN_28 = (stockInicial: number) =>
  historial('lejia')
    .primerMovimiento('2026-08-01', stockInicial)
    .vendio(56, '2026-09-17', '2026-10-14')
    .construir()

describe('situaciones de los productos (AnalisisConsultable)', () => {
  it('RN-AL-01: un producto archivado no tiene estado', async () => {
    const archivada = { ...ESCOBA, activo: false }
    const e = entorno([LEJIA, archivada])
    e.inventario.stock.set('escoba', cant('3'))
    const situaciones = await e.modulo.consultable.situaciones()
    expect(situaciones.map((s) => s.productoId)).toEqual(['lejia'])
    expect(await e.modulo.consultable.situacion('escoba')).toBeNull()
    expect(await e.modulo.consultable.situacion('no-existe')).toBeNull()
  })

  it.each([
    ['0', 'AGOTADO'],
    ['1', 'POR_ACABARSE'],
    ['3', 'POR_ACABARSE'],
    ['4', 'NORMAL'],
  ] as const)('RN-AL-01: sin predicción, stock %s con mínimo 3 → %s', async (stock, estado) => {
    const e = entorno([LEJIA])
    e.inventario.stock.set('lejia', cant(stock))
    const s = await e.modulo.consultable.situacion('lejia')
    expect(s).toMatchObject({ estado, prediccion: null, diasDeCobertura: null })
  })

  it('RN-AL-01: sin existencias guardadas el producto está agotado', async () => {
    const e = entorno([LEJIA])
    const [s] = await e.modulo.consultable.situaciones()
    expect(s).toMatchObject({ estado: 'AGOTADO', enListaParaComprar: true })
    expect(s?.stock.esCero()).toBe(true)
  })

  it('RN-AL-01: con predicción, se avisa antes de llegar al mínimo (cobertura 3)', async () => {
    const e = entorno([LEJIA])
    await e.cargar(LEJIA_56_EN_28(62))
    const s = await e.modulo.consultable.situacion('lejia')
    expect(s).toMatchObject({
      productoId: 'lejia',
      nombre: 'Lejía 1 L',
      unidad: 'UNIDAD',
      diasDeCobertura: 3,
      estado: 'POR_ACABARSE',
      enListaParaComprar: true,
      parado: null,
    })
    expect(s?.stock).toEqual(cant('6'))
    expect(s?.stockMinimo).toEqual(cant('3'))
    expect(s?.prediccion).toEqual({ vendido: cant('56'), diasValidos: 28 })
    expect(s?.cantidadSugerida).toEqual(cant('11'))
  })

  it('RN-AN-04: las ventas de hoy no entran en el promedio', async () => {
    const e = entorno([LEJIA])
    await e.cargar(LEJIA_56_EN_28(100))
    await e.registrar(
      nuevaOperacion('VENTA', '2026-10-15 12:00', [
        { producto: 'lejia', cantidad: '5', precio: '3.50', costo: '2.40' },
      ]),
    )
    const s = await e.modulo.consultable.situacion('lejia')
    expect(s?.prediccion).toEqual({ vendido: cant('56'), diasValidos: 28 })
    expect(s?.stock).toEqual(cant('39'))
  })

  it('situacion(id) y situaciones() dicen lo mismo de un producto', async () => {
    const e = entorno([LEJIA])
    await e.cargar(LEJIA_56_EN_28(61))
    const [deLaLista] = await e.modulo.consultable.situaciones()
    expect(await e.modulo.consultable.situacion('lejia')).toEqual(deLaLista)
  })

  it('RN-AN-11: un producto parado sabe hace cuántos días no se vende', async () => {
    const e = entorno([ESCOBA, TRAPEADOR])
    await e.registrar(
      nuevaOperacion('STOCK_INICIAL', '2026-07-17 08:00', [
        { producto: 'escoba', cantidad: '5', costo: '6.00' },
      ]),
      nuevaOperacion('VENTA', '2026-08-31 10:00', [
        { producto: 'escoba', cantidad: '1', precio: '9.00', costo: '6.00' },
      ]),
      // La última venta del trapeador es anterior a la ventana de 60 días que se lee de una vez.
      nuevaOperacion('STOCK_INICIAL', '2026-07-01 08:00', [
        { producto: 'trapeador', cantidad: '3', costo: '8.00' },
      ]),
      nuevaOperacion('VENTA', '2026-07-20 10:00', [
        { producto: 'trapeador', cantidad: '1', precio: '12.00', costo: '8.00' },
      ]),
    )
    const situaciones = await e.modulo.consultable.situaciones()
    expect(situaciones.map((s) => [s.productoId, s.parado])).toEqual([
      ['escoba', { diasSinVender: 45 }],
      ['trapeador', { diasSinVender: 87 }],
    ])
    expect(await e.modulo.consultable.situacion('trapeador')).toMatchObject({
      parado: { diasSinVender: 87 },
    })
  })

  it('RN-AN-11: un producto que nunca vendió cuenta desde su primer movimiento', async () => {
    const e = entorno([TRAPEADOR])
    await e.registrar(
      nuevaOperacion('STOCK_INICIAL', '2026-09-05 08:00', [
        { producto: 'trapeador', cantidad: '2', costo: '8.00' },
      ]),
    )
    expect(await e.modulo.consultable.situacion('trapeador')).toMatchObject({
      parado: { diasSinVender: 40 },
    })
  })

  it('RN-SIS-09: situaciones() lee la proyección de toda la tienda una sola vez', async () => {
    const productos = Array.from({ length: 20 }, (_, i) =>
      producto(`p${i}`, `Producto ${i}`, 'UNIDAD', '1.00', '2.00', '1'),
    )
    const e = entorno(productos)
    await e.cargar(
      ...productos.map((p) =>
        historial(p.id)
          .primerMovimiento('2026-08-01', 100)
          .vendio(28, '2026-09-17', '2026-10-14')
          .construir(),
      ),
    )
    const entre = vi.spyOn(e.resumenes, 'entre')
    const situaciones = await e.modulo.consultable.situaciones()
    expect(situaciones).toHaveLength(20)
    expect(situaciones.every((s) => s.prediccion?.diasValidos === 28)).toBe(true)
    expect(entre).toHaveBeenCalledTimes(1)
    expect(entre).toHaveBeenCalledWith('2026-08-16', '2026-10-15')
  })

  it('RN-SIS-09: situaciones() lee el primer día de todos los productos de una vez, no uno por uno', async () => {
    const productos = Array.from({ length: 20 }, (_, i) =>
      producto(`p${i}`, `Producto ${i}`, 'UNIDAD', '1.00', '2.00', '1'),
    )
    const e = entorno(productos)
    await e.cargar(
      ...productos.map((p) => historial(p.id).primerMovimiento('2026-08-01', 100).construir()),
    )
    const primerosDias = vi.spyOn(e.resumenes, 'primerosDias')
    const primerDiaDe = vi.spyOn(e.resumenes, 'primerDiaDe')
    expect(await e.modulo.consultable.situaciones()).toHaveLength(20)
    expect(await e.modulo.consultarTorre()).toBeDefined()
    expect(primerosDias).toHaveBeenCalledTimes(2)
    expect(primerDiaDe).not.toHaveBeenCalled()
  })

  // "Contra la implementación anterior": la misma consulta con un primerDiaDe por producto.
  it('RN-AN-04, RN-AL-01: con primerosDias, situaciones y la torre dan lo mismo que con un primerDiaDe por producto', async () => {
    const productos = [LEJIA, ESCOBA, TRAPEADOR, { ...LEJIA, id: 'archivada', activo: false }]
    const e = entorno(productos)
    const STOCK = (p: string, n: string) => [{ producto: p, cantidad: n, costo: '1.00' }]
    const venta = (p: string, n: string) => [{ ...STOCK(p, n)[0]!, precio: '2.00' }]
    await e.registrar(
      nuevaOperacion('STOCK_INICIAL', '2026-08-01 08:00', STOCK('lejia', '40')),
      nuevaOperacion('STOCK_INICIAL', '2026-08-01 08:00', STOCK('archivada', '5')),
      nuevaOperacion('VENTA', '2026-09-20 10:00', venta('lejia', '3')),
      nuevaOperacion('VENTA', '2026-10-14 10:00', venta('lejia', '2')),
    )
    // Escoba: su primera "venta" se anuló el mismo día (fila en cero); su primer movimiento real
    // es después. Trapeador: sin movimientos.
    const anulada = nuevaOperacion('STOCK_INICIAL', '2026-07-01 08:00', STOCK('escoba', '9'))
    await e.registrar(anulada)
    await e.anular(anulada, anulacionDe(anulada, '2026-07-01 09:00'))
    await e.registrar(nuevaOperacion('INGRESO', '2026-09-01 08:00', STOCK('escoba', '6')))

    const conLote = {
      situaciones: await e.modulo.consultable.situaciones(),
      torre: await e.modulo.consultarTorre(),
    }
    const anterior = e.resumenes
    vi.spyOn(anterior, 'primerosDias').mockImplementation(async () => {
      const dias = new Map<string, string>()
      for (const p of productos) {
        const dia = await anterior.primerDiaDe(p.id)
        if (dia !== null) dias.set(p.id, dia)
      }
      return dias
    })
    expect({
      situaciones: await e.modulo.consultable.situaciones(),
      torre: await e.modulo.consultarTorre(),
    }).toStrictEqual(conLote)
    expect(conLote.situaciones.map((s) => s.productoId)).toEqual(['lejia', 'escoba', 'trapeador'])
  })

  it('RN-SIS-09: situacion(id) lee solo las filas de ese producto', async () => {
    const e = entorno([LEJIA])
    const entre = vi.spyOn(e.resumenes, 'entre')
    const deProducto = vi.spyOn(e.resumenes, 'deProductoEntre')
    await e.modulo.consultable.situacion('lejia')
    expect(entre).not.toHaveBeenCalled()
    expect(deProducto).toHaveBeenCalledWith('lejia', '2026-08-16', '2026-10-15')
  })

  it('ADR-0002: las existencias y las filas de la ventana se leen en una misma lectura (uow.leer)', async () => {
    /** Marca cuándo corre la consulta de una lectura (no solo cuándo se pide). */
    class UnidadQueMarca extends UnidadDeTrabajoEnMemoria {
      dentro = 0
      override leer<T>(consulta: () => Promise<T>): Promise<T> {
        return super.leer(async () => {
          this.dentro++
          try {
            return await consulta()
          } finally {
            this.dentro--
          }
        })
      }
    }
    let uow: UnidadQueMarca | null = null
    const e = crearEntorno({
      productos: [LEJIA],
      uow: (almacen) => (uow = new UnidadQueMarca(almacen)),
    })
    await e.cargar(LEJIA_56_EN_28(62))
    const leidasDentro: string[] = []
    const existencias = e.inventario.existencias.bind(e.inventario)
    vi.spyOn(e.inventario, 'existencias').mockImplementation(async () => {
      if (uow!.dentro > 0) leidasDentro.push('existencias')
      return existencias()
    })
    const entre = e.resumenes.entre.bind(e.resumenes)
    vi.spyOn(e.resumenes, 'entre').mockImplementation(async (desde, hasta) => {
      if (uow!.dentro > 0) leidasDentro.push('entre')
      return entre(desde, hasta)
    })

    const [s] = await e.modulo.consultable.situaciones()
    expect(leidasDentro.sort()).toEqual(['entre', 'existencias'])
    expect(s).toMatchObject({ estado: 'POR_ACABARSE', diasDeCobertura: 3 })
  })
})
