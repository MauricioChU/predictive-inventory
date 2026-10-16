import { describe, expect, it } from 'vitest'
import type { ResumenDiarioRegistro } from '@/shared/contratos/registros'
import type { RepositorioDeListaDeCompras, RepositorioDeResumenes } from '../../application/puertos'

/**
 * Casos de prueba de los puertos de Análisis: los mismos para la implementación en memoria y
 * la de Dexie (los resultados deben ser idénticos). Cada fábrica devuelve un repositorio vacío.
 */
export interface FabricasDeRepositoriosDeAnalisis {
  resumenes: () => RepositorioDeResumenes
  listaDeCompras: () => RepositorioDeListaDeCompras
}

/**
 * Una fila con movimiento: `lineasVendidas` ventas de 1 unidad o, si es 0, un ingreso de
 * 1 unidad (así ninguna fila de estos casos es una "sin movimiento").
 */
export function fila(productoId: string, dia: string, lineasVendidas = 0): ResumenDiarioRegistro {
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
    cambioNeto: lineasVendidas > 0 ? -lineasVendidas * 1000 : 1000,
  }
}

/** Lo que queda de un día cuya única venta se anuló ese mismo día: todo en cero. */
export function filaSinMovimiento(productoId: string, dia: string): ResumenDiarioRegistro {
  return { ...fila(productoId, dia), cambioNeto: 0 }
}

