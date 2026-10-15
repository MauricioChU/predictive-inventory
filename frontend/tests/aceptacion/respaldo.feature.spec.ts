import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { ejecutarFeature } from '../gherkin/ejecutar-feature'
import { RegistroDePasos } from '../gherkin/registro-de-pasos'

const RUTA = join(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
  '..',
  'docs',
  'specs',
  'fase-1',
  'features',
  'respaldo.feature',
)

// Los pasos se agregan en la Ola 4 (feat/aceptacion). Mientras tanto todos los escenarios quedan pendientes.
ejecutarFeature(RUTA, new RegistroDePasos<object>(), () => ({}))
