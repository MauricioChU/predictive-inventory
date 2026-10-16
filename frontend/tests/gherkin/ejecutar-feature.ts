import { readFileSync } from 'node:fs'
import { AstBuilder, GherkinClassicTokenMatcher, Parser, compile } from '@cucumber/gherkin'
import { IdGenerator, type PickleStep } from '@cucumber/messages'
import { describe, it } from 'vitest'
import type { ArgumentoExtra, RegistroDePasos } from './registro-de-pasos'

function argumentoExtra(paso: PickleStep): ArgumentoExtra {
  const extra: ArgumentoExtra = {}
  const tabla = paso.argument?.dataTable
  if (tabla) {
    const celdas = tabla.rows.map((fila) => fila.cells.map((c) => c.value))
    const [encabezados = [], ...resto] = celdas
    extra.tabla = {
      celdas,
      filas: resto.map((fila) => Object.fromEntries(encabezados.map((e, i) => [e, fila[i] ?? '']))),
    }
  }
  if (paso.argument?.docString) extra.texto = paso.argument.docString.content
  return extra
}

/**
 * Nombre visible de cada pickle. Un Esquema del escenario compila a un pickle por fila de
 * Ejemplos, y todos comparten el mismo pickle.name — sin desambiguar, Vitest mostraría
 * varios tests con el nombre idéntico. Cuando dos o más pickles de la lista comparten el
 * mismo nombre base, se les agrega " — ejemplo N" (N = 1, 2, 3… en el orden en que aparecen)
 * (Fix round 1, M6).
 */
export function nombresVisibles(
  pickles: readonly { name: string; tags: readonly { name: string }[] }[],
): string[] {
  const bases = pickles.map((p) =>
    [p.tags.map((t) => t.name).join(' '), p.name].filter(Boolean).join(' '),
  )
  const totales = new Map<string, number>()
  for (const base of bases) totales.set(base, (totales.get(base) ?? 0) + 1)
  const contadores = new Map<string, number>()
  return bases.map((base) => {
    if ((totales.get(base) ?? 0) <= 1) return base
    const indice = (contadores.get(base) ?? 0) + 1
    contadores.set(base, indice)
    return `${base} — ejemplo ${indice}`
  })
}

/**
 * Busca el manejador del paso y lo ejecuta. Si falla, antepone al mensaje del error
 * ORIGINAL qué paso falló y lo vuelve a lanzar tal cual — así conserva propiedades propias
 * (p. ej. `expected`/`actual`/`diff` de una aserción de Vitest) que un `new Error(...)`
 * habría perdido. Si lo lanzado no es un Error, se convierte en uno con `String(valor)`
 * (Fix round 1, M6). Si el error original es de solo lectura (congelado, o con un getter de
 * `message` sin setter, como algunos DataCloneError) y la reasignación falla, se envuelve
 * en un Error nuevo con `cause` en vez de que ejecutarPaso termine fallando con el error de
 * la propia reasignación (Fix round 2, minor).
 */
export async function ejecutarPaso<M>(
  mundo: M,
  paso: PickleStep,
  pasos: RegistroDePasos<M>,
): Promise<void> {
  const encontrado = pasos.buscar(paso.text)
  if (!encontrado) throw new Error(`Paso sin definir: "${paso.text}"`)
  try {
    await encontrado.manejador(mundo, ...encontrado.argumentos, argumentoExtra(paso))
  } catch (error) {
    const prefijo = `Falló el paso "${paso.text}": `
    if (error instanceof Error) {
      const mensajeOriginal = error.message
      let reasignado = false
      try {
        error.message = `${prefijo}${mensajeOriginal}`
        reasignado = true
      } catch {
        // mensaje no reasignable: se envuelve más abajo en vez de fallar aquí.
      }
      if (reasignado) throw error
      throw new Error(`${prefijo}${mensajeOriginal}`, { cause: error })
    }
    throw new Error(`${prefijo}${String(error)}`)
  }
}

export interface OpcionesDeFeature {
  /** Milisegundos por escenario (por defecto, el de Vitest): para .feature con escenarios pesados. */
  timeout?: number
  /**
   * Un paso sin definir hace fallar el escenario en vez de dejarlo pendiente. Por defecto,
   * GHERKIN_ESTRICTO=1 (CI). El ejemplo del propio runner lo fija en false: su escenario
   * pendiente es a propósito y no debe fallar en CI.
   */
  estricto?: boolean
}

/** Convierte un .feature en tests de Vitest. Un paso sin definir deja el escenario pendiente (o lo hace fallar con GHERKIN_ESTRICTO=1). */
export function ejecutarFeature<M>(
  ruta: string,
  pasos: RegistroDePasos<M>,
  crearMundo: () => M | Promise<M>,
  opciones: OpcionesDeFeature = {},
): void {
  const nuevoId = IdGenerator.uuid()
  const documento = new Parser(new AstBuilder(nuevoId), new GherkinClassicTokenMatcher('es')).parse(
    readFileSync(ruta, 'utf8'),
  )
  const pickles = compile(documento, ruta, nuevoId)
  const estricto = opciones.estricto ?? process.env.GHERKIN_ESTRICTO === '1'
  const nombres = nombresVisibles(pickles)

  describe(documento.feature?.name ?? ruta, () => {
    pickles.forEach((pickle, indice) => {
      const nombre = nombres[indice] ?? pickle.name
      const faltante = pickle.steps.find((p) => pasos.buscar(p.text) === null)

      if (faltante && !estricto) {
        it.skip(`[pendiente] ${nombre} — falta el paso: ${faltante.text}`, () => {})
        return
      }

      it(
        nombre,
        async () => {
          const mundo = await crearMundo()
          for (const paso of pickle.steps) {
            await ejecutarPaso(mundo, paso, pasos)
          }
        },
        opciones.timeout,
      )
    })
  })
}
