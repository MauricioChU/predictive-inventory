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
  // Fix round 1, M4: dos llamadas de NIVEL SUPERIOR disparadas sin esperar una a la otra no
  // deben compartir transacción. Antes, como profundidad se incrementaba de forma síncrona
  // antes del primer `await`, la segunda llamada se veía a sí misma como "anidada" en la
  // primera y, si la primera fallaba, el rollback de la primera también borraba lo que la
  // segunda ya había guardado.
  it('M4: dos ejecutar() de nivel superior concurrentes no comparten transacción', async () => {
    const almacen = new AlmacenEnMemoria()
    const uow = new UnidadDeTrabajoEnMemoria(almacen)
    const p1 = uow.ejecutar(async () => {
      almacen.guardar('existencias', existencia('p1', 1000))
      throw new Error('falla en la primera')
    })
    const p2 = uow.ejecutar(async () => {
      almacen.guardar('existencias', existencia('p2', 2000))
    })
    await expect(p1).rejects.toThrow('falla en la primera')
    await expect(p2).resolves.toBeUndefined()
    expect(almacen.obtener('existencias', 'p1')).toBeUndefined()
    expect(almacen.obtener('existencias', 'p2')?.cantidad).toBe(2000)
  })
  it('M4: las llamadas anidadas siguen uniéndose a la transacción externa (con la cola de por medio)', async () => {
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
})
