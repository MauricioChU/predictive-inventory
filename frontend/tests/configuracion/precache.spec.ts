// @vitest-environment node
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { PRECACHE } from '../../vite.config'

type GlobSync = (
  patron: string,
  opciones: { cwd: string; ignore: string[]; posix: boolean },
) => string[]

/** El mismo `glob` que usa workbox-build (el de vite-plugin-pwa) para armar el precache. */
function globDeWorkbox(): GlobSync {
  const desdeLaApp = createRequire(import.meta.url)
  const desdePwa = createRequire(desdeLaApp.resolve('vite-plugin-pwa'))
  const desdeWorkbox = createRequire(desdePwa.resolve('workbox-build'))
  return (desdeWorkbox('glob') as { globSync: GlobSync }).globSync
}

/** Lo que podría dejar un build: la app, sus chunks y las páginas de catálogo de prueba. */
const ARCHIVOS = [
  'index.html',
  'assets/index-abc12345.js',
  'assets/index-abc12345.css',
  'assets/GraficoBarras-def67890.js',
  'assets/GraficoBarras-def67890.css',
  'assets/CatalogoBotones-0a1b2c3d.js',
  'assets/CatalogoBotones-0a1b2c3d.css',
  'assets/CatalogoTarjetas-4e5f6a7b.js',
  'node_modules/algo/index.js',
]

/**
 * RN-SIS-09 (primera carga): las páginas de catálogo de prueba (`src/shared/ui/__catalogo__/
 * Catalogo*.vue`) no van al precache del service worker; el chunk de GraficoBarras sí (la Torre
 * lo usa). Se aplica `PRECACHE` (vite.config.ts) igual que workbox-build: `glob` con `ignore`.
 */
describe('precache del service worker', () => {
  let dist = ''

  beforeAll(async () => {
    dist = await mkdtemp(join(tmpdir(), 'predictive-inventory-precache-'))
    for (const archivo of ARCHIVOS) {
      await mkdir(dirname(join(dist, archivo)), { recursive: true })
      await writeFile(join(dist, archivo), '')
    }
  })

  afterAll(async () => {
    if (dist) await rm(dist, { recursive: true, force: true })
  })

  function precacheados(): string[] {
    const globSync = globDeWorkbox()
    return PRECACHE.globPatterns
      .flatMap((patron) =>
        globSync(patron, { cwd: dist, ignore: PRECACHE.globIgnores, posix: true }),
      )
      .sort()
  }

  it('RN-SIS-09: deja afuera las páginas de catálogo de prueba (Catalogo*) y node_modules', () => {
    expect(precacheados()).toEqual([
      'assets/GraficoBarras-def67890.css',
      'assets/GraficoBarras-def67890.js',
      'assets/index-abc12345.css',
      'assets/index-abc12345.js',
      'index.html',
    ])
  })
})