export function probarRepositorioDeResumenes(crear: () => RepositorioDeResumenes): void {
  async function conFilas(): Promise<RepositorioDeResumenes> {
    const repo = crear()
    for (const r of [
      fila('lejia', '2026-10-14', 1),
      fila('carbon', '2026-10-01'),
      fila('lejia', '2026-08-01'),
      fila('carbon', '2026-10-14', 2),
      fila('lejia', '2026-10-15'),
      fila('lejia', '2026-09-20', 1),
    ]) {
      await repo.guardar(r)
    }
    return repo
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

  it('a igual día ordena por el id del producto (aunque un id empiece como otro)', async () => {
    const repo = crear()
    await repo.guardar(fila('ab', '2026-10-14', 1))
    await repo.guardar(fila('a', '2026-10-14', 1))
    await repo.guardar(fila('a-b', '2026-10-14', 1))
    expect((await repo.entre('2026-10-14', '2026-10-14')).map((r) => r.productoId)).toEqual([
      'a',
      'a-b',
      'ab',
    ])
  })

  it('las filas de un producto no incluyen las de otro cuyo id empieza igual', async () => {
    const repo = crear()
    await repo.guardar(fila('lejia', '2026-10-14', 1))
    await repo.guardar(fila('lejia-2', '2026-10-01', 1))
    await repo.guardar(fila('lejia-2', '2026-10-20', 1))
    expect(
      (await repo.deProductoEntre('lejia', '2026-01-01', '2026-12-31')).map((r) => r.clave),
    ).toEqual(['lejia|2026-10-14'])
    expect(await repo.primerDiaDe('lejia')).toBe('2026-10-14')
    expect(await repo.ultimoDiaConVentaDe('lejia')).toBe('2026-10-14')
  })

  it('conoce el primer día de un producto y de la tienda, y el último con ventas', async () => {
    const repo = await conFilas()
    expect(await repo.primerDiaDe('lejia')).toBe('2026-08-01')
    expect(await repo.primerDiaDe('carbon')).toBe('2026-10-01')
    expect(await repo.primerDiaDe('jabon')).toBeNull()
    expect(await repo.primerDiaDeLaTienda()).toBe('2026-08-01')
    expect(await repo.ultimoDiaConVentaDe('lejia')).toBe('2026-10-14')
    expect(await repo.ultimoDiaConVentaDe('carbon')).toBe('2026-10-14')
    expect(await repo.ultimoDiaConVentaDe('jabon')).toBeNull()
  })

  // Ola 3 (revisión de la Ola 2) y fix round 1, ruling 3: una operación anulada el MISMO día
  // deja su fila en cero, y esa fila no es "el primer movimiento" del producto (RN-OP-17). Una
  // anulación en otro día deja filas con cambio de stock que siguen contando (caso raro, aceptado).
  it('RN-AN-04: primerDiaDe ignora solo las filas en cero que deja una anulación del mismo día', async () => {
    const repo = await conFilas()
    await repo.guardar(filaSinMovimiento('lejia', '2026-07-01'))
    await repo.guardar(filaSinMovimiento('jabon', '2026-07-01'))
    await repo.guardar(fila('jabon', '2026-07-02'))
    expect(await repo.primerDiaDe('lejia')).toBe('2026-08-01')
    expect(await repo.primerDiaDe('jabon')).toBe('2026-07-02')
    await repo.guardar(filaSinMovimiento('escoba', '2026-07-01'))
    expect(await repo.primerDiaDe('escoba')).toBeNull()
  })

  it('primerDiaDeLaTienda cuenta el primer día con filas, aunque solo tenga una venta anulada ese mismo día', async () => {
    const repo = crear()
    await repo.guardar(filaSinMovimiento('lejia', '2026-08-01'))
    await repo.guardar(fila('carbon', '2026-10-01'))
    expect(await repo.primerDiaDeLaTienda()).toBe('2026-08-01')
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

  it('guardarVarios guarda todas las filas de una vez y reemplaza las de la misma clave', async () => {
    const repo = await conFilas()
    await repo.guardarVarios([
      fila('lejia', '2026-10-14', 5),
      fila('jabon', '2026-10-02', 1),
      fila('jabon', '2026-10-03'),
    ])
    expect((await repo.obtener('lejia', '2026-10-14'))?.lineasVendidas).toBe(5)
    expect(
      (await repo.deProductoEntre('jabon', '0000-01-01', '9999-12-31')).map((r) => r.clave),
    ).toEqual(['jabon|2026-10-02', 'jabon|2026-10-03'])
    expect(await repo.entre('0000-01-01', '9999-12-31')).toHaveLength(8)
    await repo.guardarVarios([])
    expect(await repo.entre('0000-01-01', '9999-12-31')).toHaveLength(8)
  })
}

export function probarRepositorioDeListaDeCompras(crear: () => RepositorioDeListaDeCompras): void {
  it('RN-AN-08: guarda los cambios de la lista por día', async () => {
    const repo = crear()
    expect(await repo.delDia('2026-10-15')).toBeNull()
    await repo.guardar({ dia: '2026-10-15', cambios: [{ productoId: 'lejia', cantidad: 24000 }] })
    expect(await repo.delDia('2026-10-15')).toEqual({
      dia: '2026-10-15',
      cambios: [{ productoId: 'lejia', cantidad: 24000 }],
    })
    expect(await repo.delDia('2026-10-16')).toBeNull()
  })

  it('RN-AN-08: guardar de nuevo el mismo día reemplaza sus cambios', async () => {
    const repo = crear()
    await repo.guardar({ dia: '2026-10-15', cambios: [{ productoId: 'lejia', cantidad: 24000 }] })
    await repo.guardar({ dia: '2026-10-15', cambios: [{ productoId: 'lejia', cantidad: null }] })
    expect(await repo.delDia('2026-10-15')).toEqual({
      dia: '2026-10-15',
      cambios: [{ productoId: 'lejia', cantidad: null }],
    })
  })
}

/** Corre los contratos de Análisis con las fábricas de una implementación. */
export function probarRepositoriosDeAnalisis(
  nombre: string,
  fabricas: FabricasDeRepositoriosDeAnalisis,
): void {
  describe(`RepositorioDeResumenes${nombre}`, () =>
    probarRepositorioDeResumenes(fabricas.resumenes))
  describe(`RepositorioDeListaDeCompras${nombre}`, () =>
    probarRepositorioDeListaDeCompras(fabricas.listaDeCompras))
}
