// @vitest-environment node
import Dexie from 'dexie'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { CategoriaRegistro } from '../../contratos/registros'
import { crearBaseDePrueba, IDBFactory } from './__pruebas__/base-de-prueba'
import type { BaseDeDatos } from './base-de-datos'
import { enTransaccion, UnidadDeTrabajoDexie } from './unidad-de-trabajo-dexie'

function categoria(id: string): CategoriaRegistro {
  return { id, nombre: id, nombreNormalizado: id }
}

function crear() {
  const db = crearBaseDePrueba()
  return { db, uow: new UnidadDeTrabajoDexie(db) }
}

async function idsGuardados(db: BaseDeDatos): Promise<string[]> {
  return (await db.categorias.toArray()).map((c) => c.id).sort()
}

function esperar(ms: number): Promise<void> {
  return new Promise((resolver) => setTimeout(resolver, ms))
}

/** La transacción nativa de IndexedDB en la que corre el código (o null). */
function transaccionNativa(): IDBTransaction | null {
  return Dexie.currentTransaction?.idbtrans ?? null
}

describe('UnidadDeTrabajoDexie', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('cada ejecutar abre su transacción con durabilidad estricta', async () => {
    const { uow } = crear()
    expect(await uow.ejecutar(async () => transaccionNativa()?.durability)).toBe('strict')
  })

  it('RN-OP-06: confirma todo lo que escribe el trabajo y devuelve su resultado', async () => {
    const { db, uow } = crear()
    const resultado = await uow.ejecutar(async () => {
      await db.categorias.put(categoria('c1'))
      await db.categorias.put(categoria('c2'))
      return 'listo'
    })
    expect(resultado).toBe('listo')
    expect(await idsGuardados(db)).toEqual(['c1', 'c2'])
  })

  it('RN-OP-06: si el trabajo falla, IndexedDB revierte todas sus escrituras', async () => {
    const { db, uow } = crear()
    await db.categorias.put(categoria('antes'))
    await expect(
      uow.ejecutar(async () => {
        await db.categorias.put(categoria('c1'))
        await db.existencias.put({ productoId: 'lejia', cantidad: 1000 })
        await db.categorias.delete('antes')
        throw new Error('falla a mitad')
      }),
    ).rejects.toThrow('falla a mitad')
    expect(await idsGuardados(db)).toEqual(['antes'])
    expect(await db.existencias.count()).toBe(0)
  })

  it('RN-OP-06: una llamada anidada se une a la transacción en curso; si falla, se revierte todo', async () => {
    const { db, uow } = crear()
    let externa: IDBTransaction | null = null
    let anidada: IDBTransaction | null = null
    await expect(
      uow.ejecutar(async () => {
        externa = transaccionNativa()
        await db.categorias.put(categoria('c1'))
        await uow.ejecutar(async () => {
          anidada = transaccionNativa()
          await db.categorias.put(categoria('c2'))
          throw new Error('falla la anidada')
        })
      }),
    ).rejects.toThrow('falla la anidada')
    expect(externa).not.toBeNull()
    expect(anidada).toBe(externa)
    expect(await idsGuardados(db)).toEqual([])
  })

  it('una anidada cuyo error atrapa la externa no revierte nada por sí sola (igual que en memoria)', async () => {
    const { db, uow } = crear()
    await uow.ejecutar(async () => {
      await db.categorias.put(categoria('c1'))
      await uow
        .ejecutar(async () => {
          await db.categorias.put(categoria('c2'))
          throw new Error('falla la anidada')
        })
        .catch(() => undefined)
      await db.categorias.put(categoria('c3'))
    })
    expect(await idsGuardados(db)).toEqual(['c1', 'c2', 'c3'])
  })

  it('RN-OP-06: si falla una petición de IndexedDB (clave repetida), se revierte todo', async () => {
    const { db, uow } = crear()
    await db.categorias.put(categoria('c0'))
    await expect(
      uow.ejecutar(async () => {
        await db.categorias.put(categoria('c1'))
        await db.categorias.add(categoria('c0'))
      }),
    ).rejects.toMatchObject({ name: 'ConstraintError' })
    expect(await idsGuardados(db)).toEqual(['c0'])
  })

  it('dos llamadas independientes son transacciones separadas: el fallo de una no revierte la otra', async () => {
    const { db, uow } = crear()
    const [falla, sigue] = await Promise.allSettled([
      uow.ejecutar(async () => {
        await db.categorias.put(categoria('c1'))
        throw new Error('falla la primera')
      }),
      uow.ejecutar(async () => {
        await db.categorias.put(categoria('c2'))
      }),
    ])
    expect(falla.status).toBe('rejected')
    expect(sigue.status).toBe('fulfilled')
    expect(await idsGuardados(db)).toEqual(['c2'])
  })

  it('una llamada que llega después de cerrar la transacción que la originó es independiente', async () => {
    const { db, uow } = crear()
    let externa: IDBTransaction | null = null
    let tardia: Promise<IDBTransaction | null> | null = null
    let seConfirmo!: () => void
    // Una promesa de Dexie corre su `then` en la zona donde se encadenó: la de la transacción,
    // que para entonces ya terminó (Dexie.currentTransaction sigue apuntándola, inactiva).
    const confirmada = new Dexie.Promise<void>((resolver) => (seConfirmo = resolver))
    await uow.ejecutar(async () => {
      externa = transaccionNativa()
      await db.categorias.put(categoria('c1'))
      // "Dispara y olvida": nace en la zona de esta transacción y sigue después del commit.
      tardia = confirmada.then(() => {
        expect(Dexie.currentTransaction?.idbtrans).toBe(externa)
        return uow.ejecutar(async () => {
          await db.categorias.put(categoria('c2'))
          return transaccionNativa()
        })
      })
    })
    seConfirmo()
    const propia = await tardia!
    expect(propia).not.toBeNull()
    expect(propia).not.toBe(externa)
    // Si después falla otra transacción independiente, lo confirmado por la tardía queda.
    await expect(
      uow.ejecutar(async () => {
        await db.categorias.delete('c2')
        throw new Error('falla otra')
      }),
    ).rejects.toThrow('falla otra')
    expect(await idsGuardados(db)).toEqual(['c1', 'c2'])
  })

  it('esperar algo ajeno a IndexedDB dentro del trabajo: lo escrito antes QUEDA confirmado, ejecutar rechaza y las acciones se pierden', async () => {
    const { db, uow } = crear()
    const corrieron: string[] = []
    await expect(
      uow.ejecutar(async () => {
        await db.categorias.put(categoria('c1'))
        uow.alConfirmar(() => {
          corrieron.push('acción')
        })
        await esperar(10) // IndexedDB confirma aquí, sin esperar al resto del trabajo
        await db.categorias.put(categoria('c2')).catch(() => undefined)
      }),
    ).rejects.toMatchObject({ name: 'PrematureCommitError' })
    // Confirmación parcial: c1 se guardó aunque ejecutar rechazó; c2 no; la acción no corrió.
    expect(await idsGuardados(db)).toEqual(['c1'])
    expect(corrieron).toEqual([])
  })

  describe('enTransaccion', () => {
    it('sin transacción en curso abre una propia: si falla, revierte lo suyo', async () => {
      const { db } = crear()
      await expect(
        enTransaccion(db, [db.categorias], async () => {
          await db.categorias.put(categoria('c1'))
          throw new Error('falla')
        }),
      ).rejects.toThrow('falla')
      expect(await idsGuardados(db)).toEqual([])
    })

    it('dentro de una unidad de trabajo se une a ella (sin subtransacción)', async () => {
      const { db, uow } = crear()
      await uow.ejecutar(async () => {
        const externa = transaccionNativa()
        const dentro = await enTransaccion(db, [db.categorias], async () => transaccionNativa())
        expect(dentro).toBe(externa)
        await enTransaccion(db, [db.categorias], async () => {
          throw new Error('atrapado')
        }).catch(() => undefined)
        await db.categorias.put(categoria('c1'))
      })
      expect(await idsGuardados(db)).toEqual(['c1'])
    })
  })

  describe('alConfirmar', () => {
    it('fuera de una transacción, corre la acción enseguida', () => {
      const { uow } = crear()
      let corrio = false
      uow.alConfirmar(() => {
        corrio = true
      })
      expect(corrio).toBe(true)
    })

    it('ADR-0002: dentro, corre después del commit de la transacción más externa, en orden', async () => {
      const fabrica = new IDBFactory()
      const db = crearBaseDePrueba(fabrica)
      const uow = new UnidadDeTrabajoDexie(db)
      // Otra conexión a la misma base: solo ve lo confirmado (y su lectura esperaría a que
      // termine la transacción si la acción corriera antes del commit).
      const otraConexion = crearBaseDePrueba(fabrica)
      const orden: string[] = []
      await uow.ejecutar(async () => {
        await db.categorias.put(categoria('c1'))
        uow.alConfirmar(async () => {
          expect(Dexie.currentTransaction?.active ?? false).toBe(false)
          orden.push(`a1 ve c1: ${(await otraConexion.categorias.get('c1')) !== undefined}`)
        })
        uow.alConfirmar(() => {
          orden.push('a2')
        })
        orden.push('fin del trabajo')
      })
      expect(orden).toEqual(['fin del trabajo', 'a1 ve c1: true', 'a2'])
    })

    it('una acción de una llamada anidada espera al commit de la más externa', async () => {
      const { db, uow } = crear()
      const orden: string[] = []
      await uow.ejecutar(async () => {
        await uow.ejecutar(async () => {
          await db.categorias.put(categoria('c1'))
          uow.alConfirmar(() => {
            orden.push('acción de la anidada')
          })
        })
        orden.push('terminó la anidada')
        await db.categorias.put(categoria('c2'))
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

    it('RN-OP-06: si hay rollback, descarta las acciones (también las de llamadas anidadas)', async () => {
      const { db, uow } = crear()
      const corrieron: string[] = []
      await expect(
        uow.ejecutar(async () => {
          uow.alConfirmar(() => {
            corrieron.push('externa')
          })
          await uow.ejecutar(async () => {
            await db.categorias.put(categoria('c1'))
            uow.alConfirmar(() => {
              corrieron.push('anidada')
            })
          })
          throw new Error('rollback')
        }),
      ).rejects.toThrow('rollback')
      expect(corrieron).toEqual([])
      expect(await idsGuardados(db)).toEqual([])
    })

    it('RN-OP-06: si IndexedDB aborta la transacción, descarta las acciones', async () => {
      const { db, uow } = crear()
      await db.categorias.put(categoria('c0'))
      const corrieron: string[] = []
      await expect(
        uow.ejecutar(async () => {
          uow.alConfirmar(() => {
            corrieron.push('acción')
          })
          await db.categorias.add(categoria('c0'))
        }),
      ).rejects.toMatchObject({ name: 'ConstraintError' })
      expect(corrieron).toEqual([])
    })

    it('una acción que lanza o rechaza se registra con console.error y no impide las demás', async () => {
      const { db, uow } = crear()
      const error = vi.spyOn(console, 'error').mockImplementation(() => undefined)
      const corrieron: string[] = []
      const resultado = await uow.ejecutar(async () => {
        await db.categorias.put(categoria('c1'))
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
      expect(await idsGuardados(db)).toEqual(['c1'])

      uow.alConfirmar(() => {
        throw new Error('fuera de una transacción')
      })
      await uow.esperarAcciones()
      expect(error).toHaveBeenCalledTimes(3)
    })

    it('ejecutar resuelve cuando ya terminaron sus acciones, que corren una tras otra', async () => {
      const { uow } = crear()
      const orden: string[] = []
      await uow.ejecutar(async () => {
        uow.alConfirmar(async () => {
          await esperar(15)
          orden.push('lenta')
        })
        uow.alConfirmar(() => {
          orden.push('rápida')
        })
      })
      expect(orden).toEqual(['lenta', 'rápida'])
    })

    it('una acción puede abrir su propia unidad de trabajo', async () => {
      const { db, uow } = crear()
      let externa: IDBTransaction | null = null
      let deLaAccion: IDBTransaction | null = null
      await uow.ejecutar(async () => {
        externa = transaccionNativa()
        await db.categorias.put(categoria('c1'))
        uow.alConfirmar(async () => {
          deLaAccion = await uow.ejecutar(async () => {
            await db.categorias.put(categoria('c2'))
            return transaccionNativa()
          })
        })
      })
      expect(deLaAccion).not.toBeNull()
      expect(deLaAccion).not.toBe(externa)
      expect(await idsGuardados(db)).toEqual(['c1', 'c2'])
    })

    it('dentro de una transacción que no abrió la unidad de trabajo, también espera a su commit', async () => {
      const { db, uow } = crear()
      const orden: string[] = []
      await db.transaction('rw', db.categorias, async () => {
        await db.categorias.put(categoria('c1'))
        uow.alConfirmar(async () => {
          await esperar(5)
          orden.push('a1')
        })
        uow.alConfirmar(() => {
          orden.push('a2')
        })
        orden.push('fin del trabajo')
      })
      await uow.esperarAcciones()
      expect(orden).toEqual(['fin del trabajo', 'a1', 'a2'])

      await expect(
        db.transaction('rw', db.categorias, async () => {
          uow.alConfirmar(() => {
            orden.push('no debe correr')
          })
          throw new Error('rollback')
        }),
      ).rejects.toThrow('rollback')
      await uow.esperarAcciones()
      expect(orden).toEqual(['fin del trabajo', 'a1', 'a2'])
    })

    it('esperarAcciones espera las acciones asíncronas que corrieron fuera de una transacción', async () => {
      const { uow } = crear()
      let termino = false
      uow.alConfirmar(async () => {
        await esperar(10)
        termino = true
      })
      expect(termino).toBe(false)
      await uow.esperarAcciones()
      expect(termino).toBe(true)
    })
  })
})
