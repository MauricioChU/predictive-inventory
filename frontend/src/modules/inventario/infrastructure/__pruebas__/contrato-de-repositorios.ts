import { describe, expect, it } from 'vitest'
import { Cantidad } from '@/shared/domain/cantidad'
import type { ConteoGuiadoRegistro, OperacionRegistro } from '@/shared/contratos/registros'
import type {
  RepositorioDeConteo,
  RepositorioDeExistencias,
  RepositorioDeOperaciones,
} from '../../application/puertos'

/**
 * Casos de prueba de los puertos de Inventario: los mismos para la implementación en memoria
 * y la de Dexie (los resultados deben ser idénticos). Cada fábrica devuelve un repositorio vacío.
 */
export interface FabricasDeRepositoriosDeInventario {
  operaciones: () => RepositorioDeOperaciones
  existencias: () => RepositorioDeExistencias
  conteo: () => RepositorioDeConteo
}

export function registro(
  id: string,
  cambios: Partial<OperacionRegistro> & { productoIds?: string[] } = {},
): OperacionRegistro {
  const productoIds = cambios.productoIds ?? ['lejia']
  return {
    id,
    tipo: 'VENTA',
    movimientos: productoIds.map((productoId) => ({
      productoId,
      cantidad: -1000,
      costoUnitario: 240,
      precioUnitario: 350,
    })),
    productoIds,
    ocurridaEn: '2026-10-15T15:00:00.000Z',
    registradaEn: '2026-10-15T15:00:00.000Z',
    motivo: null,
    nota: null,
    anulaA: null,
    dispositivoId: 'disp-1',
    ...cambios,
  }
}

export const CONTEO_EN_CURSO: ConteoGuiadoRegistro = {
  id: 'actual',
  iniciadoEn: '2026-10-15T15:00:00.000Z',
  orden: ['carbon', 'detergente', 'lejia'],
  posicion: 1,
  contados: [{ productoId: 'carbon', diferencia: 0, valor: 0 }],
  saltados: [],
  terminadoEn: null,
}

export function probarRepositorioDeOperaciones(crear: () => RepositorioDeOperaciones): void {
  it('agrega y lee por id; un id desconocido da null', async () => {
    const repositorio = crear()
    await repositorio.agregar(registro('op-1'))
    expect(await repositorio.porId('op-1')).toEqual(registro('op-1'))
    expect(await repositorio.porId('op-9')).toBeNull()
  })

  it('RN-OP-02: una operación registrada no se reemplaza', async () => {
    const repositorio = crear()
    await repositorio.agregar(registro('op-1'))
    await expect(repositorio.agregar(registro('op-1', { nota: 'cambiada' }))).rejects.toThrow(
      'La operación op-1 ya está registrada',
    )
    expect((await repositorio.porId('op-1'))?.nota).toBeNull()
  })

  it('anulacionDe encuentra la anulación de una operación', async () => {
    const repositorio = crear()
    await repositorio.agregar(registro('op-1'))
    await repositorio.agregar(registro('op-2'))
    expect(await repositorio.anulacionDe('op-1')).toBeNull()
    const anulacion = registro('op-3', { tipo: 'ANULACION', anulaA: 'op-1' })
    await repositorio.agregar(anulacion)
    expect(await repositorio.anulacionDe('op-1')).toEqual(anulacion)
    expect(await repositorio.anulacionDe('op-2')).toBeNull()
  })

  it('porProducto y todas devuelven las operaciones en el orden en que se registraron', async () => {
    const repositorio = crear()
    await repositorio.agregar(
      registro('op-1', {
        productoIds: ['lejia', 'carbon'],
        registradaEn: '2026-10-15T15:00:00.000Z',
      }),
    )
    await repositorio.agregar(
      registro('op-2', { productoIds: ['carbon'], registradaEn: '2026-10-15T15:05:00.000Z' }),
    )
    await repositorio.agregar(
      registro('op-3', { productoIds: ['lejia'], registradaEn: '2026-10-15T15:10:00.000Z' }),
    )
    expect((await repositorio.porProducto('lejia')).map((r) => r.id)).toEqual(['op-1', 'op-3'])
    expect((await repositorio.porProducto('carbon')).map((r) => r.id)).toEqual(['op-1', 'op-2'])
    expect(await repositorio.porProducto('detergente')).toEqual([])
    expect((await repositorio.todas()).map((r) => r.id)).toEqual(['op-1', 'op-2', 'op-3'])
  })
}

