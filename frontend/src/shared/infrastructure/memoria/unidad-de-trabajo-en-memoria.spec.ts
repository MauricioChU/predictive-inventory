import { describe, expect, it } from 'vitest'
import { AlmacenEnMemoria } from './almacen-en-memoria'
import { UnidadDeTrabajoEnMemoria } from './unidad-de-trabajo-en-memoria'

const existencia = (productoId: string, cantidad: number) => ({ productoId, cantidad })

describe('UnidadDeTrabajoEnMemoria', () => {
  it('confirma todas las escrituras si el trabajo termina bien', async () => {
    const almacen = new AlmacenEnMemoria()
    const uow = new UnidadDeTrabajoEnMemoria(almacen)
    await uow.ejecutar(async () => {
      almacen.guardar('existencias', existencia('p1', 1000))
      almacen.guardar('existencias', existencia('p2', 2000))
    })
    expect(almacen.todos('existencias')).toHaveLength(2)
  })
  it('RN-OP-06: deshace todas las escrituras si el trabajo falla', async () => {
    const almacen = new AlmacenEnMemoria()
    almacen.guardar('existencias', existencia('p1', 1000))
    const uow = new UnidadDeTrabajoEnMemoria(almacen)
    await expect(
      uow.ejecutar(async () => {
        almacen.guardar('existencias', existencia('p1', 0))
        almacen.guardar('existencias', existencia('p2', 5000))
        throw new Error('falla a mitad')
      }),
    ).rejects.toThrow('falla a mitad')
    expect(almacen.obtener('existencias', 'p1')?.cantidad).toBe(1000)
    expect(almacen.obtener('existencias', 'p2')).toBeUndefined()
  })
  it('las llamadas anidadas se unen a la transacción externa', async () => {
    const almacen = new AlmacenEnMemoria()
    const uow = new UnidadDeTrabajoEnMemoria(almacen)
    await expect(
      uow.ejecutar(async () => {
        await uow.ejecutar(async () => {
          almacen.guardar('existencias', existencia('p1', 1000))
        })
        throw new Error('falla externa')
      }),
    ).rejects.toThrow()
    expect(almacen.obtener('existencias', 'p1')).toBeUndefined()
  })
  it('devuelve copias: modificar lo leído no cambia lo guardado', () => {
    const almacen = new AlmacenEnMemoria()
    almacen.guardar('existencias', existencia('p1', 1000))
    const leido = almacen.obtener('existencias', 'p1')!
    leido.cantidad = 0
    expect(almacen.obtener('existencias', 'p1')?.cantidad).toBe(1000)
  })
})
