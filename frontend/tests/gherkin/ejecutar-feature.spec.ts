import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { PickleStep, PickleTag } from '@cucumber/messages'
import { describe, expect, it } from 'vitest'
import { ejecutarFeature, ejecutarPaso, nombresVisibles } from './ejecutar-feature'
import { RegistroDePasos, type ArgumentoExtra } from './registro-de-pasos'

interface Mundo {
  manzanas: number
  nota: string
}

const pasos = new RegistroDePasos<Mundo>()
  .paso('que tengo {string} manzanas', (m, n: string) => {
    m.manzanas = Number(n)
  })
  .paso('recibo:', (m, extra: ArgumentoExtra) => {
    for (const fila of extra.tabla!.filas) m.manzanas += Number(fila.cantidad)
  })
  .paso('recibo {string} manzanas', (m, n: string) => {
    m.manzanas += Number(n)
  })
  .paso('tengo {string} manzanas', (m, n: string) => {
    expect(m.manzanas).toBe(Number(n))
  })
  .paso('anoto:', (m, extra: ArgumentoExtra) => {
    m.nota = extra.texto!
  })
  .paso('la nota tiene {string} líneas', (m, n: string) => {
    expect(m.nota.split('\n')).toHaveLength(Number(n))
  })

// Genera: 1 + 2 + 1 escenarios en verde y 1 pendiente (skip) por el paso sin definir.
// Nota: se evita `new URL(ruta, import.meta.url)` porque Vite lo trata como una
// referencia a un asset bajo el entorno jsdom de Vitest y no resuelve a una ruta de archivo real.
ejecutarFeature(
  join(dirname(fileURLToPath(import.meta.url)), '__fixtures__', 'ejemplo.feature'),
  pasos,
  () => ({ manzanas: 0, nota: '' }),
)

const etiqueta = (nombre: string): PickleTag => ({ name: nombre, astNodeId: 'x' })

// Fix round 1, M6.
describe('nombresVisibles', () => {
  it('deja igual el nombre de escenarios que no se repiten', () => {
    const pickles = [
      { name: 'Sumar con una tabla', tags: [etiqueta('@RN-EJ-01')] },
      { name: 'Texto largo', tags: [] },
    ]
    expect(nombresVisibles(pickles)).toEqual(['@RN-EJ-01 Sumar con una tabla', 'Texto largo'])
  })
  it('numera los pickles de un Esquema del escenario que comparten nombre', () => {
    const pickles = [
      { name: 'Sumar varias veces', tags: [] },
      { name: 'Sumar varias veces', tags: [] },
      { name: 'Sumar varias veces', tags: [] },
    ]
    expect(nombresVisibles(pickles)).toEqual([
      'Sumar varias veces — ejemplo 1',
      'Sumar varias veces — ejemplo 2',
      'Sumar varias veces — ejemplo 3',
    ])
  })
})

describe('ejecutarPaso', () => {
  const pasoFalso = (texto: string): PickleStep =>
    ({ id: 'id', text: texto, astNodeIds: [] }) as PickleStep

  it('conserva las propiedades del error original (p. ej. expected/actual) y antepone qué paso falló', async () => {
    const registro = new RegistroDePasos<object>().paso('falla con detalle', () => {
      const error = new Error('no coinciden') as Error & { expected?: string; actual?: string }
      error.expected = 'A'
      error.actual = 'B'
      throw error
    })
    await expect(ejecutarPaso({}, pasoFalso('falla con detalle'), registro)).rejects.toMatchObject({
      message: 'Falló el paso "falla con detalle": no coinciden',
      expected: 'A',
      actual: 'B',
    })
  })
  it('convierte algo lanzado que no es un Error en un Error con el mismo prefijo', async () => {
    const registro = new RegistroDePasos<object>().paso('falla con un texto', () => {
      throw 'texto plano'
    })
    await expect(ejecutarPaso({}, pasoFalso('falla con un texto'), registro)).rejects.toThrow(
      'Falló el paso "falla con un texto": texto plano',
    )
  })
  // Fix round 2, minor (ejecutar-feature.ts:65): reasignar error.message puede lanzar en un
  // error de solo lectura (congelado, o con un getter sin setter, como algunos DataCloneError).
  // En ese caso se envuelve con `cause` en vez de que ejecutarPaso mismo falle con el error
  // equivocado.
  it('si el error original es de solo lectura (congelado), lo envuelve con cause en vez de fallar al reasignar', async () => {
    const original = Object.freeze(new Error('no se puede tocar'))
    const registro = new RegistroDePasos<object>().paso('falla congelada', () => {
      throw original
    })
    const resultado = ejecutarPaso({}, pasoFalso('falla congelada'), registro)
    await expect(resultado).rejects.toMatchObject({
      message: 'Falló el paso "falla congelada": no se puede tocar',
      cause: original,
    })
  })
})
