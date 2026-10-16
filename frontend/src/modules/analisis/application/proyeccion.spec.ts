import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { OperacionRegistro } from '@/shared/contratos/registros'
import { AlmacenEnMemoria } from '@/shared/infrastructure/memoria/almacen-en-memoria'
import { UnidadDeTrabajoEnMemoria } from '@/shared/infrastructure/memoria/unidad-de-trabajo-en-memoria'
import { anulacionDe, nuevaOperacion } from '../domain/__pruebas__/operaciones'
import { RepositorioDeResumenesEnMemoria } from '../infrastructure/memoria/repositorios'
import { ProyeccionDeResumenes } from './proyeccion'

const LEJIA = { producto: 'lejia', precio: '3.50', costo: '2.40' }
const CARBON = { producto: 'carbon', precio: '4.00', costo: '2.75' }

describe('ProyeccionDeResumenes', () => {
  let almacen: AlmacenEnMemoria
  let resumenes: RepositorioDeResumenesEnMemoria
  let proyeccion: ProyeccionDeResumenes

  let uow: UnidadDeTrabajoEnMemoria

  beforeEach(() => {
    almacen = new AlmacenEnMemoria()
    resumenes = new RepositorioDeResumenesEnMemoria(almacen)
    uow = new UnidadDeTrabajoEnMemoria(almacen)
    proyeccion = new ProyeccionDeResumenes(resumenes, uow)
  })

  async function todas() {
    return resumenes.entre('0000-01-01', '9999-12-31')
  }

  it('RN-AN-02: acumula en la fila existente del producto y día', async () => {
    await proyeccion.alRegistrar(
      nuevaOperacion('STOCK_INICIAL', '2026-10-15 08:00', [{ ...LEJIA, cantidad: '20' }]),
    )
    await proyeccion.alRegistrar(
      nuevaOperacion('VENTA', '2026-10-15 10:00', [
        { ...LEJIA, cantidad: '4' },
        { ...CARBON, cantidad: '1.25' },
      ]),
    )
    await proyeccion.alRegistrar(
      nuevaOperacion('MERMA', '2026-10-15 11:00', [{ ...LEJIA, cantidad: '1' }]),
    )
    await proyeccion.alRegistrar(
      nuevaOperacion('AJUSTE', '2026-10-15 12:00', [{ ...LEJIA, cantidad: '-1' }]),
    )
    expect(await resumenes.obtener('lejia', '2026-10-15')).toEqual({
      clave: 'lejia|2026-10-15',
      productoId: 'lejia',
      dia: '2026-10-15',
      lineasVendidas: 1,
      cantidadVendida: 4000,
      ventas: 1400,
      costoVendido: 960,
      costoMermas: 240,
      valorAjustes: -240,
      cambioNeto: 14000,
    })
    expect(await resumenes.obtener('carbon', '2026-10-15')).toMatchObject({
      ventas: 500,
      costoVendido: 344,
    })
  })

  it('RN-AN-01: anular una venta de hoy deja las métricas en 0 y el cambio neto en 0', async () => {
    const venta = nuevaOperacion('VENTA', '2026-10-15 10:00', [{ ...LEJIA, cantidad: '3' }])
    await proyeccion.alRegistrar(venta)
    await proyeccion.alAnular(venta, anulacionDe(venta, '2026-10-15 10:01'))
    expect(await resumenes.obtener('lejia', '2026-10-15')).toMatchObject({
      lineasVendidas: 0,
      cantidadVendida: 0,
      ventas: 0,
      costoVendido: 0,
      cambioNeto: 0,
    })
  })

  it('RN-AN-01: anular hoy una venta de ayer: métricas de ayer en 0, stock −2 ayer y +2 hoy', async () => {
    const venta = nuevaOperacion('VENTA', '2026-10-14 17:00', [{ ...LEJIA, cantidad: '2' }])
    await proyeccion.alRegistrar(venta)
    await proyeccion.alAnular(venta, anulacionDe(venta, '2026-10-15 09:00'))
    expect(await resumenes.obtener('lejia', '2026-10-14')).toMatchObject({
      lineasVendidas: 0,
      ventas: 0,
      costoVendido: 0,
      cambioNeto: -2000,
    })
    expect(await resumenes.obtener('lejia', '2026-10-15')).toMatchObject({
      lineasVendidas: 0,
      ventas: 0,
      cambioNeto: 2000,
    })
  })

  it('RN-OP-09: una operación con fecha pasada se suma en su día', async () => {
    await proyeccion.alRegistrar(
      nuevaOperacion('VENTA', '2026-10-10 12:00', [{ ...LEJIA, cantidad: '1' }], {
        registradaEn: '2026-10-15 09:00',
      }),
    )
    expect(await resumenes.obtener('lejia', '2026-10-10')).toMatchObject({ ventas: 350 })
    expect(await resumenes.obtener('lejia', '2026-10-15')).toBeNull()
  })

  it('reconstruir produce lo mismo que aplicar las operaciones una por una', async () => {
    const inicial = nuevaOperacion('STOCK_INICIAL', '2026-10-01 08:00', [
      { ...LEJIA, cantidad: '20' },
      { ...CARBON, cantidad: '10' },
    ])
    const venta1 = nuevaOperacion('VENTA', '2026-10-14 10:00', [
      { ...LEJIA, cantidad: '2' },
      { ...CARBON, cantidad: '1.5' },
    ])
    const venta2 = nuevaOperacion('VENTA', '2026-10-15 10:00', [{ ...LEJIA, cantidad: '3' }])
    const merma = nuevaOperacion('MERMA', '2026-10-13 18:00', [{ ...CARBON, cantidad: '0.5' }], {
      registradaEn: '2026-10-15 10:30',
    })
    const ajuste = nuevaOperacion('AJUSTE', '2026-10-15 11:00', [{ ...LEJIA, cantidad: '-1' }])
    const anulacion = anulacionDe(venta1, '2026-10-15 12:00')
    const libro: OperacionRegistro[] = [inicial, venta1, venta2, merma, ajuste, anulacion]

    for (const op of libro) {
      if (op.tipo === 'ANULACION') await proyeccion.alAnular(venta1, op)
      else await proyeccion.alRegistrar(op)
    }
    const unaPorUna = await todas()

    almacen.guardar('resumenes', {
      ...unaPorUna[0]!,
      clave: 'basura|2026-01-01',
      dia: '2026-01-01',
    })
    await proyeccion.reconstruir([...libro].reverse())
    expect(await todas()).toEqual(unaPorUna)
  })

  it('RN-SIS-09: reconstruir escribe toda la proyección con una sola escritura masiva', async () => {
    const guardar = vi.spyOn(resumenes, 'guardar')
    const guardarVarios = vi.spyOn(resumenes, 'guardarVarios')
    await proyeccion.reconstruir([
      nuevaOperacion('STOCK_INICIAL', '2026-10-01 08:00', [
        { ...LEJIA, cantidad: '20' },
        { ...CARBON, cantidad: '10' },
      ]),
      nuevaOperacion('VENTA', '2026-10-14 10:00', [{ ...LEJIA, cantidad: '2' }]),
    ])
    expect(guardar).not.toHaveBeenCalled()
    expect(guardarVarios).toHaveBeenCalledTimes(1)
    expect(guardarVarios.mock.calls[0]![0].map((r) => r.clave).sort()).toEqual([
      'carbon|2026-10-01',
      'lejia|2026-10-01',
      'lejia|2026-10-14',
    ])
    expect(await todas()).toHaveLength(3)
  })

  it('reconstruir es atómico: si falla, la proyección queda como estaba', async () => {
    await proyeccion.alRegistrar(
      nuevaOperacion('VENTA', '2026-10-15 10:00', [{ ...LEJIA, cantidad: '1' }]),
    )
    const antes = await todas()
    const rota = { ...nuevaOperacion('VENTA', '2026-10-15 11:00', []), movimientos: null }
    await expect(proyeccion.reconstruir([rota as unknown as OperacionRegistro])).rejects.toThrow()
    expect(await todas()).toEqual(antes)
  })

  // Ola 3: Inventario la llama dentro de su transacción (la más externa); la proyección no
  // publica nada, pero sus filas siguen la suerte de esa transacción.
  it('RN-OP-06: dentro de la transacción de Inventario, si esa falla después, no queda ninguna fila', async () => {
    await expect(
      uow.ejecutar(async () => {
        await proyeccion.alRegistrar(
          nuevaOperacion('VENTA', '2026-10-15 10:00', [{ ...LEJIA, cantidad: '1' }]),
        )
        throw new Error('falla externa')
      }),
    ).rejects.toThrow('falla externa')
    expect(await todas()).toEqual([])
  })
})
