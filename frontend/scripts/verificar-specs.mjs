#!/usr/bin/env node
// RN-SIS-01: cada regla de negocio vigente tiene al menos un escenario, y ningún escenario cita reglas inexistentes o retiradas.
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const MODULOS = '(?:CAT|OP|AL|AN|RE)'

function archivos(dir, extension) {
  return readdirSync(dir).flatMap((nombre) => {
    const ruta = join(dir, nombre)
    if (statSync(ruta).isDirectory()) return archivos(ruta, extension)
    return ruta.endsWith(extension) ? [ruta] : []
  })
}

// Fix round 1, M7: límite tras los dos dígitos para que "RN-OP-123" no se lea como
// "RN-OP-12" (un tercer dígito pegado haría match parcial sin el (?!\d)).
const PATRON_REGLA = `RN-${MODULOS}-\\d{2}(?!\\d)`
const PATRON_REGLA_RETIRADA = `RN-[A-Z]+-\\d{2}(?!\\d)`

/** Etiquetas (@RN-XX-NN) de las líneas de etiqueta de un .feature: líneas cuyo contenido
 * recortado empieza con '@'. Una mención dentro de un docstring o del texto libre de un
 * paso no es una línea de etiqueta y no cuenta como cita (Fix round 1, M7). */
function etiquetasDeLineasDeEtiqueta(texto) {
  const etiquetas = new Set()
  for (const linea of texto.split('\n')) {
    const recortada = linea.trim()
    if (!recortada.startsWith('@')) continue
    for (const m of recortada.matchAll(new RegExp(`@(${PATRON_REGLA_RETIRADA})`, 'g')))
      etiquetas.add(m[1])
  }
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
  const etiquetas = new Set(features.flatMap((texto) => [...etiquetasDeLineasDeEtiqueta(texto)]))

  const errores = []
  for (const regla of [...vigentes].sort()) {
    if (!etiquetas.has(regla)) errores.push(`${regla} no tiene escenario Gherkin`)
  }
  for (const etiqueta of [...etiquetas].sort()) {
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
