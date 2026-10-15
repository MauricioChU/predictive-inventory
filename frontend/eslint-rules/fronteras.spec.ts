import { join } from 'node:path'
import { RuleTester } from 'eslint'
import tsParser from '@typescript-eslint/parser'
import { describe, it } from 'vitest'
import { E2E_ROOT, pluginArquitectura, SRC_ROOT, TESTS_ROOT } from './fronteras'

// Fix round 2, I3: RuleTester cubre cada bypass que señaló el re-revisor como INVALID y
// cada caso intramódulo legítimo que señaló como VALID.

const ruleTester = new RuleTester({
  languageOptions: { parser: tsParser, sourceType: 'module' },
})

const archivo = (...segmentos: string[]) => join(SRC_ROOT, ...segmentos)
const archivoDeTest = (...segmentos: string[]) => join(TESTS_ROOT, ...segmentos)
const archivoE2e = (...segmentos: string[]) => join(E2E_ROOT, ...segmentos)

describe('arquitectura/fronteras', () => {
  it('pasa RuleTester con los casos válidos e inválidos del re-revisor', () => {
    ruleTester.run('fronteras', pluginArquitectura.rules.fronteras, {
      valid: [
        // ui/componentes/formularios/FormularioProducto.vue → '../../../domain/producto'
        {
          code: "import Producto from '../../../domain/producto'",
          filename: archivo(
            'modules',
            'catalogo',
            'ui',
            'componentes',
            'formularios',
            'FormularioProducto.vue',
          ),
        },
        // ui/componentes/formularios/x.ts → '../../../application/crear-producto'
        {
          code: "import { crearProducto } from '../../../application/crear-producto'",
          filename: archivo('modules', 'catalogo', 'ui', 'componentes', 'formularios', 'x.ts'),
        },
        // infrastructure/dexie/repos/x.ts → '../../../domain/producto'
        {
          code: "import Producto from '../../../domain/producto'",
          filename: archivo('modules', 'catalogo', 'infrastructure', 'dexie', 'repos', 'x.ts'),
        },
        // application/casos/sub/x.ts → '../../../domain/producto'
        {
          code: "import Producto from '../../../domain/producto'",
          filename: archivo('modules', 'catalogo', 'application', 'casos', 'sub', 'x.ts'),
        },
        // src/shared/infrastructure/dexie/tablas/x.ts → '../../../application/unidad-de-trabajo'
        {
          code: "import type { UnidadDeTrabajo } from '../../../application/unidad-de-trabajo'",
          filename: archivo('shared', 'infrastructure', 'dexie', 'tablas', 'x.ts'),
        },
        // domain/a/b/c/x.ts → '../../../valores/precio' (anidado a fondo, mismo módulo+capa)
        {
          code: "import { Precio } from '../../../valores/precio'",
          filename: archivo('modules', 'catalogo', 'domain', 'a', 'b', 'c', 'x.ts'),
        },
        // src/app/x.ts → '@/modules/catalogo' (index por alias, válido desde 'app')
        {
          code: "import { catalogo } from '@/modules/catalogo'",
          filename: archivo('app', 'x.ts'),
        },
        // intramódulo clásico: application → domain del mismo módulo
        {
          code: "import { Producto } from '../domain/producto'",
          filename: archivo('modules', 'catalogo', 'application', 'x.ts'),
        },
        // Fix round 2, M4: un *.spec.ts (en cualquier lado) SÍ puede importar la UoW en memoria.
        {
          code: "import { UnidadDeTrabajoEnMemoria } from './unidad-de-trabajo-en-memoria'",
          filename: archivo(
            'shared',
            'infrastructure',
            'memoria',
            'unidad-de-trabajo-en-memoria.spec.ts',
          ),
        },
        // Fix round 2, M4: tests/** también puede importarla.
        {
          code: "import { UnidadDeTrabajoEnMemoria } from '../../src/shared/infrastructure/memoria/unidad-de-trabajo-en-memoria'",
          filename: archivoDeTest('composicion', 'mundo.ts'),
        },
        // Fix round 3, ruling 1: un *.spec.ts co-ubicado prueba su propio módulo de punta a
        // punta con adaptadores en memoria: no está sujeto a las restricciones de capa.
        {
          code: "import { ProductoRepositorio } from '../infrastructure/memoria/repositorios'",
          filename: archivo('modules', 'catalogo', 'application', 'crear.spec.ts'),
        },
        {
          code: "import { UnidadDeTrabajoEnMemoria } from '@/shared/infrastructure/memoria/unidad-de-trabajo-en-memoria'",
          filename: archivo('modules', 'catalogo', 'application', 'crear.spec.ts'),
        },
        // Fix round 3, ruling 1: un *.spec.ts también puede llegar a @/router y @/app/**.
        {
          code: "import { router } from '@/router'",
          filename: archivo('shared', 'ui', '__tests__', 'navegacion.spec.ts'),
        },
        // Fix round 3, ruling 1: y a archivos bajo __pruebas__/ usados solo por specs.
        {
          code: "import { ProductoRepositorio } from '../infrastructure/memoria/repositorios'",
          filename: archivo('modules', 'catalogo', 'application', '__pruebas__', 'fabricas.ts'),
        },
        // Fix round 4, R1: el guard de la UoW en memoria corría ANTES de la excepción de
        // archivos de pruebas y solo miraba ".spec.ts"/área 'tests', así que un ayudante
        // bajo __pruebas__/ (sin terminar en .spec.ts) quedaba bloqueado por error.
        {
          code: "import { UnidadDeTrabajoEnMemoria } from '@/shared/infrastructure/memoria/unidad-de-trabajo-en-memoria'",
          filename: archivo('modules', 'catalogo', 'application', '__pruebas__', 'fabricas.ts'),
        },
        // Fix round 3, minor 6: export ... from también se revisa (intramódulo, válido).
        {
          code: "export { Producto } from '../domain/producto'",
          filename: archivo('modules', 'catalogo', 'application', 'x.ts'),
        },
        // Fix round 3, minor 3: e2e/** sí puede llegar a un módulo por su index.
        {
          code: "import { catalogo } from '@/modules/catalogo'",
          filename: archivoE2e('flujos', 'vender.spec.ts'),
        },
      ],
      invalid: [
        // module index.ts → '../inventario/domain/stock'
        {
          code: "import { stock } from '../inventario/domain/stock'",
          filename: archivo('modules', 'catalogo', 'index.ts'),
          errors: 1,
        },
        // src/app/x.ts → '../modules/inventario/domain/stock'
        {
          code: "import { stock } from '../modules/inventario/domain/stock'",
          filename: archivo('app', 'x.ts'),
          errors: 1,
        },
        // src/app/vistas/x.ts → '../../modules/inventario/infrastructure/repo'
        {
          code: "import { repo } from '../../modules/inventario/infrastructure/repo'",
          filename: archivo('app', 'vistas', 'x.ts'),
          errors: 1,
        },
        // src/router/index.ts → '../modules/catalogo/ui/PaginaCatalogo.vue'
        {
          code: "import PaginaCatalogo from '../modules/catalogo/ui/PaginaCatalogo.vue'",
          filename: archivo('router', 'index.ts'),
          errors: 1,
        },
        // src/shared/domain/x.ts → '../../modules/inventario/domain/stock'
        {
          code: "import { stock } from '../../modules/inventario/domain/stock'",
          filename: archivo('shared', 'domain', 'x.ts'),
          errors: 1,
        },
        // src/shared/domain/x.ts → '../../modules/inventario' (el index: shared sigue bloqueado)
        {
          code: "import { inventario } from '../../modules/inventario'",
          filename: archivo('shared', 'domain', 'x.ts'),
          errors: 1,
        },
        // src/shared/application/x.ts → '../../modules/inventario/application/casos'
        {
          code: "import { casos } from '../../modules/inventario/application/casos'",
          filename: archivo('shared', 'application', 'x.ts'),
          errors: 1,
        },
        // modules/catalogo/domain/x.ts → '../../inventario' (índice, pero domain no puede)
        {
          code: "import { inventario } from '../../inventario'",
          filename: archivo('modules', 'catalogo', 'domain', 'x.ts'),
          errors: 1,
        },
        // modules/catalogo/domain/x.ts → '../../inventario/index' (forma explícita del índice)
        {
          code: "import { inventario } from '../../inventario/index'",
          filename: archivo('modules', 'catalogo', 'domain', 'x.ts'),
          errors: 1,
        },
        // tests/aceptacion/x.spec.ts → '../../src/modules/inventario/domain' (profundo, no es el índice)
        {
          code: "import { algo } from '../../src/modules/inventario/domain'",
          filename: archivoDeTest('aceptacion', 'x.spec.ts'),
          errors: 1,
        },
        // tests/aceptacion/x.spec.ts → '../../src/modules/inventario/contratos' (raíz, pero no es 'index')
        {
          code: "import { algo } from '../../src/modules/inventario/contratos'",
          filename: archivoDeTest('aceptacion', 'x.spec.ts'),
          errors: 1,
        },
        // Fix round 2, M4: fuera de *.spec.ts y de tests/**, no se puede importar la UoW en
        // memoria (usa AsyncLocalStorage, solo Node; la app usa transacciones de Dexie).
        {
          code: "import { UnidadDeTrabajoEnMemoria } from '../shared/infrastructure/memoria/unidad-de-trabajo-en-memoria'",
          filename: archivo('app', 'composicion.ts'),
          errors: 1,
        },
        // Fix round 4, R1: un archivo de PRODUCCIÓN del módulo (ni .spec.ts ni __pruebas__/)
        // sigue sin poder importar la UoW en memoria.
        {
          code: "import { UnidadDeTrabajoEnMemoria } from '@/shared/infrastructure/memoria/unidad-de-trabajo-en-memoria'",
          filename: archivo('modules', 'catalogo', 'application', 'crear.ts'),
          errors: 1,
        },
        // shared/domain no puede alcanzar shared/application.
        {
          code: "import { algo } from '../application/casos'",
          filename: archivo('shared', 'domain', 'x.ts'),
          errors: 1,
        },
        // Fix round 3, ruling 1: el *.spec.ts de un módulo SIGUE sin poder cruzar a otro
        // módulo salvo por su index.
        {
          code: "import { algo } from '../../inventario/domain/x'",
          filename: archivo('modules', 'catalogo', 'application', 'crear.spec.ts'),
          errors: 1,
        },
        // Fix round 3, minor 6: export ... from también se revisa (cruce de módulo).
        {
          code: "export { stock } from '../../inventario/domain/stock'",
          filename: archivo('modules', 'catalogo', 'domain', 'x.ts'),
          errors: 1,
        },
        // Fix round 3, minor 6: import type también se revisa.
        {
          code: "import type { Stock } from '../../inventario/domain/stock'",
          filename: archivo('modules', 'catalogo', 'domain', 'x.ts'),
          errors: 1,
        },
        // Fix round 3, minor 6: import() dinámico también se revisa.
        {
          code: "async function f() { await import('../../inventario/domain/stock') }",
          filename: archivo('modules', 'catalogo', 'domain', 'x.ts'),
          errors: 1,
        },
        // Fix round 3, minor 6: infraestructura no puede importar la UI de su propio módulo.
        {
          code: "import { Pagina } from '../ui/PaginaCatalogo.vue'",
          filename: archivo('modules', 'catalogo', 'infrastructure', 'x.ts'),
          errors: 1,
        },
        // Fix round 3, minor 6: infraestructura tampoco puede importar "app".
        {
          code: "import { algo } from '../../../app/composicion'",
          filename: archivo('modules', 'catalogo', 'infrastructure', 'x.ts'),
          errors: 1,
        },
        // Fix round 3, minor 6: aplicación no puede importar shared/infrastructure.
        {
          code: "import { algo } from '../../../shared/infrastructure/memoria/almacen-en-memoria'",
          filename: archivo('modules', 'catalogo', 'application', 'x.ts'),
          errors: 1,
        },
        // Fix round 3, minor 6: UI no puede entrar a un archivo interno de OTRO módulo
        // (solo por su index, ya cubierto arriba; esto es un archivo profundo).
        {
          code: "import { Stock } from '../../inventario/domain/stock'",
          filename: archivo('modules', 'catalogo', 'ui', 'x.ts'),
          errors: 1,
        },
        // Fix round 3, minor 2: TSImportType (import('…').Tipo) también se revisa.
        {
          code: "type Stock = import('../../inventario/domain/stock').Stock",
          filename: archivo('modules', 'catalogo', 'domain', 'x.ts'),
          errors: 1,
        },
        // Fix round 3, minor 2: import(`…`) con template literal estático también se revisa.
        {
          code: 'async function f() { await import(`../../inventario/domain/stock`) }',
          filename: archivo('modules', 'catalogo', 'domain', 'x.ts'),
          errors: 1,
        },
        // Fix round 3, minor 3: e2e/** no entra a un módulo salvo por su index.
        {
          code: "import { algo } from '../../src/modules/catalogo/domain/x'",
          filename: archivoE2e('flujos', 'vender.spec.ts'),
          errors: 1,
        },
      ],
    })
  })
})
