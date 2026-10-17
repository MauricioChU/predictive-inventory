import { afterEach, describe, expect, it, vi } from 'vitest'
import { AlmacenEnMemoria } from '../../../../shared/infrastructure/memoria/almacen-en-memoria'
import { UnidadDeTrabajoEnMemoria } from '../../../../shared/infrastructure/memoria/unidad-de-trabajo-en-memoria'
import {
  operacion,
  probarAlmacenDeRespaldo,
  producto,
  type EntornoDeAlmacenDeRespaldo,
} from '../__pruebas__/contrato-de-almacen-de-respaldo'
import { AlmacenDeRespaldoEnMemoria } from './almacen-de-respaldo'

function entorno(memoria = new AlmacenEnMemoria()): EntornoDeAlmacenDeRespaldo {
  return {
    almacen: new AlmacenDeRespaldoEnMemoria(memoria),
    async sembrar(tabla, ...registros) {
      for (const registro of registros) memoria.guardar(tabla, registro)
    },
    async leer(tabla) {
      return memoria.todos(tabla)
    },
  }
}

describe('AlmacenDeRespaldoEnMemoria', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  probarAlmacenDeRespaldo(() => entorno())

  it('leerTodo toma una foto coherente: lo escrito mientras convierte las fotos no entra', async () => {
    const memoria = new AlmacenEnMemoria()
    memoria.guardar('productos', producto('lejia'))
    memoria.guardar('fotos', { productoId: 'lejia', imagen: new Blob([new Uint8Array([1])]) })
    const arrayBuffer = Blob.prototype.arrayBuffer
    vi.spyOn(Blob.prototype, 'arrayBuffer').mockImplementation(function (this: Blob) {
      // Llega mientras leerTodo convierte la foto a base64.
      memoria.guardar('operaciones', operacion('op-durante'))
      memoria.guardar('productos', producto('nuevo'))
      return arrayBuffer.call(this)
    })
    const datos = await entorno(memoria).almacen.leerTodo()
    expect(datos.operaciones).toEqual([])
    expect(datos.productos.map((p) => p.id)).toEqual(['lejia'])
  })

  it('con la unidad de trabajo, no lee lo que deja a medias una transacción en curso que después falla', async () => {
    const memoria = new AlmacenEnMemoria()
    const uow = new UnidadDeTrabajoEnMemoria(memoria)
    memoria.guardar('productos', producto('lejia'))
    let seguir!: () => void
    const pausa = new Promise<void>((resolver) => (seguir = resolver))
    let empezo!: () => void
    const empezada = new Promise<void>((resolver) => (empezo = resolver))
    const enCurso = uow
      .ejecutar(async () => {
        memoria.guardar('operaciones', operacion('op-a-medias'))
        empezo()
        await pausa
        throw new Error('falla después de escribir')
      })
      .catch(() => undefined)
    await empezada

    const lectura = new AlmacenDeRespaldoEnMemoria(memoria, uow).leerTodo()
    seguir()
    await enCurso

    expect((await lectura).operaciones).toEqual([])
  })
})
