import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { RegistroDePasos } from '../../gherkin/registro-de-pasos'
import { pasosDeAlertas } from './alertas'
import { pasosDeCatalogo } from './catalogo'
import { pasosDeContexto } from './contexto'
import type { Mundo } from './mundo'
import { pasosDeOperaciones } from './operaciones'
import { pasosDeRespaldo } from './respaldo'
import { pasosDeTorre } from './torre'

export { cerrarMundo, crearMundo } from './mundo'

/** Todos los pasos de los cinco `.feature`, en un solo registro (sin ambigüedades entre temas). */
export function crearPasos(): RegistroDePasos<Mundo> {
  const pasos = new RegistroDePasos<Mundo>()
  pasosDeContexto(pasos)
  pasosDeCatalogo(pasos)
  pasosDeOperaciones(pasos)
  pasosDeAlertas(pasos)
  pasosDeTorre(pasos)
  pasosDeRespaldo(pasos)
  return pasos
}

/** Los `.feature` de la fase 1 (docs/specs/fase-1/features). */
export const FEATURES = [
  'catalogo',
  'operaciones',
  'alertas',
  'torre-de-control',
  'respaldo',
] as const

export function rutaDeFeature(nombre: (typeof FEATURES)[number]): string {
  return join(
    dirname(fileURLToPath(import.meta.url)),
    '..',
    '..',
    '..',
    '..',
    'docs',
    'specs',
    'fase-1',
    'features',
    `${nombre}.feature`,
  )
}
