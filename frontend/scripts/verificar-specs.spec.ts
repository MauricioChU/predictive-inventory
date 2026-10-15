import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { verificarSpecs } from './verificar-specs.mjs'

function proyecto(md: string, feature: string): string {
  const raiz = mkdtempSync(join(tmpdir(), 'specs-'))
  mkdirSync(join(raiz, 'fase-1', 'features'), { recursive: true })
  writeFileSync(join(raiz, 'fase-1', '01.md'), md)
  writeFileSync(join(raiz, 'fase-1', 'features', 'a.feature'), feature)
  return raiz
}

describe('verificarSpecs (RN-SIS-01)', () => {
  it('pasa con las specs reales del proyecto', () => {
    const r = verificarSpecs(join(import.meta.dirname, '..', '..', 'docs', 'specs'))
    expect(r.errores).toEqual([])
    expect(r.reglas).toBeGreaterThanOrEqual(68)
  })
  it('detecta una regla sin escenario', () => {
    const r = verificarSpecs(proyecto('| **RN-OP-01** | x |\n| **RN-OP-02** | y |', '@RN-OP-01\nEscenario: a'))
    expect(r.errores).toContain('RN-OP-02 no tiene escenario Gherkin')
  })
  it('detecta un escenario que cita una regla inexistente o retirada', () => {
    const r = verificarSpecs(
      proyecto('| **RN-OP-01** | x |\n| ~~RN-OP-02~~ | **Retirada** |', '@RN-OP-01 @RN-OP-02 @RN-OP-09\nEscenario: a'),
    )
    expect(r.errores).toEqual(['@RN-OP-02 cita una regla retirada', '@RN-OP-09 cita una regla que no existe'])
  })
})
