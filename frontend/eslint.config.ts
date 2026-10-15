import { globalIgnores } from 'eslint/config'
import { defineConfigWithVueTs, vueTsConfigs } from '@vue/eslint-config-typescript'
import pluginVue from 'eslint-plugin-vue'
import pluginPlaywright from 'eslint-plugin-playwright'
import pluginVitest from '@vitest/eslint-plugin'
import pluginOxlint from 'eslint-plugin-oxlint'
import skipFormatting from 'eslint-config-prettier/flat'
import { pluginArquitectura } from './eslint-rules/fronteras'

// Fix round 2, I3: un solo lugar para los paquetes de framework prohibidos en
// dominio/aplicación (antes había dos copias, ligeramente distintas, de esta lista).
const PAQUETES_DE_FRAMEWORK = ['vue', 'vue-router', 'pinia', 'dexie', '@vueuse/*', 'lucide-vue-next']
const MENSAJE_SIN_FRAMEWORK = 'El dominio y los casos de uso son TypeScript puro: no dependen de frameworks (ADR-0005).'

// Fix round 2, I3: no-restricted-properties para globalThis/self/window × APIs del
// navegador, generado una vez para no repetir 24 entradas a mano.
const PROPIEDADES_DE_NAVEGADOR = [
  'localStorage',
  'sessionStorage',
  'indexedDB',
  'navigator',
  'document',
  'fetch',
  'Notification',
  'location',
]
const OBJETOS_GLOBALES = ['globalThis', 'self', 'window']
const RESTRICCIONES_DE_PROPIEDADES = OBJETOS_GLOBALES.flatMap((objeto) =>
  PROPIEDADES_DE_NAVEGADOR.map((property) => ({
    object: objeto,
    property,
    message: 'El dominio es TypeScript puro: no usa APIs del navegador (ADR-0005).',
  })),
)

// To allow more languages other than `ts` in `.vue` files, uncomment the following lines:
// import { configureVueProject } from '@vue/eslint-config-typescript'
// configureVueProject({ scriptLangs: ['ts', 'tsx'] })
// More info at https://github.com/vuejs/eslint-config-typescript/#advanced-setup

export default defineConfigWithVueTs(
  {
    name: 'app/files-to-lint',
    files: ['**/*.{vue,ts,mts,tsx}'],
  },

  globalIgnores(['**/dist/**', '**/dist-ssr/**', '**/coverage/**']),

  ...pluginVue.configs['flat/essential'],
  vueTsConfigs.recommended,

  {
    ...pluginPlaywright.configs['flat/recommended'],
    files: ['e2e/**/*.{test,spec}.{js,ts,jsx,tsx}'],
  },

  {
    ...pluginVitest.configs.recommended,
    files: ['src/**/__tests__/*', 'src/**/*.spec.ts', 'tests/**/*.spec.ts'],
  },

  {
    name: 'gherkin/pasos-fuera-de-un-bloque-it',
    // Los manejadores de pasos usan `expect` dentro de callbacks que el runner invoca
    // dentro de un `it()` generado en tiempo de ejecución (tests/gherkin/ejecutar-feature.ts),
    // no de forma léxica: no-standalone-expect no puede verlo y da un falso positivo.
    files: ['tests/gherkin/**/*.spec.ts', 'tests/aceptacion/**/*.spec.ts'],
    rules: { 'vitest/no-standalone-expect': 'off' },
  },

  {
    // Fix round 2, I3: sustituye TODOS los patrones relativos/alias de no-restricted-imports
    // por una sola regla local que resuelve cada import a una ruta absoluta y clasifica
    // importador y destino (ver eslint-rules/fronteras.ts). La profundidad de anidamiento ya
    // no importa: '../domain/x' o '../../../valores/precio' intramódulo siguen pasando sin
    // falsos positivos, y un cruce de módulo se detecta sin importar cuántos '..' tenga.
    name: 'arquitectura/fronteras',
    files: ['src/**/*.{ts,vue}', 'tests/**/*.ts'],
    plugins: { arquitectura: pluginArquitectura },
    rules: { 'arquitectura/fronteras': 'error' },
  },
  {
    name: 'arquitectura/dominio-y-aplicacion-sin-framework',
    files: [
      'src/shared/domain/**/*.ts',
      'src/modules/*/domain/**/*.ts',
      'src/shared/application/**/*.ts',
      'src/modules/*/application/**/*.ts',
    ],
    rules: {
      'no-restricted-imports': ['error', { patterns: [{ group: PAQUETES_DE_FRAMEWORK, message: MENSAJE_SIN_FRAMEWORK }] }],
    },
  },
  {
    name: 'arquitectura/dominio-puro',
    files: ['src/shared/domain/**/*.ts', 'src/modules/*/domain/**/*.ts'],
    rules: {
      'no-restricted-globals': [
        'error',
        ...['window', 'document', 'localStorage', 'sessionStorage', 'navigator', 'indexedDB', 'fetch', 'Notification', 'location'].map(
          (name) => ({ name, message: 'El dominio es TypeScript puro: no usa APIs del navegador (ADR-0005).' }),
        ),
      ],
      // Fix round 2, I3: globalThis.localStorage, self.indexedDB, window.fetch, etc. —
      // no-restricted-globals solo detecta el identificador global suelto (`localStorage`),
      // no accedido como propiedad de otro global.
      'no-restricted-properties': ['error', ...RESTRICCIONES_DE_PROPIEDADES],
    },
  },
  {
    // Fix round 2, I3: el import() dinámico se prohíbe en el CÓDIGO de dominio, pero no en
    // sus *.spec.ts (un test puede necesitar reimportar un módulo dinámicamente).
    name: 'arquitectura/dominio-sin-import-dinamico',
    files: ['src/shared/domain/**/*.ts', 'src/modules/*/domain/**/*.ts'],
    ignores: ['**/*.spec.ts'],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector: 'ImportExpression',
          message: 'El dominio no usa import() dinámico: las dependencias se inyectan, no se cargan desde el dominio (ADR-0005).',
        },
      ],
    },
  },
  {
    name: 'calidad/sin-any',
    files: ['src/**/*.{ts,vue}', 'tests/**/*.ts'],
    rules: { '@typescript-eslint/no-explicit-any': 'error' },
  },

  ...pluginOxlint.buildFromOxlintConfigFile('.oxlintrc.json'),

  skipFormatting,
)
