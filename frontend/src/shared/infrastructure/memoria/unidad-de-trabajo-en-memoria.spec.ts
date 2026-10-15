import { describe, expect, it } from 'vitest'
import { AlmacenEnMemoria } from './almacen-en-memoria'
import { UnidadDeTrabajoEnMemoria } from './unidad-de-trabajo-en-memoria'
import { BusEnMemoria } from '../../domain/eventos'

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

  // Fix round 2, M4: con un simple contador de profundidad (ronda 1), una llamada
  // INDEPENDIENTE que llega mientras otro trabajo ya está corriendo (tras su primer await)
  // se confundía con una anidada y terminaba compartiendo su transacción: si esa transacción
  // fallaba, su rollback borraba en silencio una escritura YA CONFIRMADA de la llamada
  // independiente. AsyncLocalStorage distingue "estoy dentro del trabajo de ESTA instancia"
  // (anidada) de "llegué mientras tanto, pero no soy parte de él" (independiente).
  it('M4 (ronda 2): una llamada independiente que llega mientras otro trabajo está en curso conserva su escritura confirmada aunque el primero falle', async () => {
    const almacen = new AlmacenEnMemoria()
    const uow = new UnidadDeTrabajoEnMemoria(almacen)
    let liberarPrimero: () => void = () => {}
    const esperaDelPrimero = new Promise<void>((resolver) => {
      liberarPrimero = resolver
    })
    let primeroArranco: () => void = () => {}
    const senalPrimeroArranco = new Promise<void>((resolver) => {
      primeroArranco = resolver
    })

    const primero = uow.ejecutar(async () => {
      primeroArranco() // "primero" ya está corriendo (profundidad ya estaría incrementada con el contador viejo)
      almacen.guardar('existencias', existencia('p1', 1000))
      await esperaDelPrimero
      throw new Error('falla tras esperar')
    })

    await senalPrimeroArranco

    const segundo = uow.ejecutar(async () => {
      almacen.guardar('existencias', existencia('p2', 2000))
    })

    liberarPrimero()
    await expect(primero).rejects.toThrow('falla tras esperar')
    await expect(segundo).resolves.toBeUndefined()

    expect(almacen.obtener('existencias', 'p1')).toBeUndefined()
    expect(almacen.obtener('existencias', 'p2')?.cantidad).toBe(2000)
  })

  it('M4 (ronda 2): una llamada independiente que lanza no deja ninguna escritura parcial', async () => {
    const almacen = new AlmacenEnMemoria()
    const uow = new UnidadDeTrabajoEnMemoria(almacen)
    await expect(
      uow.ejecutar(async () => {
        almacen.guardar('existencias', existencia('parcial', 1))
        throw new Error('falla')
      }),
    ).rejects.toThrow('falla')
    expect(almacen.obtener('existencias', 'parcial')).toBeUndefined()
  })

  it('M4 (ronda 2): el manejador de un evento publicado tras confirmar y una operación de usuario concurrente no comparten transacción', async () => {
    const almacen = new AlmacenEnMemoria()
    const uow = new UnidadDeTrabajoEnMemoria(almacen)
    const bus = new BusEnMemoria()
    let liberarManejador: () => void = () => {}
    const esperaDelManejador = new Promise<void>((resolver) => {
      liberarManejador = resolver
    })
    let manejadorArranco: () => void = () => {}
    const senalManejadorArranco = new Promise<void>((resolver) => {
      manejadorArranco = resolver
    })

    bus.suscribir('ProductoCreado', async () => {
      await uow.ejecutar(async () => {
        manejadorArranco()
        almacen.guardar('existencias', existencia('del-evento', 1))
        await esperaDelManejador
        throw new Error('el manejador del evento falla')
      })
    })

    // ADR-0002: se publica DESPUÉS de confirmar la unidad de trabajo original.
    await uow.ejecutar(async () => {
      almacen.guardar('existencias', existencia('venta-original', 1))
    })
    const publicacion = bus.publicar({ tipo: 'ProductoCreado', productoId: 'p1' })

    await senalManejadorArranco

    const operacionDeUsuario = uow.ejecutar(async () => {
      almacen.guardar('existencias', existencia('venta-de-usuario', 500))
    })

    liberarManejador()
    await publicacion // publicar() nunca rechaza (BusEnMemoria ya aísla fallas de manejadores)
    await operacionDeUsuario

    expect(almacen.obtener('existencias', 'del-evento')).toBeUndefined()
    expect(almacen.obtener('existencias', 'venta-de-usuario')?.cantidad).toBe(500)
  })
})
