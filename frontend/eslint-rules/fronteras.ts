import { basename, dirname, join, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { Rule } from 'eslint'

// Fix round 2, I3: sustituye los patrones relativos de no-restricted-imports (que no
// podían distinguir "subir N niveles dentro del mismo módulo" de "subir N niveles y
// cruzar a otro módulo") por una regla que RESUELVE cada especificador a una ruta
// absoluta y clasifica el importador y el destino. Así la profundidad de anidamiento ya
// no importa: lo que importa es a qué carpeta real apunta la ruta resuelta.

const AQUI = dirname(fileURLToPath(import.meta.url))
/** `frontend/src` — raíz para resolver el alias `@/…` y para clasificar rutas. */
export const SRC_ROOT = join(AQUI, '..', 'src')
/** `frontend/tests` — todo lo que no es `src/`. */
export const TESTS_ROOT = join(AQUI, '..', 'tests')
/** `frontend/e2e` — Fix round 3, minor 3: igual que tests/**, pero para Playwright. */
export const E2E_ROOT = join(AQUI, '..', 'e2e')

type Capa = 'domain' | 'application' | 'infrastructure' | 'ui'
const CAPAS: readonly Capa[] = ['domain', 'application', 'infrastructure', 'ui']

export type Clasificacion =
  | { area: 'modules'; modulo: string; capa: Capa | 'root' }
  | { area: 'shared'; capa: Capa | 'contratos' | 'root' }
  | { area: 'app' }
  | { area: 'router' }
  | { area: 'tests' }
  | { area: 'e2e' }
  | { area: 'other' }

function esCapa(valor: string | undefined): valor is Capa {
  return CAPAS.includes(valor as Capa)
}

function dentroDe(raiz: string, absoluto: string): boolean {
  const rel = relative(raiz, absoluto)
  return rel !== '' && !rel.startsWith('..') && !rel.startsWith(`.${sep}`)
}

/** Clasifica una ruta ABSOLUTA ya resuelta (Fix round 2, I3). */
export function clasificar(absoluto: string): Clasificacion {
  if (dentroDe(SRC_ROOT, absoluto)) {
    const [primero, segundo, tercero] = relative(SRC_ROOT, absoluto).split(sep)
    if (primero === 'modules' && segundo) {
      return { area: 'modules', modulo: segundo, capa: esCapa(tercero) ? tercero : 'root' }
    }
    if (primero === 'shared') {
      const capa = segundo === 'contratos' ? 'contratos' : esCapa(segundo) ? segundo : 'root'
      return { area: 'shared', capa }
    }
    if (primero === 'app') return { area: 'app' }
    if (primero === 'router') return { area: 'router' }
    return { area: 'other' }
  }
  if (dentroDe(TESTS_ROOT, absoluto)) return { area: 'tests' }
  // Fix round 3, minor 3: e2e/** se trata igual que tests/** (solo módulos por su index).
  if (dentroDe(E2E_ROOT, absoluto)) return { area: 'e2e' }
  return { area: 'other' }
}

/**
 * Fix round 3, ruling 1 (load-bearing para la Ola 2): un *.spec.ts, o un archivo bajo
 * `__pruebas__/` usado solo por specs, puede probar su propio módulo de punta a punta con
 * adaptadores en memoria.
 */
function esArchivoDePruebas(archivo: string): boolean {
  if (archivo.endsWith('.spec.ts')) return true
  return /[\\/]__pruebas__[\\/]/.test(archivo)
}

function quitarExtension(ruta: string): string {
  return ruta.replace(/\.(ts|tsx|js|vue)$/i, '')
}

/**
 * Ola 4: las pantallas de un módulo (capa `ui`) llegan a la aplicación compuesta SOLO por estas
 * tres "puertas" de `src/app`: `useAplicacion()` (los casos de uso), el estado global (Pinia) y
 * `useAvisoDeshacer()`. El resto de `src/app` (composición, arranque, ganchos de prueba…) sigue
 * fuera de su alcance.
 */
const PUERTAS_DE_LA_APP = ['proveer-aplicacion', 'estado-global', 'aviso-deshacer'].map((nombre) =>
  join(SRC_ROOT, 'app', nombre),
)

function esPuertaDeLaApp(destinoAbsoluto: string): boolean {
  return PUERTAS_DE_LA_APP.includes(quitarExtension(destinoAbsoluto))
}

function esIndiceDeModulo(destinoAbsoluto: string, modulo: string): boolean {
  const sinExt = quitarExtension(destinoAbsoluto)
  const dirModulo = join(SRC_ROOT, 'modules', modulo)
  return sinExt === dirModulo || sinExt === join(dirModulo, 'index')
}

/** Resuelve un especificador de import a una ruta absoluta, o null si es un paquete
 * suelto (no se clasifica aquí: vue, dexie, @cucumber/…, node:fs, etc.). */
export function resolverEspecificador(
  especificador: string,
  archivoImportador: string,
): string | null {
  if (especificador.startsWith('.')) return resolve(dirname(archivoImportador), especificador)
  if (especificador.startsWith('@/')) return resolve(SRC_ROOT, especificador.slice(2))
  return null
}

const MENSAJE_UOW_SOLO_PRUEBAS =
  'UnidadDeTrabajoEnMemoria usa AsyncLocalStorage (solo Node): impórtala solo desde *.spec.ts o tests/** (ADR-0005). La app usa transacciones de Dexie.'
const MENSAJE_SHARED_NUNCA_MODULOS =
  'El código compartido (shared/**) nunca importa módulos, "app" ni "router" (ADR-0005).'
const MENSAJE_TESTS_SOLO_INDEX =
  'Desde tests/** o e2e/** un módulo solo se importa por su index (@/modules/<modulo>) o por la composición de pruebas (ADR-0005).'
const MENSAJE_CRUCE_NO_INDICE =
  'No se cruza a otro módulo con una ruta relativa ni por un archivo interno: usa @/modules/<modulo> (ADR-0005).'
const MENSAJE_CRUCE_DESDE_DOMINIO_O_APLICACION =
  'El dominio y los casos de uso no dependen de otros módulos, ni siquiera de su index (ADR-0005).'
const MENSAJE_DOMINIO =
  'El dominio de un módulo solo usa su propio dominio, shared/domain o shared/contratos (ADR-0005).'
const MENSAJE_APLICACION =
  'Los casos de uso solo usan su propio dominio/aplicación, shared/domain, shared/contratos o shared/application (ADR-0005).'
const MENSAJE_INFRAESTRUCTURA =
  'La infraestructura de un módulo no importa su propia UI ni "app" (ADR-0005).'
const MENSAJE_UI =
  'La UI de un módulo solo usa su dominio/aplicación, shared, otros módulos por su index o las puertas de la app (useAplicacion, estado global, aviso Deshacer) (ADR-0005).'
const MENSAJE_INDICE_DE_MODULO =
  'El index de un módulo solo usa sus propias capas o shared (ADR-0005).'
const MENSAJE_SHARED_DOMAIN = 'shared/domain solo usa shared/domain y shared/contratos (ADR-0005).'
const MENSAJE_SHARED_CONTRATOS =
  'shared/contratos solo usa shared/domain y shared/contratos (ADR-0005).'
const MENSAJE_SHARED_APPLICATION =
  'shared/application solo usa shared/domain, shared/contratos y shared/application (ADR-0005).'
const MENSAJE_SHARED_OTROS = 'shared/** no depende de módulos, "app" ni "router" (ADR-0005).'

/**
 * Devuelve el mensaje de error si `especificador` (escrito en `archivoImportador`) viola
 * una frontera de arquitectura, o `null` si está permitido (Fix round 2, I3).
 */
export function verificarFrontera(archivoImportador: string, especificador: string): string | null {
  const destinoAbsoluto = resolverEspecificador(especificador, archivoImportador)
  if (destinoAbsoluto === null) return null // paquete suelto: no es asunto de esta regla

  // Fix round 2, M4: UnidadDeTrabajoEnMemoria usa AsyncLocalStorage (Node); solo pruebas.
  // Fix round 4, R1: el guard original solo miraba ".spec.ts" o el área 'tests', así que un
  // ayudante bajo __pruebas__/ (sin terminar en .spec.ts, p. ej. una fábrica de datos de
  // prueba) quedaba bloqueado por error. Se usa esArchivoDePruebas() (que SÍ cubre
  // __pruebas__/) y se conserva el área 'tests' aparte, porque esArchivoDePruebas() no
  // cubre un archivo NO-spec dentro de tests/** (p. ej. tests/gherkin/ejecutar-feature.ts).
  if (
    basename(quitarExtension(destinoAbsoluto)) === 'unidad-de-trabajo-en-memoria' &&
    !esArchivoDePruebas(archivoImportador) &&
    clasificar(archivoImportador).area !== 'tests'
  ) {
    return MENSAJE_UOW_SOLO_PRUEBAS
  }

  const importador = clasificar(archivoImportador)
  const destino = clasificar(destinoAbsoluto)

  // Fix round 3, ruling 1 (load-bearing para la Ola 2): un *.spec.ts (o un archivo bajo
  // __pruebas__/) co-ubicado con su módulo puede probarlo de punta a punta con sus propios
  // adaptadores en memoria — no está sujeto a las restricciones de CAPA dentro de su propio
  // módulo, ni hacia shared/**, @/router o @/app/**. El cruce a OTRO módulo (salvo su index)
  // ya se resuelve más abajo exactamente igual que para cualquier otro importador: un
  // archivo de pruebas SIGUE sin poder meterse en los archivos internos de otro módulo.
  if (esArchivoDePruebas(archivoImportador)) {
    const mismoModulo =
      importador.area === 'modules' &&
      destino.area === 'modules' &&
      destino.modulo === importador.modulo
    // Ola 4: también tests/** (p. ej. tests/soporte/aplicacion-de-prueba.ts), para que la spec
    // de una pantalla pruebe con la aplicación de prueba compuesta.
    if (
      mismoModulo ||
      destino.area === 'shared' ||
      destino.area === 'router' ||
      destino.area === 'app' ||
      destino.area === 'tests'
    ) {
      return null
    }
  }

  if (
    importador.area === 'shared' &&
    (destino.area === 'modules' || destino.area === 'app' || destino.area === 'router')
  ) {
    return MENSAJE_SHARED_NUNCA_MODULOS
  }

  if (importador.area === 'tests' || importador.area === 'e2e') {
    if (destino.area === 'modules' && !esIndiceDeModulo(destinoAbsoluto, destino.modulo)) {
      return MENSAJE_TESTS_SOLO_INDEX
    }
    return null
  }

  const cruzaAOtroModulo =
    destino.area === 'modules' &&
    (importador.area !== 'modules' || importador.modulo !== destino.modulo)
  if (cruzaAOtroModulo) {
    if (!esIndiceDeModulo(destinoAbsoluto, destino.modulo)) return MENSAJE_CRUCE_NO_INDICE
    if (
      importador.area === 'modules' &&
      (importador.capa === 'domain' || importador.capa === 'application')
    ) {
      return MENSAJE_CRUCE_DESDE_DOMINIO_O_APLICACION
    }
    return null
  }

  if (importador.area === 'modules') {
    const propiaCapa = (capa: Capa) =>
      destino.area === 'modules' && destino.modulo === importador.modulo && destino.capa === capa
    const enShared = (...capas: Array<Capa | 'contratos'>) =>
      destino.area === 'shared' && capas.includes(destino.capa as Capa | 'contratos')

    switch (importador.capa) {
      case 'domain':
        if (propiaCapa('domain') || enShared('domain', 'contratos')) return null
        return MENSAJE_DOMINIO
      case 'application':
        if (
          propiaCapa('domain') ||
          propiaCapa('application') ||
          enShared('domain', 'contratos', 'application')
        ) {
          return null
        }
        return MENSAJE_APLICACION
      case 'infrastructure':
        if (
          propiaCapa('domain') ||
          propiaCapa('application') ||
          propiaCapa('infrastructure') ||
          destino.area === 'shared'
        ) {
          return null
        }
        return MENSAJE_INFRAESTRUCTURA
      case 'ui':
        if (
          propiaCapa('domain') ||
          propiaCapa('application') ||
          propiaCapa('ui') ||
          destino.area === 'shared' ||
          esPuertaDeLaApp(destinoAbsoluto)
        ) {
          return null
        }
        return MENSAJE_UI
      default: // 'root': el propio index.ts del módulo
        if (
          (destino.area === 'modules' && destino.modulo === importador.modulo) ||
          destino.area === 'shared'
        ) {
          return null
        }
        return MENSAJE_INDICE_DE_MODULO
    }
  }

  if (importador.area === 'shared') {
    switch (importador.capa) {
      case 'domain':
        if (
          destino.area === 'shared' &&
          (destino.capa === 'domain' || destino.capa === 'contratos')
        )
          return null
        return MENSAJE_SHARED_DOMAIN
      case 'contratos':
        if (
          destino.area === 'shared' &&
          (destino.capa === 'domain' || destino.capa === 'contratos')
        )
          return null
        return MENSAJE_SHARED_CONTRATOS
      case 'application':
        if (
          destino.area === 'shared' &&
          (destino.capa === 'domain' ||
            destino.capa === 'contratos' ||
            destino.capa === 'application')
        ) {
          return null
        }
        return MENSAJE_SHARED_APPLICATION
      default: // infrastructure, root
        if (destino.area === 'shared') return null
        return MENSAJE_SHARED_OTROS
    }
  }

  return null // app, router, other como importadores: sin restricción adicional de esta regla
}

interface NodoFuenteLiteral {
  type: string
  value?: unknown
}

interface NodoFuenteTemplateLiteral {
  type: string
  expressions?: readonly unknown[]
  quasis?: readonly { value?: { cooked?: string | null } }[]
}

/** Forma mínima común a ImportDeclaration/ExportNamedDeclaration/ExportAllDeclaration/
 * ImportExpression/TSImportType: todas tienen (o pueden tener) un `source`. */
interface NodoConFuente {
  source?: (NodoFuenteLiteral & NodoFuenteTemplateLiteral) | null
}

/**
 * Fix round 3, minor 2: además de un string literal (`'./x'`), reconoce un template literal
 * SIN interpolaciones (`` `./x` ``) — el único caso donde el destino sigue siendo estático y
 * por lo tanto resoluble. `import.meta.glob`/`new URL(...)` quedan deliberadamente fuera: no
 * tienen un único "especificador" que resolver de la misma manera.
 */
function fuenteLiteral(nodo: NodoConFuente): string | null {
  const fuente = nodo.source
  if (!fuente) return null
  if (typeof fuente.value === 'string') return fuente.value
  if (fuente.type === 'TemplateLiteral' && fuente.expressions?.length === 0) {
    const cooked = fuente.quasis?.[0]?.value?.cooked
    return typeof cooked === 'string' ? cooked : null
  }
  return null
}

/**
 * Plugin local de ESLint (sin dependencias nuevas) con la regla `fronteras` (Fix round 2, I3).
 * Fix round 3, minor 8: `meta.name`/`meta.version` para que la caché de ESLint se invalide
 * cuando cambie este archivo (sin esto, un plugin local sin versión puede quedar cacheado).
 */
export const pluginArquitectura = {
  meta: { name: 'arquitectura-local', version: '1.0.0' },
  rules: {
    fronteras: {
      meta: {
        type: 'problem',
        docs: {
          description:
            'Hace cumplir las fronteras de ADR-0005 entre módulos, capas y shared, resolviendo cada import a su ruta absoluta.',
        },
        schema: [],
      },
      create(context: Rule.RuleContext): Rule.RuleListener {
        function revisar(nodo: NodoConFuente & Rule.Node): void {
          const especificador = fuenteLiteral(nodo)
          if (especificador === null) return
          const mensaje = verificarFrontera(context.filename, especificador)
          if (mensaje) context.report({ node: nodo, message: mensaje })
        }
        return {
          ImportDeclaration: revisar,
          ExportNamedDeclaration: revisar,
          ExportAllDeclaration: revisar,
          ImportExpression: revisar,
          // Fix round 3, minor 2: import('…').Tipo (TypeScript) también se revisa.
          TSImportType: revisar,
        }
      },
    } satisfies Rule.RuleModule,
  },
}
