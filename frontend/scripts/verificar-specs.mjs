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

export function verificarSpecs(directorioSpecs) {
  const md = archivos(directorioSpecs, '.md')
    .map((f) => readFileSync(f, 'utf8'))
    .join('\n')
  const features = archivos(directorioSpecs, '.feature')
    .map((f) => readFileSync(f, 'utf8'))
    .join('\n')
  const vigentes = new Set([...md.matchAll(new RegExp(`\\*\\*(RN-${MODULOS}-\\d{2})\\*\\*`, 'g'))].map((m) => m[1]))
  const retiradas = new Set([...md.matchAll(/~~(RN-[A-Z]+-\d{2})~~/g)].map((m) => m[1]))
  const etiquetas = new Set([...features.matchAll(/@(RN-[A-Z]+-\d{2})/g)].map((m) => m[1]))

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
  const directorio = resolve(fileURLToPath(new URL('.', import.meta.url)), '..', '..', 'docs', 'specs')
  const { reglas, retiradas, errores } = verificarSpecs(directorio)
  if (errores.length > 0) {
    console.error(`✗ Specs con problemas:\n  - ${errores.join('\n  - ')}`)
    process.exit(1)
  }
  console.log(`✓ ${reglas} reglas vigentes con escenario (${retiradas} retiradas)`)
}
