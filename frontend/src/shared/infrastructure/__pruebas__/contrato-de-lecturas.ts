import { expect, it } from 'vitest'
import type { EntornoDeUnidadDeTrabajo } from './contrato-de-unidad-de-trabajo'

const ESCRIBIR_EN_LECTURA = /uow\.leer/

/**
 * El contrato de `UnidadDeTrabajo.leer` (RN-SIS-09): los mismos casos para la unidad de trabajo
 * en memoria y la de Dexie. Lo llama `probarUnidadDeTrabajo`.
 */
export function probarLecturas(crear: () => EntornoDeUnidadDeTrabajo): void {
  it('RN-SIS-09: leer devuelve el resultado de la consulta con lo confirmado', async () => {
    const { uow, escribir, leer } = crear()
    await uow.ejecutar(() => escribir('c1'))
    expect(await uow.leer(() => leer())).toEqual(['c1'])
  })

  it('RN-SIS-09: si la consulta falla, leer rechaza con su error y no cambia nada', async () => {
    const { uow, escribir, leer } = crear()
    await escribir('antes')
    await expect(
      uow.leer(async () => {
        await leer()
        throw new Error('falla la consulta')
      }),
    ).rejects.toThrow('falla la consulta')
    expect(await leer()).toEqual(['antes'])
  })

  it('RN-SIS-09: dentro de un ejecutar, leer se une a esa transacción y ve lo que ya escribió', async () => {
    const { uow, escribir, leer } = crear()
    await expect(
      uow.ejecutar(async () => {
        await escribir('c1')
        expect(await uow.leer(() => leer())).toEqual(['c1'])
        // Y lo escrito después de la lectura sigue siendo de la misma transacción.
        await escribir('c2')
        throw new Error('rollback')
      }),
    ).rejects.toThrow('rollback')
    expect(await leer()).toEqual([])
  })

  it('RN-SIS-09: un leer dentro de otro leer se une a la misma lectura', async () => {
    const { uow, escribir, leer } = crear()
    await escribir('c1')
    const resultado = await uow.leer(async () => {
      const afuera = await leer()
      const adentro = await uow.leer(() => leer())
      return [...afuera, ...adentro]
    })
    expect(resultado).toEqual(['c1', 'c1'])
  })

  it('RN-SIS-09: dentro de un leer no se escribe: ejecutar rechaza con un error de programación', async () => {
    const { uow, escribir, leer } = crear()
    await expect(uow.leer(() => uow.ejecutar(() => escribir('c1')))).rejects.toThrow(
      ESCRIBIR_EN_LECTURA,
    )
    expect(await leer()).toEqual([])
  })

  it('RN-SIS-09: dentro de un leer, alConfirmar lanza (no hay commit al que esperar)', async () => {
    const { uow } = crear()
    let corrio = false
    await expect(
      uow.leer(async () => {
        uow.alConfirmar(() => {
          corrio = true
        })
      }),
    ).rejects.toThrow(ESCRIBIR_EN_LECTURA)
    await uow.esperarAcciones()
    expect(corrio).toBe(false)
  })

  it('RN-SIS-09: un leer dentro de una acción alConfirmar es una lectura nueva y ve lo confirmado', async () => {
    const { uow, escribir, leer } = crear()
    let visto: string[] = []
    await uow.ejecutar(async () => {
      await escribir('c1')
      uow.alConfirmar(async () => {
        visto = await uow.leer(() => leer())
      })
    })
    expect(visto).toEqual(['c1'])
  })

  it('RN-SIS-09: una lectura que llega mientras otra transacción escribe no ve nada a medias', async () => {
    const { uow, escribir, leer } = crear()
    const escritura = uow.ejecutar(async () => {
      await escribir('c1')
      await escribir('c2')
      await escribir('c3')
    })
    const lectura = uow.leer(() => leer())
    await escritura
    expect(await lectura).toEqual(['c1', 'c2', 'c3'])
  })

  it('RN-SIS-09: una lectura que llega mientras otra transacción escribe y falla no ve nada de ella', async () => {
    const { uow, escribir, leer } = crear()
    const escritura = uow.ejecutar(async () => {
      await escribir('c1')
      await escribir('c2')
      throw new Error('rollback')
    })
    const lectura = uow.leer(() => leer())
    await expect(escritura).rejects.toThrow('rollback')
    expect(await lectura).toEqual([])
  })

  it('RN-SIS-09: una lectura en curso ve la misma foto aunque llegue una escritura (y no la bloquea para siempre)', async () => {
    const { uow, escribir, leer } = crear()
    await escribir('antes')
    const lectura = uow.leer(async () => {
      const primera = await leer()
      const segunda = await leer()
      return { primera, segunda }
    })
    // Otra transacción, pedida desde afuera mientras la lectura está en curso. (Desde una
    // promesa que se resuelve DENTRO de la lectura no: en Dexie, quien la espera podría seguir
    // en la zona de la lectura; ver UnidadDeTrabajoDexie.)
    const escritura = uow.ejecutar(() => escribir('durante'))
    expect(await lectura).toEqual({ primera: ['antes'], segunda: ['antes'] })
    await escritura
    expect(await leer()).toEqual(['antes', 'durante'])
  })

  it('RN-SIS-09: dos lecturas concurrentes terminan las dos', async () => {
    const { uow, escribir, leer } = crear()
    await escribir('c1')
    const [a, b] = await Promise.all([uow.leer(() => leer()), uow.leer(() => leer())])
    expect(a).toEqual(['c1'])
    expect(b).toEqual(['c1'])
  })
}
