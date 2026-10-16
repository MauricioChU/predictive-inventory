// @vitest-environment node
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { dirname, join, posix } from 'node:path'
import { fileURLToPath } from 'node:url'
import { beforeAll, describe, expect, it } from 'vitest'

/**
 * RN-SIS-09 (primera carga), sobre el build de producción que deja `npm run build-only` en
 * dist/. No es parte de la suite de unidad: corre aparte y en orden (`npm run test:build`,
 * vitest.config.build.ts), en el job Frontend del CI justo después de build-only.
 */
const DIST = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'dist')
const BASE = '/predictive-inventory/'

/** Lo que dejan en el código las dos librerías de Excel (las rutas internas de un .xlsx). */
const HUELLAS_DE_EXCEL = ['[Content_Types].xml', 'xl/workbook.xml']

/** `import … from "./x.js"` o `import "./x.js"` (estático); `import("./x.js")` no cuenta. */
const IMPORTACION_ESTATICA = /\bimport\s*(?:[\w$*{}\s,]*\bfrom\s*)?["'](\.\/[^"']+\.js)["']/g

function leer(archivo: string): string {
  return readFileSync(join(DIST, archivo), 'utf8')
}

/** Lo que el navegador descarga al abrir: lo que pide index.html y lo que eso importa estático. */
function loQueSeDescargaAlAbrir(): Set<string> {
  const html = leer('index.html')
  const pedidos = [
    ...html.matchAll(/<script[^>]*\bsrc="([^"]+\.js)"/g),
    ...html.matchAll(/<link[^>]*rel="modulepreload"[^>]*href="([^"]+)"/g),
  ].map((m) => m[1]!.replace(BASE, ''))
  const vistos = new Set<string>()
  while (pedidos.length > 0) {
    const archivo = pedidos.pop()!
    if (vistos.has(archivo)) continue
    vistos.add(archivo)
    for (const m of leer(archivo).matchAll(IMPORTACION_ESTATICA)) {
      pedidos.push(posix.join(posix.dirname(archivo), m[1]!))
    }
  }
  return vistos
}

describe('build de producción (dist/)', () => {
  let alAbrir = new Set<string>()
  let despues: string[] = []

  beforeAll(() => {
    if (!existsSync(join(DIST, 'index.html'))) {
      throw new Error('Falta el build: corre `npm run build-only` antes de `npm run test:build`')
    }
    alAbrir = loQueSeDescargaAlAbrir()
    despues = readdirSync(join(DIST, 'assets'))
      .filter((nombre) => nombre.endsWith('.js'))
      .map((nombre) => `assets/${nombre}`)
      .filter((archivo) => !alAbrir.has(archivo))
  })

  it('RN-SIS-09: las librerías de Excel no están en lo que se descarga al abrir la app', () => {
    expect([...alAbrir].some((archivo) => archivo.startsWith('assets/index-'))).toBe(true)
    const conExcel = [...alAbrir].flatMap((archivo) =>
      HUELLAS_DE_EXCEL.filter((huella) => leer(archivo).includes(huella)).map(
        (huella) => `${archivo} trae ${huella}`,
      ),
    )
    expect(conExcel).toEqual([])
  })

  it('RN-RE-01/07: las librerías de Excel siguen en el build, para cargarlas al exportar o importar', () => {
    for (const huella of HUELLAS_DE_EXCEL) {
      expect(despues.some((archivo) => leer(archivo).includes(huella))).toBe(true)
    }
  })

  it('RN-SIS-08: el service worker precachea lo que se carga después (Excel y GraficoBarras)', () => {
    const sw = leer('sw.js')
    expect(despues.some((archivo) => archivo.includes('GraficoBarras'))).toBe(true)
    expect(despues.filter((archivo) => !sw.includes(archivo))).toEqual([])
  })
})
