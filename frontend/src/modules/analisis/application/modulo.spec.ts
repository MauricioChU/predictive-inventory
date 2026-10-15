import { describe, expect, it, vi } from 'vitest'
import { formatearDinero } from '@/shared/domain/formato'
import { RelojFijo } from '@/shared/domain/reloj'
import { AlmacenEnMemoria } from '@/shared/infrastructure/memoria/almacen-en-memoria'
import { UnidadDeTrabajoEnMemoria } from '@/shared/infrastructure/memoria/unidad-de-trabajo-en-memoria'
import { AHORA, crearEntorno } from '../__pruebas__/entorno'
import { nuevaOperacion } from '../domain/__pruebas__/operaciones'
import { CARBON, LEJIA } from '../domain/__pruebas__/productos'
import {
  RepositorioDeListaDeComprasEnMemoria,
  RepositorioDeResumenesEnMemoria,
} from '../infrastructure/memoria/repositorios'
import { crearModuloAnalisis } from './modulo'

const LEJIA_LINEA = { producto: 'lejia', precio: '3.50', costo: '2.40' }
const CARBON_LINEA = { producto: 'carbon', precio: '4.00', costo: '2.75' }

function entorno() {
  return crearEntorno({ productos: [LEJIA, CARBON], uow: (a) => new UnidadDeTrabajoEnMemoria(a) })
}

describe('crearModuloAnalisis', () => {
  it('recibe los otros módulos como funciones perezosas y no las llama al crearse', () => {
    const almacen = new AlmacenEnMemoria()
    const perezoso = vi.fn(() => {
      throw new Error('todavía no existe')
    })
    const modulo = crearModuloAnalisis({
      resumenes: new RepositorioDeResumenesEnMemoria(almacen),
      listaDeCompras: new RepositorioDeListaDeComprasEnMemoria(almacen),
      uow: new UnidadDeTrabajoEnMemoria(almacen),
      reloj: new RelojFijo(AHORA),
      catalogo: perezoso,
      inventario: perezoso,
      tienda: perezoso,
    })
    expect(modulo.proyeccion).toBeDefined()
    expect(modulo.consultable).toBeDefined()
    expect(perezoso).not.toHaveBeenCalled()
  })

  it('la proyección que expone es la que alimenta las consultas', async () => {
    const e = entorno()
    await e.modulo.proyeccion.alRegistrar(
      nuevaOperacion('VENTA', '2026-10-15 10:00', [{ ...LEJIA_LINEA, cantidad: '2' }]),
    )
    expect(formatearDinero((await e.modulo.consultarResumen('HOY')).ventas)).toBe('S/ 7.00')
    await e.modulo.proyeccion.reconstruir([])
    expect((await e.modulo.consultarResumen('HOY')).ventas.esCero()).toBe(true)
  })
})

describe('AnalisisConsultable para otros módulos', () => {
  async function conMovimientos() {
    const e = entorno()
    await e.registrar(
      nuevaOperacion('STOCK_INICIAL', '2026-10-01 08:00', [
        { ...LEJIA_LINEA, cantidad: '50' },
        { ...CARBON_LINEA, cantidad: '20' },
      ]),
      nuevaOperacion('VENTA', '2026-10-13 10:00', [
        { ...LEJIA_LINEA, cantidad: '2' },
        { ...CARBON_LINEA, cantidad: '1.25' },
      ]),
      nuevaOperacion('VENTA', '2026-10-14 10:00', [{ ...LEJIA_LINEA, cantidad: '1' }]),
      nuevaOperacion('VENTA', '2026-10-14 11:00', [{ ...LEJIA_LINEA, cantidad: '1' }]),
      nuevaOperacion('MERMA', '2026-10-14 12:00', [{ ...CARBON_LINEA, cantidad: '0.5' }]),
      nuevaOperacion('AJUSTE', '2026-10-12 12:00', [{ ...LEJIA_LINEA, cantidad: '-1' }]),
      nuevaOperacion('INGRESO', '2026-10-11 12:00', [{ ...LEJIA_LINEA, cantidad: '5' }]),
    )
    return e
  }

  it('RN-AN-09: veces vendido por producto en un rango', async () => {
    const e = await conMovimientos()
    expect(await e.modulo.consultable.vecesVendido('2026-10-13', '2026-10-15')).toEqual(
      new Map([
        ['lejia', 3],
        ['carbon', 1],
      ]),
    )
    expect(await e.modulo.consultable.vecesVendido('2026-10-14', '2026-10-14')).toEqual(
      new Map([['lejia', 2]]),
    )
  })

  it('RN-AN-02: totales del día (para la ganancia de ayer del resumen del día)', async () => {
    const e = await conMovimientos()
    const ayer = await e.modulo.consultable.totalesDelDia('2026-10-14')
    expect(ayer.dia).toBe('2026-10-14')
    expect({
      ventas: formatearDinero(ayer.ventas),
      costoVendido: formatearDinero(ayer.costoVendido),
      gananciaBruta: formatearDinero(ayer.gananciaBruta),
      mermas: formatearDinero(ayer.mermas),
      gananciaNeta: formatearDinero(ayer.gananciaNeta),
      diferenciasDeConteo: formatearDinero(ayer.diferenciasDeConteo),
    }).toEqual({
      ventas: 'S/ 7.00',
      costoVendido: 'S/ 4.80',
      gananciaBruta: 'S/ 2.20',
      mermas: 'S/ 1.38',
      gananciaNeta: 'S/ 0.82',
      diferenciasDeConteo: 'S/ 0.00',
    })
    const sinNada = await e.modulo.consultable.totalesDelDia('2026-10-15')
    expect(sinNada.dia).toBe('2026-10-15')
    expect(sinNada.ventas.esCero()).toBe(true)
  })

  it('RN-AN-02: resúmenes de la tienda por día, solo los días con ventas, mermas o ajustes', async () => {
    const e = await conMovimientos()
    const dias = await e.modulo.consultable.resumenesDeTienda('2026-10-01', '2026-10-15')
    expect(
      dias.map((d) => [d.dia, formatearDinero(d.ventas), formatearDinero(d.gananciaNeta)]),
    ).toEqual([
      ['2026-10-12', 'S/ 0.00', 'S/ 0.00'],
      ['2026-10-13', 'S/ 12.00', 'S/ 3.76'],
      ['2026-10-14', 'S/ 7.00', 'S/ 0.82'],
    ])
    expect(formatearDinero(dias[0]!.diferenciasDeConteo)).toBe('-S/ 2.40')
    expect(await e.modulo.consultable.resumenesDeTienda('2026-10-14', '2026-10-14')).toHaveLength(1)
  })
})
