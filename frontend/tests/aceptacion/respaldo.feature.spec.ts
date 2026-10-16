// @vitest-environment node
import { afterEach } from 'vitest'
import { ejecutarFeature } from '../gherkin/ejecutar-feature'
import { cerrarMundo, crearMundo, crearPasos, rutaDeFeature } from './pasos'

// Pasos sobre la capa de aplicación (crearAplicacionDePrueba): ver tests/aceptacion/pasos.
afterEach(cerrarMundo)

ejecutarFeature(rutaDeFeature('respaldo'), crearPasos(), crearMundo)
