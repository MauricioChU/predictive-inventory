// @vitest-environment node
import { afterEach } from 'vitest'
import { ejecutarFeature } from '../gherkin/ejecutar-feature'
import { cerrarMundo, crearMundo, crearPasos, rutaDeFeature } from './pasos'

// Pasos sobre la capa de aplicación (crearAplicacionDePrueba): ver tests/aceptacion/pasos.
afterEach(cerrarMundo)

// RN-RE-03 restaura una copia de 152 productos y 3 840 operaciones (≈ 4 s en memoria): con la
// máquina cargada, el límite de 5 s de Vitest no alcanza.
ejecutarFeature(rutaDeFeature('respaldo'), crearPasos(), crearMundo, { timeout: 20_000 })
