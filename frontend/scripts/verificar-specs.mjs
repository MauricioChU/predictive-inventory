#!/usr/bin/env node
// RN-SIS-01: cada regla de negocio vigente tiene al menos un escenario, y ningún escenario cita reglas inexistentes o retiradas.
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { AstBuilder, GherkinClassicTokenMatcher, Parser } from '@cucumber/gherkin'
import { IdGenerator } from '@cucumber/messages'

const MODULOS = '(?:CAT|OP|AL|AN|RE)'

function archivos(dir, extension) {
  return readdirSync(dir).flatMap((nombre) => {
    const ruta = join(dir, nombre)
    if (statSync(ruta).isDirectory()) return archivos(ruta, extension)
    return ruta.endsWith(extension) ? [ruta] : []
  })
}

// Límite tras los dos dígitos para que "RN-OP-123" no se lea como "RN-OP-12" en el
// markdown (Fix round 1, M7). Las etiquetas de los .feature se validan aparte (ver abajo),
// porque ahí sí importa reportar una forma inválida en vez de solo ignorarla.
const PATRON_REGLA = `RN-${MODULOS}-\\d{2}(?!\\d)`
const PATRON_REGLA_RETIRADA = `RN-[A-Z]+-\\d{2}(?!\\d)`

// Fix round 2, M7: una etiqueta con "forma" de id de regla (RN-<módulo>-<dígitos>) pero con
// una cantidad de dígitos distinta de 2 está mal escrita, no es "otra regla": se reporta
// como error en vez de ignorarse en silencio (como pasaba al no encontrar coincidencia).
const PATRON_FORMA_DE_REGLA = /^RN-[A-Z]+-\d+$/
const PATRON_ID_VALIDO = /^RN-[A-Z]+-\d{2}$/

function recolectarEtiquetas(nodo, etiquetas) {
  for (const etiqueta of nodo?.tags ?? []) etiquetas.add(etiqueta.name.replace(/^@/, ''))
}

/**
 * Fix round 2, M7: en vez de escanear el texto línea por línea buscando algo que empiece
 * con '@', se usa el parser de Gherkin (ya es dependencia del proyecto) y se recorren los
 * nodos del AST que de verdad llevan etiquetas (Feature, Rule, Scenario, Examples). Así una
 * mención dentro de un docstring o del texto libre de un paso NUNCA puede contarse como
 * cita: no son nodos con `tags`, por construcción del árbol, no por una heurística de texto.
 */
export function etiquetasDeFeature(contenidoDelArchivo) {
  const etiquetas = new Set()
  const nuevoId = IdGenerator.uuid()
  const documento = new Parser(new AstBuilder(nuevoId), new GherkinClassicTokenMatcher('es')).parse(
    contenidoDelArchivo,
  )
  const feature = documento.feature
  if (!feature) return etiquetas
  recolectarEtiquetas(feature, etiquetas)

  const procesarHijos = (hijos) => {
    for (const hijo of hijos ?? []) {
      if (hijo.scenario) {
        recolectarEtiquetas(hijo.scenario, etiquetas)
        for (const ejemplos of hijo.scenario.examples ?? [])
          recolectarEtiquetas(ejemplos, etiquetas)
      }
      if (hijo.rule) {
        recolectarEtiquetas(hijo.rule, etiquetas)
        procesarHijos(hijo.rule.children)
      }
    }
  }
  procesarHijos(feature.children)
  return etiquetas
}

export function verificarSpecs(directorioSpecs) {
  const md = archivos(directorioSpecs, '.md')
    .map((f) => readFileSync(f, 'utf8'))
    .join('\n')
  const features = archivos(directorioSpecs, '.feature').map((f) => readFileSync(f, 'utf8'))

  const enNegrita = new Set(
    [...md.matchAll(new RegExp(`\\*\\*(${PATRON_REGLA})\\*\\*`, 'g'))].map((m) => m[1]),
  )
  const retiradas = new Set(
    [...md.matchAll(new RegExp(`~~(${PATRON_REGLA_RETIRADA})~~`, 'g'))].map((m) => m[1]),
  )
  // Fix round 1, M7: vigentes = reglas en negrita menos las retiradas explícitamente.
  const vigentes = new Set([...enNegrita].filter((regla) => !retiradas.has(regla)))

  const todasLasEtiquetas = new Set()
  for (const texto of features) for (const e of etiquetasDeFeature(texto)) todasLasEtiquetas.add(e)

  const errores = []
  const etiquetasValidas = new Set()
  for (const etiqueta of [...todasLasEtiquetas].sort()) {
    if (!PATRON_FORMA_DE_REGLA.test(etiqueta)) continue // no parece un id de regla (p. ej. @wip): no es asunto de esta verificación
    if (!PATRON_ID_VALIDO.test(etiqueta)) {
      errores.push(`@${etiqueta} no es un id de regla válido`)
      continue
    }
    etiquetasValidas.add(etiqueta)
  }

  for (const regla of [...vigentes].sort()) {
    if (!etiquetasValidas.has(regla)) errores.push(`${regla} no tiene escenario Gherkin`)
  }
  for (const etiqueta of [...etiquetasValidas].sort()) {
    if (retiradas.has(etiqueta)) errores.push(`@${etiqueta} cita una regla retirada`)
    else if (!vigentes.has(etiqueta)) errores.push(`@${etiqueta} cita una regla que no existe`)
  }
  return { reglas: vigentes.size, retiradas: retiradas.size, errores }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const directorio = resolve(
    fileURLToPath(new URL('.', import.meta.url)),
    '..',
    '..',
    'docs',
    'specs',
  )
  const { reglas, retiradas, errores } = verificarSpecs(directorio)
  if (errores.length > 0) {
    console.error(`✗ Specs con problemas:\n  - ${errores.join('\n  - ')}`)
    process.exit(1)
  }
  console.log(`✓ ${reglas} reglas vigentes con escenario (${retiradas} retiradas)`)
}
