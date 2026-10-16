import { dirname, join, relative, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'
import { describe, expect, it } from 'vitest'

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..', '..')

/** Los archivos que `vue-tsc --build` type-checa en un proyecto (según include/exclude). */
function archivosDelProyecto(tsconfig: string): string[] {
  const resultado = ts.getParsedCommandLineOfConfigFile(
    join(RAIZ, tsconfig),
    {},
    {
      ...ts.sys,
      onUnRecoverableConfigFileDiagnostic: (diagnostico) => {
        throw new Error(ts.flattenDiagnosticMessageText(diagnostico.messageText, '\n'))
      },
    },
  )
  if (!resultado) throw new Error(`No se pudo leer ${tsconfig}`)
  return resultado.fileNames.map((archivo) => relative(RAIZ, archivo).split(sep).join('/'))
}

const esAyudanteDePrueba = (archivo: string) => /(^|\/)__pruebas__\//.test(archivo)

// Ola 3, ruling 3: los ayudantes de prueba (`__pruebas__/`) pueden usar lo que solo existe en
// Node (p. ej. UnidadDeTrabajoEnMemoria, con node:async_hooks): no son código de la app.
describe('proyectos de TypeScript', () => {
  it('ADR-0005: el proyecto de la app no type-checa los ayudantes de prueba (__pruebas__)', () => {
    const archivos = archivosDelProyecto('tsconfig.app.json')
    expect(archivos).toContain('src/modules/inventario/application/modulo.ts')
    expect(archivos.filter(esAyudanteDePrueba)).toEqual([])
  })

  it('ADR-0005: el proyecto de Vitest sí los type-checa', () => {
    const archivos = archivosDelProyecto('tsconfig.vitest.json')
    expect(archivos).toContain('src/modules/inventario/__pruebas__/escenario.ts')
    expect(archivos).toContain('src/modules/respaldo/application/__pruebas__/dobles.ts')
    expect(archivos).toContain('src/modules/analisis/domain/__pruebas__/historial.ts')
  })
})
