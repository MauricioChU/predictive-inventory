import { describe, expect, it, vi } from 'vitest'
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

  // Fix round 3, minor 6: la llamada independiente que lanza ahora llega de verdad
  // mientras OTRA transacción está en curso (mid-flight), no sola.
  it('M4 (ronda 2): una llamada independiente que lanza, disparada mientras otra está en curso, no deja ninguna escritura parcial', async () => {
    const almacen = new AlmacenEnMemoria()
    const uow = new UnidadDeTrabajoEnMemoria(almacen)
    let liberarPrimera: () => void = () => {}
    const esperaDeLaPrimera = new Promise<void>((resolver) => {
      liberarPrimera = resolver
    })
    let primeraArranco: () => void = () => {}
    const senalPrimeraArranco = new Promise<void>((resolver) => {
      primeraArranco = resolver
    })

    const primera = uow.ejecutar(async () => {
      primeraArranco()
      almacen.guardar('existencias', existencia('en-curso', 1))
      await esperaDeLaPrimera
    })

    await senalPrimeraArranco

    // Llega MIENTRAS la primera todavía está en curso (mid-flight).
    const independienteQueFalla = uow.ejecutar(async () => {
      almacen.guardar('existencias', existencia('parcial', 1))
      throw new Error('falla')
    })

    liberarPrimera()
    await primera
    await expect(independienteQueFalla).rejects.toThrow('falla')

    expect(almacen.obtener('existencias', 'parcial')).toBeUndefined()
    expect(almacen.obtener('existencias', 'en-curso')?.cantidad).toBe(1) // la primera no se vio afectada
  })

  // Fix round 3, minor 1: el contexto de AsyncLocalStorage sobrevive a la transacción si un
  // trabajo arranca algo "fire-and-forget" (setTimeout, o un bus.publicar() sin esperar) que
  // luego llama a ejecutar(): ese callback hereda el contexto de ALS aunque la transacción
  // que lo originó YA haya terminado. Con un simple `true` en el store, ese ejecutar() tardío
  // se trataba como anidado — se saltaba la cola y su propia foto — y quedaba viviendo sin
  // protección en el almacén; si DESPUÉS otra transacción independiente (que ya estaba en
  // curso) fallaba, su rollback restauraba una foto tomada ANTES de esa escritura tardía y se
  // la llevaba por delante en silencio.
  it('Fix round 3, minor 1: una escritura disparada por un fire-and-forget (setTimeout) de un trabajo ya terminado no se pierde con el rollback de otra transacción independiente', async () => {
    const almacen = new AlmacenEnMemoria()
    const uow = new UnidadDeTrabajoEnMemoria(almacen)

    let seLlamoAEjecutarTardio: () => void = () => {}
    const senalSeLlamo = new Promise<void>((resolver) => {
      seLlamoAEjecutarTardio = resolver
    })

    // Transacción A: escribe algo y agenda un fire-and-forget (setTimeout, sin esperarlo)
    // que llamará a ejecutar() DESPUÉS de que A ya haya terminado.
    await uow.ejecutar(async () => {
      almacen.guardar('existencias', existencia('a', 1))
      setTimeout(() => {
        // Este callback corre con el contexto de ALS de A todavía "vivo" (fue agendado
        // dentro de A sin esperarlo), aunque comoTransaccion(A) ya haya vuelto.
        void uow.ejecutar(async () => {
          almacen.guardar('existencias', existencia('tardio', 1))
        })
        seLlamoAEjecutarTardio()
      }, 0)
    })

    // Transacción B: genuinamente independiente, arranca y queda a mitad de camino
    // (mid-flight) justo cuando el fire-and-forget llama a ejecutar() para "tardio".
    let bArranco: () => void = () => {}
    const senalBArranco = new Promise<void>((resolver) => {
      bArranco = resolver
    })
    const b = uow.ejecutar(async () => {
      bArranco()
      await senalSeLlamo // justo cuando (o después de que) se llamó a ejecutar() para "tardio"
      throw new Error('b falla')
    })

    await senalBArranco
    await expect(b).rejects.toThrow('b falla')

    // Deja que la cola drene lo que haya quedado pendiente ("tardio", si quedó encolada
    // detrás de B en vez de ejecutarse de inmediato por error).
    await uow.ejecutar(async () => {})

    expect(almacen.obtener('existencias', 'tardio')?.cantidad).toBe(1)
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

// Ola 3, ruling 1 (ADR-0002): los eventos y el Deshacer se disparan tras el commit de la
// transacción MÁS EXTERNA; si hay rollback, se descartan.
describe('UnidadDeTrabajoEnMemoria.alConfirmar', () => {
  it('ADR-0002: fuera de una transacción, la acción corre enseguida', () => {
    const uow = new UnidadDeTrabajoEnMemoria(new AlmacenEnMemoria())
    const bitacora: string[] = []
    uow.alConfirmar(() => {
      bitacora.push('accion')
    })
    expect(bitacora).toEqual(['accion'])
  })

  it('ADR-0002: dentro de una transacción, las acciones corren después del commit y en orden', async () => {
    const almacen = new AlmacenEnMemoria()
    const uow = new UnidadDeTrabajoEnMemoria(almacen)
    const bitacora: string[] = []
    const resultado = await uow.ejecutar(async () => {
      uow.alConfirmar(() => {
        bitacora.push(
          `primera (p1 guardado: ${almacen.obtener('existencias', 'p1') !== undefined})`,
        )
      })
      uow.alConfirmar(async () => {
        await Promise.resolve()
        bitacora.push('segunda')
      })
      uow.alConfirmar(() => {
        bitacora.push('tercera')
      })
      almacen.guardar('existencias', existencia('p1', 1000))
      bitacora.push('fin del trabajo')
      return 'listo'
    })
    expect(resultado).toBe('listo')
    // ejecutar() resuelve cuando ya corrieron (y terminaron) todas las acciones, en orden:
    // la segunda es asíncrona y la tercera espera a que termine.
    expect(bitacora).toEqual([
      'fin del trabajo',
      'primera (p1 guardado: true)',
      'segunda',
      'tercera',
    ])
  })

  it('ADR-0002: una acción registrada en una llamada anidada espera al commit de la externa', async () => {
    const uow = new UnidadDeTrabajoEnMemoria(new AlmacenEnMemoria())
    const bitacora: string[] = []
    await uow.ejecutar(async () => {
      await uow.ejecutar(async () => {
        uow.alConfirmar(() => {
          bitacora.push('accion anidada')
        })
      })
      bitacora.push('la anidada terminó')
      uow.alConfirmar(() => {
        bitacora.push('accion externa')
      })
      bitacora.push('la externa terminó')
    })
    expect(bitacora).toEqual([
      'la anidada terminó',
      'la externa terminó',
      'accion anidada',
      'accion externa',
    ])
  })

  it('RN-OP-06: si la transacción externa falla después de la anidada, se descartan todas las acciones', async () => {
    const almacen = new AlmacenEnMemoria()
    const uow = new UnidadDeTrabajoEnMemoria(almacen)
    const bitacora: string[] = []
    await expect(
      uow.ejecutar(async () => {
        await uow.ejecutar(async () => {
          almacen.guardar('existencias', existencia('p1', 1000))
          uow.alConfirmar(() => {
            bitacora.push('accion anidada')
          })
        })
        uow.alConfirmar(() => {
          bitacora.push('accion externa')
        })
        throw new Error('falla externa')
      }),
    ).rejects.toThrow('falla externa')
    expect(bitacora).toEqual([])
    expect(almacen.obtener('existencias', 'p1')).toBeUndefined()

    // Las acciones descartadas no reaparecen en la transacción siguiente.
    await uow.ejecutar(async () => {
      uow.alConfirmar(() => {
        bitacora.push('siguiente')
      })
    })
    expect(bitacora).toEqual(['siguiente'])
  })

  it('ADR-0002: una acción que lanza se registra con console.error y no impide las demás', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    try {
      const uow = new UnidadDeTrabajoEnMemoria(new AlmacenEnMemoria())
      const bitacora: string[] = []
      const resultado = await uow.ejecutar(async () => {
        uow.alConfirmar(() => {
          throw new Error('falla síncrona')
        })
        uow.alConfirmar(async () => {
          throw new Error('falla asíncrona')
        })
        uow.alConfirmar(() => {
          bitacora.push('la última corre igual')
        })
        return 42
      })
      expect(resultado).toBe(42)
      expect(bitacora).toEqual(['la última corre igual'])
      expect(error).toHaveBeenCalledTimes(2)
      expect(error.mock.calls.map((llamada) => (llamada[1] as Error).message)).toEqual([
        'falla síncrona',
        'falla asíncrona',
      ])
    } finally {
      error.mockRestore()
    }
  })

  it('ADR-0002: fuera de una transacción, una acción que lanza también se registra sin propagarse', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    try {
      const uow = new UnidadDeTrabajoEnMemoria(new AlmacenEnMemoria())
      expect(() =>
        uow.alConfirmar(() => {
          throw new Error('falla síncrona')
        }),
      ).not.toThrow()
      uow.alConfirmar(() => Promise.reject(new Error('falla asíncrona')))
      await vi.waitFor(() => expect(error).toHaveBeenCalledTimes(2))
    } finally {
      error.mockRestore()
    }
  })

  it('ADR-0002: las acciones corren fuera de la transacción: un ejecutar() dentro de una acción es independiente', async () => {
    const almacen = new AlmacenEnMemoria()
    const uow = new UnidadDeTrabajoEnMemoria(almacen)
    const bitacora: string[] = []
    // Como el manejador de un evento: escribe en su propia transacción y registra la suya.
    await uow.ejecutar(async () => {
      almacen.guardar('existencias', existencia('venta', 1))
      uow.alConfirmar(async () => {
        await expect(
          uow.ejecutar(async () => {
            almacen.guardar('existencias', existencia('del-manejador', 1))
            uow.alConfirmar(() => {
              bitacora.push('accion del manejador')
            })
            throw new Error('el manejador falla')
          }),
        ).rejects.toThrow('el manejador falla')
        bitacora.push('manejador terminado')
      })
    })
    // Si la acción hubiera corrido dentro de la transacción original, su ejecutar() se habría
    // unido a ella (y su rollback no habría deshecho "del-manejador").
    expect(almacen.obtener('existencias', 'venta')?.cantidad).toBe(1)
    expect(almacen.obtener('existencias', 'del-manejador')).toBeUndefined()
    expect(bitacora).toEqual(['manejador terminado'])
  })

  it('ADR-0002: una continuación tardía (fire-and-forget) de una transacción ya cerrada corre su acción enseguida', async () => {
    const uow = new UnidadDeTrabajoEnMemoria(new AlmacenEnMemoria())
    const bitacora: string[] = []
    let tardia: Promise<void> = Promise.resolve()
    await uow.ejecutar(async () => {
      tardia = new Promise<void>((resolver) => {
        setTimeout(() => {
          uow.alConfirmar(() => {
            bitacora.push('accion tardía')
          })
          resolver()
        }, 0)
      })
    })
    await tardia
    expect(bitacora).toEqual(['accion tardía'])
  })

  it('ADR-0002: dos transacciones independientes concurrentes no se mezclan las acciones', async () => {
    const uow = new UnidadDeTrabajoEnMemoria(new AlmacenEnMemoria())
    const bitacora: string[] = []
    const primera = uow.ejecutar(async () => {
      uow.alConfirmar(() => {
        bitacora.push('de la primera')
      })
      throw new Error('falla la primera')
    })
    const segunda = uow.ejecutar(async () => {
      uow.alConfirmar(() => {
        bitacora.push('de la segunda')
      })
    })
    await expect(primera).rejects.toThrow('falla la primera')
    await segunda
    expect(bitacora).toEqual(['de la segunda'])
  })
})
