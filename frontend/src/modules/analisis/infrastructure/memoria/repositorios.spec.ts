import { describe, expect, it } from 'vitest'
import type { ResumenDiarioRegistro } from '@/shared/contratos/registros'
import { AlmacenEnMemoria } from '@/shared/infrastructure/memoria/almacen-en-memoria'
import {
  RepositorioDeListaDeComprasEnMemoria,
  RepositorioDeResumenesEnMemoria,
} from './repositorios'

function fila(productoId: string, dia: string, lineasVendidas = 0): ResumenDiarioRegistro {
  return {
    clave: `${productoId}|${dia}`,
    productoId,
    dia,
    lineasVendidas,
    cantidadVendida: lineasVendidas * 1000,
    ventas: lineasVendidas * 350,
    costoVendido: lineasVendidas * 240,
    costoMermas: 0,
    valorAjustes: 0,
    cambioNeto: -lineasVendidas * 1000,
  }
}

describe('RepositorioDeResumenesEnMemoria', () => {
  function conFilas() {
    const repo = new RepositorioDeResumenesEnMemoria(new AlmacenEnMemoria())
    return Promise.all(
      [
        fila('lejia', '2026-10-14', 1),
        fila('carbon', '2026-10-01'),
        fila('lejia', '2026-08-01'),
        fila('carbon', '2026-10-14', 2),
        fila('lejia', '2026-10-15'),
        fila('lejia', '2026-09-20', 1),
      ].map((r) => repo.guardar(r)),
    ).then(() => repo)
  }

  it('obtiene una fila por producto y día, o null', async () => {
    const repo = await conFilas()
    expect(await repo.obtener('lejia', '2026-10-14')).toEqual(fila('lejia', '2026-10-14', 1))
    expect(await repo.obtener('lejia', '2026-10-13')).toBeNull()
  })

  it('devuelve las filas de un rango inclusivo, ordenadas por día y producto', async () => {
    const repo = await conFilas()
    expect((await repo.entre('2026-10-01', '2026-10-14')).map((r) => r.clave)).toEqual([
      'carbon|2026-10-01',
      'carbon|2026-10-14',
      'lejia|2026-10-14',
    ])
    expect(
      (await repo.deProductoEntre('lejia', '2026-09-20', '2026-10-15')).map((r) => r.clave),
    ).toEqual(['lejia|2026-09-20', 'lejia|2026-10-14', 'lejia|2026-10-15'])
  })

  it('conoce el primer día de un producto y de la tienda, y el último con ventas', async () => {
    const repo = await conFilas()
    expect(await repo.primerDiaDe('lejia')).toBe('2026-08-01')
    expect(await repo.primerDiaDe('carbon')).toBe('2026-10-01')
    expect(await repo.primerDiaDe('jabon')).toBeNull()
    expect(await repo.primerDiaDeLaTienda()).toBe('2026-08-01')
    expect(await repo.ultimoDiaConVentaDe('lejia')).toBe('2026-10-14')
    expect(await repo.ultimoDiaConVentaDe('jabon')).toBeNull()
  })

  it('vaciar borra todas las filas', async () => {
    const repo = await conFilas()
    await repo.vaciar()
    expect(await repo.entre('0000-01-01', '9999-12-31')).toEqual([])
    expect(await repo.primerDiaDeLaTienda()).toBeNull()
  })

  it('guardar reemplaza la fila con la misma clave', async () => {
    const repo = await conFilas()
    await repo.guardar(fila('lejia', '2026-10-14', 3))
    expect((await repo.obtener('lejia', '2026-10-14'))?.lineasVendidas).toBe(3)
  })
})

describe('RepositorioDeListaDeComprasEnMemoria', () => {
  it('RN-AN-08: guarda los cambios de la lista por día', async () => {
    const repo = new RepositorioDeListaDeComprasEnMemoria(new AlmacenEnMemoria())
    expect(await repo.delDia('2026-10-15')).toBeNull()
    await repo.guardar({ dia: '2026-10-15', cambios: [{ productoId: 'lejia', cantidad: 24000 }] })
    expect(await repo.delDia('2026-10-15')).toEqual({
      dia: '2026-10-15',
      cambios: [{ productoId: 'lejia', cantidad: 24000 }],
    })
    expect(await repo.delDia('2026-10-16')).toBeNull()
  })
})
