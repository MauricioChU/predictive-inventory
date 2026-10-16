// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { Cantidad } from '@/shared/domain/cantidad'
import { crearBaseDePrueba } from '@/shared/infrastructure/dexie/__pruebas__/base-de-prueba'
import { UnidadDeTrabajoDexie } from '@/shared/infrastructure/dexie/unidad-de-trabajo-dexie'
import { probarRepositoriosDeInventario, registro } from '../__pruebas__/contrato-de-repositorios'
import {
  RepositorioDeConteoDexie,
  RepositorioDeExistenciasDexie,
  RepositorioDeOperacionesDexie,
} from './repositorios'

probarRepositoriosDeInventario('Dexie', {
  operaciones: () => new RepositorioDeOperacionesDexie(crearBaseDePrueba()),
  existencias: () => new RepositorioDeExistenciasDexie(crearBaseDePrueba()),
  conteo: () => new RepositorioDeConteoDexie(crearBaseDePrueba()),
})

describe('RepositorioDeOperacionesDexie', () => {
  it('porProducto y todas ordenan por registradaEn aunque los ids no sigan ese orden', async () => {
    const repositorio = new RepositorioDeOperacionesDexie(crearBaseDePrueba())
    await repositorio.agregar(registro('c', { registradaEn: '2026-10-15T15:00:00.000Z' }))
    await repositorio.agregar(registro('a', { registradaEn: '2026-10-15T15:10:00.000Z' }))
    await repositorio.agregar(
      registro('b', { productoIds: ['carbon'], registradaEn: '2026-10-15T15:05:00.000Z' }),
    )
    expect((await repositorio.todas()).map((r) => r.id)).toEqual(['c', 'b', 'a'])
    expect((await repositorio.porProducto('lejia')).map((r) => r.id)).toEqual(['c', 'a'])
  })

  it('ordena por el instante, no por el texto, si una operación trae otra zona horaria', async () => {
    const repositorio = new RepositorioDeOperacionesDexie(crearBaseDePrueba())
    // 10:30 en Lima (−05:00) es 15:30 UTC: va DESPUÉS de las 15:10 UTC.
    await repositorio.agregar(registro('op-lima', { registradaEn: '2026-10-15T10:30:00-05:00' }))
    await repositorio.agregar(registro('op-utc', { registradaEn: '2026-10-15T15:10:00.000Z' }))
    expect((await repositorio.todas()).map((r) => r.id)).toEqual(['op-utc', 'op-lima'])
    expect((await repositorio.porProducto('lejia')).map((r) => r.id)).toEqual(['op-utc', 'op-lima'])
  })

  it('a igual registradaEn el orden es estable (el mismo en cada lectura)', async () => {
    const repositorio = new RepositorioDeOperacionesDexie(crearBaseDePrueba())
    for (const id of ['op-3', 'op-1', 'op-2']) await repositorio.agregar(registro(id))
    const primera = (await repositorio.todas()).map((r) => r.id)
    expect((await repositorio.todas()).map((r) => r.id)).toEqual(primera)
    expect((await repositorio.porProducto('lejia')).map((r) => r.id)).toEqual(primera)
  })

  it('una operación de varios productos aparece una sola vez en porProducto', async () => {
    const repositorio = new RepositorioDeOperacionesDexie(crearBaseDePrueba())
    await repositorio.agregar(registro('op-1', { productoIds: ['lejia', 'carbon'] }))
    expect((await repositorio.porProducto('lejia')).map((r) => r.id)).toEqual(['op-1'])
    expect((await repositorio.porProducto('carbon')).map((r) => r.id)).toEqual(['op-1'])
  })

  it('RN-OP-02: dentro de una unidad de trabajo, el id repetido se puede atrapar sin perder lo demás', async () => {
    const db = crearBaseDePrueba()
    const repositorio = new RepositorioDeOperacionesDexie(db)
    const uow = new UnidadDeTrabajoDexie(db)
    await repositorio.agregar(registro('op-1'))
    await uow.ejecutar(async () => {
      await repositorio.agregar(registro('op-2'))
      await expect(repositorio.agregar(registro('op-1'))).rejects.toThrow(
        'La operación op-1 ya está registrada',
      )
    })
    expect((await repositorio.todas()).map((r) => r.id)).toEqual(['op-1', 'op-2'])
  })
})

describe('Repositorios de Inventario en Dexie con la unidad de trabajo', () => {
  it('RN-OP-06: si la unidad de trabajo falla, no queda ni la operación ni la existencia', async () => {
    const db = crearBaseDePrueba()
    const uow = new UnidadDeTrabajoDexie(db)
    const operaciones = new RepositorioDeOperacionesDexie(db)
    const existencias = new RepositorioDeExistenciasDexie(db)
    await existencias.fijar('lejia', Cantidad.deEntero(10))
    await expect(
      uow.ejecutar(async () => {
        await operaciones.agregar(registro('op-1'))
        await existencias.fijar('lejia', Cantidad.deEntero(9))
        await existencias.reemplazarTodas(new Map([['carbon', Cantidad.deEntero(1)]]))
        throw new Error('falla después de escribir')
      }),
    ).rejects.toThrow('falla después de escribir')
    expect(await operaciones.todas()).toEqual([])
    expect(await existencias.todas()).toEqual(new Map([['lejia', Cantidad.deEntero(10)]]))
  })

  it('la operación y la existencia se guardan como registros en su tabla', async () => {
    const db = crearBaseDePrueba()
    await new RepositorioDeOperacionesDexie(db).agregar(registro('op-1'))
    await new RepositorioDeExistenciasDexie(db).fijar('carbon', Cantidad.deTexto('1.25', 'KILO'))
    expect(await db.operaciones.get('op-1')).toEqual(registro('op-1'))
    expect(await db.existencias.get('carbon')).toEqual({ productoId: 'carbon', cantidad: 1250 })
  })
})
