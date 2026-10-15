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

/** Convierte un .feature en tests de Vitest. Un paso sin definir deja el escenario pendiente (o lo hace fallar con GHERKIN_ESTRICTO=1). */
export function ejecutarFeature<M>(
  ruta: string,
  pasos: RegistroDePasos<M>,
  crearMundo: () => M | Promise<M>,
): void {
  const nuevoId = IdGenerator.uuid()
  const documento = new Parser(new AstBuilder(nuevoId), new GherkinClassicTokenMatcher('es')).parse(
    readFileSync(ruta, 'utf8'),
  )
  const pickles = compile(documento, ruta, nuevoId)
  const estricto = process.env.GHERKIN_ESTRICTO === '1'

  describe(documento.feature?.name ?? ruta, () => {
    for (const pickle of pickles) {
      const etiquetas = pickle.tags.map((t) => t.name).join(' ')
      const nombre = [etiquetas, pickle.name].filter(Boolean).join(' ')
      const faltante = pickle.steps.find((p) => pasos.buscar(p.text) === null)

      if (faltante && !estricto) {
        it.skip(`[pendiente] ${nombre} — falta el paso: ${faltante.text}`, () => {})
        continue
      }

      it(nombre, async () => {
        const mundo = await crearMundo()
        for (const paso of pickle.steps) {
          const encontrado = pasos.buscar(paso.text)
          if (!encontrado) throw new Error(`Paso sin definir: "${paso.text}"`)
          try {
            await encontrado.manejador(mundo, ...encontrado.argumentos, argumentoExtra(paso))
          } catch (error) {
            throw new Error(`Falló el paso "${paso.text}": ${(error as Error).message}`, {
              cause: error,
            })
          }
        }
      })
    }
  })
}
