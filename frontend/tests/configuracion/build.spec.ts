// @vitest-environment node
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { build } from 'vite'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..', '..')

/** Lo que dejan en el código las dos librerías de Excel (las rutas internas de un .xlsx). */
const HUELLAS_DE_EXCEL = ['[Content_Types].xml', 'xl/workbook.xml']

interface EntradaDelManifest {
  file: string
  isEntry?: boolean
  imports?: string[]
  dynamicImports?: string[]
}
type Manifest = Record<string, EntradaDelManifest>

/** Los archivos de `claves` y de todo lo que importan (estático, o también dinámico). */
function alcanzables(manifest: Manifest, claves: string[], conDinamicos: boolean): Set<string> {
  const vistos = new Set<string>()
  const pendientes = [...claves]
  while (pendientes.length > 0) {
    const clave = pendientes.pop()!
    if (vistos.has(clave)) continue
    vistos.add(clave)
    const entrada = manifest[clave]!
    pendientes.push(...(entrada.imports ?? []))
    if (conDinamicos) pendientes.push(...(entrada.dynamicImports ?? []))
  }
  return new Set([...vistos].map((clave) => manifest[clave]!.file))
}

/**
 * RN-SIS-09 (primera carga): el build real de la app (vite.config.ts, en una carpeta temporal,
 * con su manifest). Lo que la app descarga al abrir es el chunk de entrada y lo que importa de
 * forma estática; lo demás llega con `import()` solo cuando hace falta.
 */
describe('build de producción', () => {
  let salida = ''
  let manifest: Manifest = {}

  async function contenido(archivo: string): Promise<string> {
    return readFile(join(salida, archivo), 'utf8')
  }

  beforeAll(async () => {
    salida = await mkdtemp(join(tmpdir(), 'predictive-inventory-build-'))
    await build({
      root: RAIZ,
      configFile: join(RAIZ, 'vite.config.ts'),
      logLevel: 'silent',
      build: { outDir: salida, emptyOutDir: true, manifest: true },
    })
    manifest = JSON.parse(await contenido('.vite/manifest.json')) as Manifest
  }, 120_000)

  afterAll(async () => {
    if (salida) await rm(salida, { recursive: true, force: true })
  })

  function entradas(): string[] {
    return Object.keys(manifest).filter((clave) => manifest[clave]!.isEntry)
  }

  it('RN-SIS-09: las librerías de Excel no están en lo que se descarga al abrir la app', async () => {
    const alAbrir = alcanzables(manifest, entradas(), false)
    expect(alAbrir.size).toBeGreaterThan(0)
    const conExcel: string[] = []
    for (const archivo of alAbrir) {
      const codigo = await contenido(archivo)
      for (const huella of HUELLAS_DE_EXCEL) {
        if (codigo.includes(huella)) conExcel.push(`${archivo} trae ${huella}`)
      }
    }
    expect(conExcel).toEqual([])
  })

  it('RN-RE-01/07: las librerías de Excel siguen en el build, para cargarlas al exportar o importar', async () => {
    const todo = alcanzables(manifest, entradas(), true)
    const codigos = await Promise.all([...todo].map((archivo) => contenido(archivo)))
    for (const huella of HUELLAS_DE_EXCEL) {
      expect(codigos.some((codigo) => codigo.includes(huella))).toBe(true)
    }
  })

  it('RN-SIS-08: el service worker precachea los chunks que se cargan después (Excel y GraficoBarras)', async () => {
    const sw = await contenido('sw.js')
    const despues = [...alcanzables(manifest, entradas(), true)].filter(
      (archivo) => !alcanzables(manifest, entradas(), false).has(archivo),
    )
    expect(despues.some((archivo) => archivo.includes('GraficoBarras'))).toBe(true)
    expect(despues.filter((archivo) => !sw.includes(archivo))).toEqual([])
  })
})
