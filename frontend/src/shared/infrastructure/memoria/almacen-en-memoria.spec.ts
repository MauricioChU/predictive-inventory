import { describe, expect, it } from 'vitest'
import { AlmacenEnMemoria } from './almacen-en-memoria'
import { UnidadDeTrabajoEnMemoria } from './unidad-de-trabajo-en-memoria'

// Fix round 1, M5.
describe('AlmacenEnMemoria', () => {
  it('un Blob sobrevive a guardar/obtener con el mismo contenido', async () => {
    const almacen = new AlmacenEnMemoria()
    const imagen = new Blob(['contenido de la foto'], { type: 'image/jpeg' })
    almacen.guardar('fotos', { productoId: 'p1', imagen })
    const leido = almacen.obtener('fotos', 'p1')
    expect(leido?.imagen.type).toBe('image/jpeg')
    expect(leido?.imagen.size).toBe(imagen.size)
    expect(await leido?.imagen.text()).toBe('contenido de la foto')
  })

  it('eliminar() se deshace si la unidad de trabajo falla', async () => {
    const almacen = new AlmacenEnMemoria()
    almacen.guardar('existencias', { productoId: 'p1', cantidad: 1000 })
    const uow = new UnidadDeTrabajoEnMemoria(almacen)
    await expect(
      uow.ejecutar(async () => {
        almacen.eliminar('existencias', 'p1')
        throw new Error('falla a mitad')
      }),
    ).rejects.toThrow('falla a mitad')
    expect(almacen.obtener('existencias', 'p1')?.cantidad).toBe(1000)
  })

  it('vaciar() se deshace si la unidad de trabajo falla', async () => {
    const almacen = new AlmacenEnMemoria()
    almacen.guardar('existencias', { productoId: 'p1', cantidad: 1000 })
    almacen.guardar('existencias', { productoId: 'p2', cantidad: 2000 })
    const uow = new UnidadDeTrabajoEnMemoria(almacen)
    await expect(
      uow.ejecutar(async () => {
        almacen.vaciar('existencias')
        throw new Error('falla a mitad')
      }),
    ).rejects.toThrow('falla a mitad')
    expect(almacen.todos('existencias')).toHaveLength(2)
  })
})
