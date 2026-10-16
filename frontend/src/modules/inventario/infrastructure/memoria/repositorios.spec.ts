import { beforeEach, describe, expect, it } from 'vitest'
import { Cantidad } from '@/shared/domain/cantidad'
import { AlmacenEnMemoria } from '@/shared/infrastructure/memoria/almacen-en-memoria'
import type { ConteoGuiadoRegistro, OperacionRegistro } from '@/shared/contratos/registros'
import {
  RepositorioDeConteoEnMemoria,
  RepositorioDeExistenciasEnMemoria,
  RepositorioDeOperacionesEnMemoria,
} from './repositorios'

function registro(
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

describe('RepositorioDeOperacionesEnMemoria', () => {
  let almacen: AlmacenEnMemoria
  let repositorio: RepositorioDeOperacionesEnMemoria

  beforeEach(() => {
    almacen = new AlmacenEnMemoria()
    repositorio = new RepositorioDeOperacionesEnMemoria(almacen)
  })

  it('agrega y lee por id; un id desconocido da null', async () => {
    await repositorio.agregar(registro('op-1'))
    expect(await repositorio.porId('op-1')).toEqual(registro('op-1'))
    expect(await repositorio.porId('op-9')).toBeNull()
    expect(almacen.obtener('operaciones', 'op-1')).toEqual(registro('op-1'))
  })

  it('RN-OP-02: una operación registrada no se reemplaza', async () => {
    await repositorio.agregar(registro('op-1'))
    await expect(repositorio.agregar(registro('op-1', { nota: 'cambiada' }))).rejects.toThrow(
      'La operación op-1 ya está registrada',
    )
    expect((await repositorio.porId('op-1'))?.nota).toBeNull()
  })

  it('anulacionDe encuentra la anulación de una operación', async () => {
    await repositorio.agregar(registro('op-1'))
    await repositorio.agregar(registro('op-2'))
    expect(await repositorio.anulacionDe('op-1')).toBeNull()
    const anulacion = registro('op-3', { tipo: 'ANULACION', anulaA: 'op-1' })
    await repositorio.agregar(anulacion)
    expect(await repositorio.anulacionDe('op-1')).toEqual(anulacion)
    expect(await repositorio.anulacionDe('op-2')).toBeNull()
  })

  it('porProducto y todas devuelven las operaciones en el orden en que se registraron', async () => {
    await repositorio.agregar(registro('op-1', { productoIds: ['lejia', 'carbon'] }))
    await repositorio.agregar(registro('op-2', { productoIds: ['carbon'] }))
    await repositorio.agregar(registro('op-3', { productoIds: ['lejia'] }))
    expect((await repositorio.porProducto('lejia')).map((r) => r.id)).toEqual(['op-1', 'op-3'])
    expect((await repositorio.porProducto('carbon')).map((r) => r.id)).toEqual(['op-1', 'op-2'])
    expect(await repositorio.porProducto('detergente')).toEqual([])
    expect((await repositorio.todas()).map((r) => r.id)).toEqual(['op-1', 'op-2', 'op-3'])
  })

  // Ola 3 (ruling de la Ola 2): el puerto promete orden de registro (registradaEn), no de
  // inserción: tras restaurar una copia, o si el reloj del celular retrocedió, no coinciden.
  it('RN-OP-02: porProducto y todas ordenan por registradaEn aunque se hayan guardado en otro orden', async () => {
    const a = (hora: string) => `2026-10-15T${hora}:00.000Z`
    almacen.guardar('operaciones', registro('op-3', { registradaEn: a('17:00') }))
    almacen.guardar(
      'operaciones',
      registro('op-1', { registradaEn: a('15:00'), productoIds: ['lejia', 'carbon'] }),
    )
    almacen.guardar('operaciones', registro('op-2', { registradaEn: a('16:00') }))
    almacen.guardar('operaciones', registro('op-2b', { registradaEn: a('16:00') }))
    expect((await repositorio.porProducto('lejia')).map((r) => r.id)).toEqual([
      'op-1',
      'op-2',
      'op-2b',
      'op-3',
    ])
    expect((await repositorio.porProducto('carbon')).map((r) => r.id)).toEqual(['op-1'])
    expect((await repositorio.todas()).map((r) => r.id)).toEqual(['op-1', 'op-2', 'op-2b', 'op-3'])
  })
})

describe('RepositorioDeExistenciasEnMemoria', () => {
  let almacen: AlmacenEnMemoria
  let repositorio: RepositorioDeExistenciasEnMemoria

  beforeEach(() => {
    almacen = new AlmacenEnMemoria()
    repositorio = new RepositorioDeExistenciasEnMemoria(almacen)
  })

  it('un producto sin registro tiene existencia 0', async () => {
    expect(await repositorio.obtener('lejia')).toEqual(Cantidad.cero())
  })

  it('fija y obtiene la existencia en milésimas', async () => {
    await repositorio.fijar('carbon', Cantidad.deTexto('1.25', 'KILO'))
    expect(await repositorio.obtener('carbon')).toEqual(Cantidad.deMilesimas(1250))
    expect(almacen.obtener('existencias', 'carbon')).toEqual({
      productoId: 'carbon',
      cantidad: 1250,
    })
  })

  it('todas y reemplazarTodas', async () => {
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
})

describe('RepositorioDeConteoEnMemoria', () => {
  it('guarda y obtiene el conteo en curso; sin conteo da null', async () => {
    const repositorio = new RepositorioDeConteoEnMemoria(new AlmacenEnMemoria())
    expect(await repositorio.obtener()).toBeNull()
    const conteo: ConteoGuiadoRegistro = {
      id: 'actual',
      iniciadoEn: '2026-10-15T15:00:00.000Z',
      orden: ['carbon', 'detergente', 'lejia'],
      posicion: 1,
      contados: [{ productoId: 'carbon', diferencia: 0, valor: 0 }],
      saltados: [],
      terminadoEn: null,
    }
    await repositorio.guardar(conteo)
    expect(await repositorio.obtener()).toEqual(conteo)
  })
})