export function probarOrdenDeRegistro(crear: () => RepositorioDeOperaciones): void {
  // Ola 3 (ruling de la Ola 2): el puerto promete orden de registro (registradaEn), no de
  // inserción: tras restaurar una copia, o si el reloj del celular retrocedió, no coinciden.
  it('RN-OP-02: porProducto y todas ordenan por registradaEn aunque se hayan guardado en otro orden', async () => {
    const repositorio = crear()
    const a = (hora: string) => `2026-10-15T${hora}:00.000Z`
    await repositorio.agregar(registro('op-3', { registradaEn: a('17:00') }))
    await repositorio.agregar(
      registro('op-1', { registradaEn: a('15:00'), productoIds: ['lejia', 'carbon'] }),
    )
    await repositorio.agregar(registro('op-2', { registradaEn: a('16:00') }))
    // A igual registradaEn el orden solo es estable; aquí coinciden el de inserción (memoria)
    // y el de id (Dexie).
    await repositorio.agregar(registro('op-2b', { registradaEn: a('16:00') }))
    expect((await repositorio.porProducto('lejia')).map((r) => r.id)).toEqual([
      'op-1',
      'op-2',
      'op-2b',
      'op-3',
    ])
    expect((await repositorio.porProducto('carbon')).map((r) => r.id)).toEqual(['op-1'])
    expect((await repositorio.todas()).map((r) => r.id)).toEqual(['op-1', 'op-2', 'op-2b', 'op-3'])
  })

  it('porProducto y todas ordenan por registradaEn aunque los ids no sigan ese orden', async () => {
    const repositorio = crear()
    await repositorio.agregar(registro('c', { registradaEn: '2026-10-15T15:00:00.000Z' }))
    await repositorio.agregar(registro('a', { registradaEn: '2026-10-15T15:10:00.000Z' }))
    await repositorio.agregar(
      registro('b', { productoIds: ['carbon'], registradaEn: '2026-10-15T15:05:00.000Z' }),
    )
    expect((await repositorio.todas()).map((r) => r.id)).toEqual(['c', 'b', 'a'])
    expect((await repositorio.porProducto('lejia')).map((r) => r.id)).toEqual(['c', 'a'])
  })

  it('ordena por el instante, no por el texto, si una operación trae otra zona horaria', async () => {
    const repositorio = crear()
    // 10:30 en Lima (−05:00) es 15:30 UTC: va DESPUÉS de las 15:10 UTC.
    await repositorio.agregar(registro('op-lima', { registradaEn: '2026-10-15T10:30:00-05:00' }))
    await repositorio.agregar(registro('op-utc', { registradaEn: '2026-10-15T15:10:00.000Z' }))
    expect((await repositorio.todas()).map((r) => r.id)).toEqual(['op-utc', 'op-lima'])
    expect((await repositorio.porProducto('lejia')).map((r) => r.id)).toEqual(['op-utc', 'op-lima'])
  })

  it('a igual registradaEn el orden es estable (el mismo en cada lectura)', async () => {
    const repositorio = crear()
    for (const id of ['op-3', 'op-1', 'op-2']) await repositorio.agregar(registro(id))
    const primera = (await repositorio.todas()).map((r) => r.id)
    expect((await repositorio.todas()).map((r) => r.id)).toEqual(primera)
    expect((await repositorio.porProducto('lejia')).map((r) => r.id)).toEqual(primera)
  })

  it('una operación de varios productos aparece una sola vez en porProducto', async () => {
    const repositorio = crear()
    await repositorio.agregar(registro('op-1', { productoIds: ['lejia', 'carbon'] }))
    expect((await repositorio.porProducto('lejia')).map((r) => r.id)).toEqual(['op-1'])
    expect((await repositorio.porProducto('carbon')).map((r) => r.id)).toEqual(['op-1'])
  })
}

