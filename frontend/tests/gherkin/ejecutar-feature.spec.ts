import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { expect } from 'vitest'
import { ejecutarFeature } from './ejecutar-feature'
import { RegistroDePasos, type ArgumentoExtra } from './registro-de-pasos'

interface Mundo {
  manzanas: number
  nota: string
}

const pasos = new RegistroDePasos<Mundo>()
  .paso('que tengo {string} manzanas', (m, n: string) => {
    m.manzanas = Number(n)
  })
  .paso('recibo:', (m, extra: ArgumentoExtra) => {
    for (const fila of extra.tabla!.filas) m.manzanas += Number(fila.cantidad)
  })
  .paso('recibo {string} manzanas', (m, n: string) => {
    m.manzanas += Number(n)
  })
  .paso('tengo {string} manzanas', (m, n: string) => {
    expect(m.manzanas).toBe(Number(n))
  })
  .paso('anoto:', (m, extra: ArgumentoExtra) => {
    m.nota = extra.texto!
  })
  .paso('la nota tiene {string} líneas', (m, n: string) => {
    expect(m.nota.split('\n')).toHaveLength(Number(n))
  })

// Genera: 1 + 2 + 1 escenarios en verde y 1 pendiente (skip) por el paso sin definir.
// Nota: se evita `new URL(ruta, import.meta.url)` porque Vite lo trata como una
// referencia a un asset bajo el entorno jsdom de Vitest y no resuelve a una ruta de archivo real.
ejecutarFeature(
  join(dirname(fileURLToPath(import.meta.url)), '__fixtures__', 'ejemplo.feature'),
  pasos,
  () => ({ manzanas: 0, nota: '' }),
)
