// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { crearBaseDePrueba } from '@/shared/infrastructure/dexie/__pruebas__/base-de-prueba'
import { UnidadDeTrabajoDexie } from '@/shared/infrastructure/dexie/unidad-de-trabajo-dexie'
import {
  fila,
  filaSinMovimiento,
  probarRepositoriosDeAnalisis,
} from '../__pruebas__/contrato-de-repositorios'
import { RepositorioDeListaDeComprasDexie, RepositorioDeResumenesDexie } from './repositorios'

probarRepositoriosDeAnalisis('Dexie', {
  resumenes: () => new RepositorioDeResumenesDexie(crearBaseDePrueba()),
  listaDeCompras: () => new RepositorioDeListaDeComprasDexie(crearBaseDePrueba()),
})

describe('RepositorioDeResumenesDexie', () => {
  it('primerDiaDe y primerDiaDeLaTienda ignoran las filas sin ningún movimiento (p. ej. una venta anulada el mismo día)', async () => {
    const repo = new RepositorioDeResumenesDexie(crearBaseDePrueba())
    await repo.guardar(filaSinMovimiento('lejia', '2026-08-01'))
    await repo.guardar(fila('lejia', '2026-09-20', 1))
    await repo.guardar(filaSinMovimiento('carbon', '2026-07-01'))
    await repo.guardar(fila('carbon', '2026-10-01'))
    await repo.guardar(filaSinMovimiento('jabon', '2026-06-01'))
    expect(await repo.primerDiaDe('lejia')).toBe('2026-09-20')
    expect(await repo.primerDiaDe('carbon')).toBe('2026-10-01')
    expect(await repo.primerDiaDe('jabon')).toBeNull()
    expect(await repo.primerDiaDeLaTienda()).toBe('2026-09-20')
    // Las demás consultas sí las devuelven: las filas siguen ahí.
    expect(await repo.obtener('lejia', '2026-08-01')).toEqual(
      filaSinMovimiento('lejia', '2026-08-01'),
    )
  })

  it('guardarVarios es atómico: si una fila no se puede guardar, no se guarda ninguna', async () => {
    const db = crearBaseDePrueba()
    const repo = new RepositorioDeResumenesDexie(db)
    const sinClave = { ...fila('jabon', '2026-10-02'), clave: undefined } as unknown as ReturnType<
      typeof fila
    >
    await expect(repo.guardarVarios([fila('lejia', '2026-10-01', 1), sinClave])).rejects.toThrow()
    expect(await db.resumenes.count()).toBe(0)
  })

  it('dentro de una unidad de trabajo que falla, vaciar y guardarVarios se revierten', async () => {
    const db = crearBaseDePrueba()
    const repo = new RepositorioDeResumenesDexie(db)
    await repo.guardar(fila('lejia', '2026-10-01', 1))
    await expect(
      new UnidadDeTrabajoDexie(db).ejecutar(async () => {
        await repo.vaciar()
        await repo.guardarVarios([fila('carbon', '2026-10-02', 2)])
        throw new Error('falla al reconstruir')
      }),
    ).rejects.toThrow('falla al reconstruir')
    expect((await repo.entre('0000-01-01', '9999-12-31')).map((r) => r.clave)).toEqual([
      'lejia|2026-10-01',
    ])
  })
})
