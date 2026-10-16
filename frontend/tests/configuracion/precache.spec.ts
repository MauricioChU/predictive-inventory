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

/** Lo que podría dejar un build: la app, sus chunks (también los del módulo Catálogo) y el kit. */
const ARCHIVOS = [
  'index.html',
  'assets/index-abc12345.js',
  'assets/index-abc12345.css',
  'assets/GraficoBarras-def67890.js',
  'assets/GraficoBarras-def67890.css',
  'assets/CatalogoVista-9c8d7e6f.js',
  'assets/CatalogoVista-9c8d7e6f.css',
  'assets/CatalogoKitBotones-0a1b2c3d.js',
  'assets/CatalogoKitBotones-0a1b2c3d.css',
  'assets/CatalogoKitTarjetas-4e5f6a7b.js',
  'node_modules/algo/index.js',
]

/**
 * RN-SIS-09 (primera carga): las páginas del kit de pantallas de prueba (chunks `CatalogoKit*`)
 * no van al precache del service worker; las pantallas reales sí, también las del módulo
 * Catálogo (p. ej. `CatalogoVista-*`) y el chunk de GraficoBarras (la Torre lo usa). Se aplica `PRECACHE` (vite.config.ts) igual que workbox-build: `glob` con `ignore`.
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

  it('RN-SIS-09: deja afuera solo el kit de prueba (CatalogoKit*) y node_modules', () => {
    expect(precacheados()).toEqual([
      'assets/CatalogoVista-9c8d7e6f.css',
      'assets/CatalogoVista-9c8d7e6f.js',
      'assets/GraficoBarras-def67890.css',
      'assets/GraficoBarras-def67890.js',
      'assets/index-abc12345.css',
      'assets/index-abc12345.js',
      'index.html',
    ])
  })
})
