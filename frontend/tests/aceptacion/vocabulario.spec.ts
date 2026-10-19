// @vitest-environment node
import { readFileSync } from 'node:fs'
import { AstBuilder, GherkinClassicTokenMatcher, Parser, compile } from '@cucumber/gherkin'
import { IdGenerator } from '@cucumber/messages'
import { describe, expect, it } from 'vitest'
import { FEATURES, crearPasos, rutaDeFeature } from './pasos'

function picklesDe(ruta: string) {
  const nuevoId = IdGenerator.uuid()
  const documento = new Parser(new AstBuilder(nuevoId), new GherkinClassicTokenMatcher('es')).parse(
    readFileSync(ruta, 'utf8'),
  )
  return compile(documento, ruta, nuevoId)
}

/**
 * El vocabulario de pasos de la Ola 4 (plan 10): cada texto de los cinco `.feature` (con los
 * valores de los Ejemplos ya puestos) coincide con UNA sola expresión, y ninguna expresión
 * registrada sobra.
 */
describe('Vocabulario de pasos de aceptación', () => {
  const pasos = crearPasos()
  const pickles = FEATURES.flatMap((feature) => picklesDe(rutaDeFeature(feature)))

  it('cubre los 122 escenarios (187 casos con sus Ejemplos)', () => {
    expect(new Set(pickles.map((p) => `${p.uri}|${p.astNodeIds[0]}`)).size).toBe(122)
    expect(pickles).toHaveLength(187)
  })

  it('cada paso tiene exactamente una definición y ninguna definición sobra', () => {
    const usadas = new Set<string>()
    const sinDefinir: string[] = []
    for (const paso of pickles.flatMap((p) => p.steps)) {
      // `buscar` lanza "Paso ambiguo" si dos expresiones aceptan el mismo texto.
      const encontrado = pasos.buscar(paso.text)
      if (encontrado) usadas.add(encontrado.expresion)
      else sinDefinir.push(paso.text)
    }
    expect(sinDefinir).toEqual([])
    expect(pasos.expresiones.filter((e) => !usadas.has(e))).toEqual([])
  })
})
