import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { verificarSpecs } from './verificar-specs.mjs'

const creados: string[] = []

function proyecto(md: string, feature: string): string {
  const raiz = mkdtempSync(join(tmpdir(), 'specs-'))
  creados.push(raiz)
  mkdirSync(join(raiz, 'fase-1', 'features'), { recursive: true })
  writeFileSync(join(raiz, 'fase-1', '01.md'), md)
  writeFileSync(join(raiz, 'fase-1', 'features', 'a.feature'), feature)
  return raiz
}

// Fix round 1, M8: no dejar directorios temporales sueltos en el disco tras cada test.
afterEach(() => {
  for (const dir of creados.splice(0)) rmSync(dir, { recursive: true, force: true })
})

describe('verificarSpecs (RN-SIS-01)', () => {
  it('pasa con las specs reales del proyecto', () => {
    const r = verificarSpecs(join(import.meta.dirname, '..', '..', 'docs', 'specs'))
    expect(r.errores).toEqual([])
    expect(r.reglas).toBeGreaterThanOrEqual(68)
  })
  it('detecta una regla sin escenario', () => {
    const r = verificarSpecs(
      proyecto('| **RN-OP-01** | x |\n| **RN-OP-02** | y |', '@RN-OP-01\nEscenario: a'),
    )
    expect(r.errores).toContain('RN-OP-02 no tiene escenario Gherkin')
  })
  it('detecta un escenario que cita una regla inexistente o retirada', () => {
    const r = verificarSpecs(
      proyecto(
        '| **RN-OP-01** | x |\n| ~~RN-OP-02~~ | **Retirada** |',
        '@RN-OP-01 @RN-OP-02 @RN-OP-09\nEscenario: a',
      ),
    )
    expect(r.errores).toEqual([
      '@RN-OP-02 cita una regla retirada',
      '@RN-OP-09 cita una regla que no existe',
    ])
  })
  // Fix round 1, M7: el límite \d{2}(?!\d) evita que "RN-OP-123" se lea como "RN-OP-12"
  // más un "3" suelto.
  it('M7: "@RN-OP-123" no cuenta como una cita de RN-OP-12', () => {
    const r = verificarSpecs(proyecto('| **RN-OP-12** | x |', '@RN-OP-123\nEscenario: a'))
    expect(r.errores).toContain('RN-OP-12 no tiene escenario Gherkin')
  })
  // Fix round 1, M7: las etiquetas solo se leen de líneas de etiqueta (recortadas, que
  // empiezan con '@'); una mención dentro de un docstring no cuenta como cita.
  it('M7: una mención dentro de un docstring no cuenta como cita de la regla', () => {
    const feature = [
      '@RN-OP-12',
      'Escenario: a',
      '  Cuando anoto:',
      '    """',
      '    Ver @RN-OP-12 para más detalles',
      '    """',
    ].join('\n')
    const r = verificarSpecs(proyecto('| **RN-OP-12** | x |', feature))
    expect(r.errores).toEqual([])
  })
  it('M7: una mención dentro de un docstring NO cubre una regla que de verdad no tiene etiqueta', () => {
    const feature = [
      'Escenario: a',
      '  Cuando anoto:',
      '    """',
      '    Ver @RN-OP-12 para más detalles',
      '    """',
    ].join('\n')
    const r = verificarSpecs(proyecto('| **RN-OP-12** | x |', feature))
    expect(r.errores).toContain('RN-OP-12 no tiene escenario Gherkin')
  })
})
