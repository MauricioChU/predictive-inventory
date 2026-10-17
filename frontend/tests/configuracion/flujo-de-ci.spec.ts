// @vitest-environment node
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const CI = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '.github', 'workflows', 'ci.yml'),
  'utf8',
).replace(/\r\n/g, '\n')

/** El texto de un job (desde "  <id>:" hasta el próximo job de primer nivel). */
function job(id: string): string {
  const inicio = CI.indexOf(`\n  ${id}:\n`)
  if (inicio < 0) throw new Error(`No está el job "${id}"`)
  const resto = CI.slice(inicio + 1)
  const siguiente = resto.slice(1).search(/\n {2}[a-z0-9-]+:\n/)
  return siguiente < 0 ? resto : resto.slice(0, siguiente + 1)
}

/** Las líneas que no son comentarios (los comentarios pueden nombrar lo que ya no se hace). */
function pasos(texto: string): string {
  return texto
    .split('\n')
    .filter((l) => !l.trim().startsWith('#'))
    .join('\n')
}

describe('plan 17: flujo de CI', () => {
  it('los nombres de los cuatro jobs (checks obligatorios de las ramas) no cambian', () => {
    expect(job('frontend')).toContain('name: Frontend (lint, tipos, tests, build)')
    expect(job('specs')).toContain('name: Specs (cada regla tiene escenario)')
    expect(job('e2e')).toContain('name: E2E (celular y PC)')
    expect(job('backend')).toContain('name: Backend (ruff, mypy, pytest)')
  })

  it('el job Frontend sube su build (después de test:build) como artefacto "dist"', () => {
    const frontend = pasos(job('frontend'))
    const subida = frontend.indexOf('uses: actions/upload-artifact@')
    expect(subida).toBeGreaterThan(frontend.indexOf('run: npm run test:build'))
    expect(frontend.slice(subida)).toMatch(/name: dist\n\s+path: frontend\/dist/)
    // Un reintento del job vuelve a subirlo sin chocar con el de la corrida anterior.
    expect(frontend.slice(subida)).toMatch(/\n\s+overwrite: true\n/)
  })

  it('el job E2E usa ese build (no lo rehace) y no repite CI=true', () => {
    const e2e = pasos(job('e2e'))
    expect(e2e).toContain('needs: frontend')
    expect(e2e).toMatch(
      /uses: actions\/download-artifact@v\d+\n\s+with:\n\s+name: dist\n\s+path: frontend\/dist/,
    )
    expect(e2e).not.toContain('build-only')
    expect(e2e).not.toMatch(/\bCI: /)
    // El artefacto llega antes de correr Playwright.
    expect(e2e.indexOf('download-artifact')).toBeLessThan(e2e.indexOf('npx playwright test'))
  })
})
