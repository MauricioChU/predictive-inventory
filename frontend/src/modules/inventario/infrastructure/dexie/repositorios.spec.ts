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