/** Los ids de una página, ordenados (el puerto no promete el orden dentro de la página). */
const idsDe = (registros: readonly OperacionRegistro[]) => registros.map((r) => r.id).sort()

/**
 * Plan 17: el Historial pide el libro de a páginas (lo más reciente primero), sin leerlo todo.
 * Los instantes son los que escribe la app (ISO UTC, `toISOString`).
 */
export function probarPaginasDelHistorial(crear: () => RepositorioDeOperaciones): void {
  const a = (hora: string) => `2026-10-15T${hora}:00.000Z`

  it('recientes: lo más reciente primero, de a `cuantas`, con el cursor para seguir', async () => {
    const repositorio = crear()
    // Registradas en otro orden: lo que manda es cuándo ocurrieron.
    for (const [id, hora] of [
      ['op-3', '13:00'],
      ['op-1', '11:00'],
      ['op-5', '15:00'],
      ['op-2', '12:00'],
      ['op-4', '14:00'],
    ] as const) {
      await repositorio.agregar(registro(id, { ocurridaEn: a(hora) }))
    }
    const primera = await repositorio.recientes({ cuantas: 2 })
    expect(idsDe(primera.registros)).toEqual(['op-4', 'op-5'])
    expect(primera.siguiente).toBe(a('14:00'))
    const segunda = await repositorio.recientes({ cuantas: 2, antesDe: primera.siguiente! })
    expect(idsDe(segunda.registros)).toEqual(['op-2', 'op-3'])
    const tercera = await repositorio.recientes({ cuantas: 2, antesDe: segunda.siguiente! })
    expect(idsDe(tercera.registros)).toEqual(['op-1'])
    expect(tercera.siguiente).toBeNull()
  })

  it('recientes: si la página llega justo al final, no ofrece otra', async () => {
    const repositorio = crear()
    for (const [id, hora] of [
      ['op-1', '11:00'],
      ['op-2', '12:00'],
    ] as const) {
      await repositorio.agregar(registro(id, { ocurridaEn: a(hora) }))
    }
    expect(await repositorio.recientes({ cuantas: 2 })).toEqual({
      registros: expect.any(Array),
      siguiente: null,
    })
    expect(await repositorio.recientes({ cuantas: 5 })).toMatchObject({ siguiente: null })
  })

  it('recientes: nunca corta un grupo de operaciones del mismo instante', async () => {
    const repositorio = crear()
    await repositorio.agregar(registro('op-nueva', { ocurridaEn: a('15:00') }))
    // Tres ventas anotadas "ayer a esta hora" (mismo ocurridaEn), registradas en otro momento.
    for (const id of ['op-b', 'op-a', 'op-c']) {
      await repositorio.agregar(registro(id, { ocurridaEn: a('12:00'), registradaEn: a('16:00') }))
    }
    await repositorio.agregar(registro('op-vieja', { ocurridaEn: a('10:00') }))
    const primera = await repositorio.recientes({ cuantas: 2 })
    expect(idsDe(primera.registros)).toEqual(['op-a', 'op-b', 'op-c', 'op-nueva'])
    expect(primera.siguiente).toBe(a('12:00'))
    const segunda = await repositorio.recientes({ cuantas: 2, antesDe: primera.siguiente! })
    expect(segunda).toEqual({
      registros: [registro('op-vieja', { ocurridaEn: a('10:00') })],
      siguiente: null,
    })
  })

  it('recientes: filtra por tipo (y el cursor sigue entre las de ese tipo)', async () => {
    const repositorio = crear()
    await repositorio.agregar(registro('merma-1', { tipo: 'MERMA', ocurridaEn: a('11:00') }))
    await repositorio.agregar(registro('venta-1', { ocurridaEn: a('12:00') }))
    await repositorio.agregar(registro('merma-2', { tipo: 'MERMA', ocurridaEn: a('13:00') }))
    await repositorio.agregar(registro('venta-2', { ocurridaEn: a('14:00') }))
    const primera = await repositorio.recientes({ tipo: 'MERMA', cuantas: 1 })
    expect(idsDe(primera.registros)).toEqual(['merma-2'])
    expect(primera.siguiente).toBe(a('13:00'))
    const segunda = await repositorio.recientes({
      tipo: 'MERMA',
      cuantas: 1,
      antesDe: primera.siguiente!,
    })
    expect(idsDe(segunda.registros)).toEqual(['merma-1'])
    expect(segunda.siguiente).toBeNull()
    expect(await repositorio.recientes({ tipo: 'AJUSTE', cuantas: 5 })).toEqual({
      registros: [],
      siguiente: null,
    })
  })

  it('recientes: sin operaciones, una página vacía', async () => {
    expect(await crear().recientes({ cuantas: 60 })).toEqual({ registros: [], siguiente: null })
  })

  it('conAnulacion: cuáles de esas operaciones tienen una anulación', async () => {
    const repositorio = crear()
    await repositorio.agregar(registro('op-1'))
    await repositorio.agregar(registro('op-2'))
    await repositorio.agregar(registro('op-3', { tipo: 'ANULACION', anulaA: 'op-1' }))
    expect(await repositorio.conAnulacion(['op-1', 'op-2', 'op-9'])).toEqual(new Set(['op-1']))
    expect(await repositorio.conAnulacion([])).toEqual(new Set())
  })
}

