import { afterEach, expect, it, vi } from 'vitest'
import type { UnidadDeTrabajo } from '../../application/unidad-de-trabajo'

/**
 * Una unidad de trabajo con un almacén mínimo para observarla: `escribir` guarda una marca
 * (dentro de la transacción en curso, si hay una) y `leer` devuelve las marcas guardadas.
 */
export interface EntornoDeUnidadDeTrabajo {
  /** Ola 3 (composición): las dos implementaciones dejan esperar las acciones sueltas. */
  uow: UnidadDeTrabajo & { esperarAcciones(): Promise<void> }
  escribir(marca: string): Promise<void>
  /** Las marcas guardadas, ordenadas. */
  leer(): Promise<string[]>
}

function esperar(ms: number): Promise<void> {
  return new Promise((resolver) => setTimeout(resolver, ms))
}

/**
 * El contrato de `UnidadDeTrabajo` (shared/application/unidad-de-trabajo.ts, Ola 3, ruling
 * 1): los mismos casos para la unidad de trabajo en memoria y la de Dexie, para que la
 * composición se comporte igual con las dos. `crear` devuelve un entorno vacío.
 */
export function probarUnidadDeTrabajo(crear: () => EntornoDeUnidadDeTrabajo): void {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('RN-OP-06: confirma todo lo que escribe el trabajo y devuelve su resultado', async () => {
    const { uow, escribir, leer } = crear()
    const resultado = await uow.ejecutar(async () => {
      await escribir('c1')
      await escribir('c2')
      return 'listo'
    })
    expect(resultado).toBe('listo')
    expect(await leer()).toEqual(['c1', 'c2'])
  })

  it('RN-OP-06: si el trabajo falla, no queda nada de lo que escribió', async () => {
    const { uow, escribir, leer } = crear()
    await escribir('antes')
    await expect(
      uow.ejecutar(async () => {
        await escribir('c1')
        await escribir('c2')
        throw new Error('falla a mitad')
      }),
    ).rejects.toThrow('falla a mitad')
    expect(await leer()).toEqual(['antes'])
  })

  it('RN-OP-06: una llamada anidada se une a la en curso; si su error no se atrapa, se revierte todo', async () => {
    const { uow, escribir, leer } = crear()
    await expect(
      uow.ejecutar(async () => {
        await escribir('c1')
        await uow.ejecutar(async () => {
          await escribir('c2')
          throw new Error('falla la anidada')
        })
      }),
    ).rejects.toThrow('falla la anidada')
    expect(await leer()).toEqual([])
  })

  it('ADR-0002: fuera de una transacción, alConfirmar corre la acción enseguida', () => {
    const { uow } = crear()
    let corrio = false
    uow.alConfirmar(() => {
      corrio = true
    })
    expect(corrio).toBe(true)
  })

  it('ADR-0002: dentro, las acciones corren tras el commit de la más externa, en orden y de a una; ejecutar resuelve después', async () => {
    const { uow, escribir, leer } = crear()
    const orden: string[] = []
    await uow.ejecutar(async () => {
      await escribir('c1')
      uow.alConfirmar(async () => {
        await esperar(10)
        orden.push(`lenta, ve ${(await leer()).join(',')}`)
      })
      uow.alConfirmar(() => {
        orden.push('rápida')
      })
      orden.push('fin del trabajo')
    })
    expect(orden).toEqual(['fin del trabajo', 'lenta, ve c1', 'rápida'])
  })

  it('ADR-0002: una acción registrada en una llamada anidada espera al commit de la externa', async () => {
    const { uow, escribir } = crear()
    const orden: string[] = []
    await uow.ejecutar(async () => {
      await uow.ejecutar(async () => {
        await escribir('c1')
        uow.alConfirmar(() => {
          orden.push('acción de la anidada')
        })
      })
      orden.push('terminó la anidada')
      uow.alConfirmar(() => {
        orden.push('acción de la externa')
      })
      orden.push('fin de la externa')
    })
    expect(orden).toEqual([
      'terminó la anidada',
      'fin de la externa',
      'acción de la anidada',
      'acción de la externa',
    ])
  })

  it('RN-OP-06: si la externa falla, se descartan todas sus acciones (también las de anidadas)', async () => {
    const { uow, escribir, leer } = crear()
    const corrieron: string[] = []
    await expect(
      uow.ejecutar(async () => {
        uow.alConfirmar(() => {
          corrieron.push('externa')
        })
        await uow.ejecutar(async () => {
          await escribir('c1')
          uow.alConfirmar(() => {
            corrieron.push('anidada')
          })
        })
        throw new Error('rollback')
      }),
    ).rejects.toThrow('rollback')
    await esperar(0)
    expect(corrieron).toEqual([])
    expect(await leer()).toEqual([])
  })

  it('ADR-0002: si la externa atrapa el error de una anidada y confirma, las acciones de la anidada corren igual', async () => {
    const { uow, escribir, leer } = crear()
    const corrieron: string[] = []
    await uow.ejecutar(async () => {
      await escribir('c1')
      await uow
        .ejecutar(async () => {
          await escribir('c2')
          uow.alConfirmar(() => {
            corrieron.push('anidada')
          })
          throw new Error('falla la anidada')
        })
        .catch(() => undefined)
      await escribir('c3')
      uow.alConfirmar(() => {
        corrieron.push('externa')
      })
    })
    // Sin puntos de guardado: lo de la anidada también queda.
    expect(await leer()).toEqual(['c1', 'c2', 'c3'])
    expect(corrieron).toEqual(['anidada', 'externa'])
  })

  it('ADR-0002: una acción que lanza o rechaza se registra con console.error; las demás corren y ejecutar resuelve con su resultado', async () => {
    const { uow, escribir, leer } = crear()
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const corrieron: string[] = []
    const resultado = await uow.ejecutar(async () => {
      await escribir('c1')
      uow.alConfirmar(() => {
        throw new Error('lanza')
      })
      uow.alConfirmar(async () => {
        throw new Error('rechaza')
      })
      uow.alConfirmar(() => {
        corrieron.push('tercera')
      })
      return 'confirmado'
    })
    expect(resultado).toBe('confirmado')
    expect(corrieron).toEqual(['tercera'])
    expect(error).toHaveBeenCalledTimes(2)
    expect(await leer()).toEqual(['c1'])
  })

  it('ADR-0002: fuera de una transacción, una acción que lanza o rechaza se registra sin propagarse', async () => {
    const { uow } = crear()
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    expect(() =>
      uow.alConfirmar(() => {
        throw new Error('lanza')
      }),
    ).not.toThrow()
    uow.alConfirmar(async () => {
      throw new Error('rechaza')
    })
    await esperar(0)
    expect(error).toHaveBeenCalledTimes(2)
  })

  it('ADR-0002: esperarAcciones espera las acciones asíncronas que corrieron fuera de una transacción', async () => {
    const { uow } = crear()
    const orden: string[] = []
    uow.alConfirmar(async () => {
      await esperar(10)
      orden.push('primera')
      // Una acción suelta que registra otra: también se espera (bucle hasta que no queden).
      uow.alConfirmar(async () => {
        await esperar(5)
        orden.push('encadenada')
      })
    })
    expect(orden).toEqual([])
    await uow.esperarAcciones()
    expect(orden).toEqual(['primera', 'encadenada'])
  })

  it('ADR-0002: esperarAcciones resuelve enseguida si no hay acciones pendientes', async () => {
    const { uow } = crear()
    await expect(uow.esperarAcciones()).resolves.toBeUndefined()
  })

  it('ADR-0002: un ejecutar() dentro de una acción es una transacción nueva e independiente', async () => {
    const { uow, escribir, leer } = crear()
    await uow.ejecutar(async () => {
      await escribir('c1')
      uow.alConfirmar(async () => {
        // Si se uniera a la transacción ya confirmada, su rollback no podría deshacer c2.
        await uow
          .ejecutar(async () => {
            await escribir('c2')
            throw new Error('falla la de la acción')
          })
          .catch(() => undefined)
        await uow.ejecutar(() => escribir('c3'))
      })
    })
    expect(await leer()).toEqual(['c1', 'c3'])
  })

  it('ADR-0002: dos transacciones independientes concurrentes no se mezclan las acciones', async () => {
    const { uow, escribir, leer } = crear()
    const corrieron: string[] = []
    const [primera, segunda] = await Promise.allSettled([
      uow.ejecutar(async () => {
        uow.alConfirmar(() => {
          corrieron.push('de la primera')
        })
        await escribir('c1')
        throw new Error('falla la primera')
      }),
      uow.ejecutar(async () => {
        uow.alConfirmar(() => {
          corrieron.push('de la segunda')
        })
        await escribir('c2')
      }),
    ])
    expect(primera.status).toBe('rejected')
    expect(segunda.status).toBe('fulfilled')
    expect(corrieron).toEqual(['de la segunda'])
    expect(await leer()).toEqual(['c2'])
  })
}
