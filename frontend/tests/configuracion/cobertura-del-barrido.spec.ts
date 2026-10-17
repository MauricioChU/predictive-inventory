import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { rutas } from '@/router'

/**
 * Plan 16: el barrido de calidad (e2e/recorridos/barrido.spec.ts) y la auditoría de textos
 * recorren la lista de pantallas de e2e/utilidades/pantallas-de-la-app.ts. Una ruta nueva sin
 * su pantalla en esa lista no se revisaría: esta prueba lo impide.
 */
const LISTA = readFileSync(
  join(
    dirname(fileURLToPath(import.meta.url)),
    '..',
    '..',
    'e2e',
    'utilidades',
    'pantallas-de-la-app.ts',
  ),
  'utf8',
)

/** Las rutas que abre el barrido: `ruta: './productos/${id}/editar'` → "/productos/x/editar". */
function rutasDelBarrido(): string[] {
  return [...LISTA.matchAll(/ruta:\s*(['`])(.*?)\1/g)].map(([, , ruta]) => {
    const camino = ruta!.replace(/\$\{[^}]+\}/g, 'x').split('?')[0]!
    return `/${camino.replace(/^\.\//, '')}`
  })
}

/** "/productos/:id/merma" → /^\/productos\/[^/]+\/merma$/ */
function patron(camino: string): RegExp {
  const partes = camino
    .split('/')
    .map((parte) =>
      parte.startsWith(':') ? '[^/]+' : parte.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
    )
  return new RegExp(`^${partes.join('/')}$`)
}

describe('plan 16: el barrido de calidad cubre todas las rutas de la app', () => {
  const delBarrido = rutasDelBarrido()

  it('la lista de pantallas del barrido se lee', () => {
    expect(delBarrido.length).toBeGreaterThan(30)
    expect(delBarrido).toContain('/')
  })

  it.each(rutas.filter((r) => !r.path.includes('pathMatch')).map((r) => r.path))(
    '%s tiene al menos una pantalla en e2e/utilidades/pantallas-de-la-app.ts',
    (camino) => {
      expect(delBarrido.some((ruta) => patron(camino).test(ruta))).toBe(true)
    },
  )
})