export function probarRepositorioDeExistencias(crear: () => RepositorioDeExistencias): void {
  it('un producto sin registro tiene existencia 0', async () => {
    expect(await crear().obtener('lejia')).toEqual(Cantidad.cero())
  })

  it('fija y obtiene la existencia en milésimas', async () => {
    const repositorio = crear()
    await repositorio.fijar('carbon', Cantidad.deTexto('1.25', 'KILO'))
    expect(await repositorio.obtener('carbon')).toEqual(Cantidad.deMilesimas(1250))
    await repositorio.fijar('carbon', Cantidad.deEntero(3))
    expect(await repositorio.obtener('carbon')).toEqual(Cantidad.deEntero(3))
  })

  it('todas y reemplazarTodas', async () => {
    const repositorio = crear()
    await repositorio.fijar('lejia', Cantidad.deEntero(10))
    await repositorio.fijar('carbon', Cantidad.deEntero(7))
    expect(await repositorio.todas()).toEqual(
      new Map([
        ['lejia', Cantidad.deEntero(10)],
        ['carbon', Cantidad.deEntero(7)],
      ]),
    )
    await repositorio.reemplazarTodas(new Map([['carbon', Cantidad.deEntero(10)]]))
    expect(await repositorio.todas()).toEqual(new Map([['carbon', Cantidad.deEntero(10)]]))
    expect(await repositorio.obtener('lejia')).toEqual(Cantidad.cero())
  })
}

export function probarRepositorioDeConteo(crear: () => RepositorioDeConteo): void {
  it('guarda y obtiene el conteo en curso; sin conteo da null', async () => {
    const repositorio = crear()
    expect(await repositorio.obtener()).toBeNull()
    await repositorio.guardar(CONTEO_EN_CURSO)
    expect(await repositorio.obtener()).toEqual(CONTEO_EN_CURSO)
  })

  it('guardar de nuevo reemplaza el conteo en curso (hay uno solo)', async () => {
    const repositorio = crear()
    await repositorio.guardar(CONTEO_EN_CURSO)
    const siguiente = { ...CONTEO_EN_CURSO, posicion: 2, saltados: ['detergente'] }
    await repositorio.guardar(siguiente)
    expect(await repositorio.obtener()).toEqual(siguiente)
  })
}

/** Corre los tres contratos de Inventario con las fábricas de una implementación. */
export function probarRepositoriosDeInventario(
  nombre: string,
  fabricas: FabricasDeRepositoriosDeInventario,
): void {
  describe(`RepositorioDeOperaciones${nombre}`, () => {
    probarRepositorioDeOperaciones(fabricas.operaciones)
    probarOrdenDeRegistro(fabricas.operaciones)
    probarPaginasDelHistorial(fabricas.operaciones)
  })
  describe(`RepositorioDeExistencias${nombre}`, () =>
    probarRepositorioDeExistencias(fabricas.existencias))
  describe(`RepositorioDeConteo${nombre}`, () => probarRepositorioDeConteo(fabricas.conteo))
}
