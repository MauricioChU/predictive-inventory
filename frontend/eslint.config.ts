import { globalIgnores } from 'eslint/config'
import { defineConfigWithVueTs, vueTsConfigs } from '@vue/eslint-config-typescript'
import pluginVue from 'eslint-plugin-vue'
import pluginPlaywright from 'eslint-plugin-playwright'
import pluginVitest from '@vitest/eslint-plugin'
import pluginOxlint from 'eslint-plugin-oxlint'
import skipFormatting from 'eslint-config-prettier/flat'

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
    name: 'arquitectura/importar-modulos-por-index',
    files: ['src/**/*.{ts,vue}', 'tests/**/*.ts'],
    rules: {
      'no-restricted-imports': ['error', {
        patterns: [
          {
            group: ['@/modules/*/*', '@/modules/*/*/**'],
            message: 'Importa otros módulos solo por su index (@/modules/<modulo>). Dentro del módulo usa rutas relativas (ADR-0005).',
          },
          // Fix round 1, I3: la regla de arriba solo detecta el alias @/modules/*; una ruta
          // relativa que sube de un módulo y entra a otro por su capa interna la esquivaba
          // por completo. Estos patrones exigen un segmento comodín (el nombre del OTRO
          // módulo) entre los '..' y el nombre de la capa, así que NO detectan las subidas
          // intramódulo normales como '../domain/x' o '../../domain/x' desde una carpeta
          // anidada (ahí el segmento siguiente a los '..' ya es literalmente la capa).
          {
            group: [
              '../../*/domain/**',
              '../../*/application/**',
              '../../*/infrastructure/**',
              '../../*/ui/**',
              '../../../*/domain/**',
              '../../../*/application/**',
              '../../../*/infrastructure/**',
              '../../../*/ui/**',
              '../../../*/**',
            ],
            message: 'No se cruza a otro módulo con una ruta relativa: usa @/modules/<modulo> (ADR-0005).',
          },
          // Fix round 1, I3: tests/** (y cualquier otro código) no debe meterse dentro de
          // la carpeta de un módulo por una ruta relativa que deletree "src/modules/<m>/<capa>";
          // debe pasar por la composición de pruebas o por @/modules/<modulo>.
          {
            group: ['**/src/modules/*/*/**'],
            message: 'No importes directamente dentro de un módulo: usa @/modules/<modulo> o la composición de pruebas (ADR-0005).',
          },
        ],
      }],
    },
  },
  {
    name: 'arquitectura/dominio-puro',
    files: ['src/shared/domain/**/*.ts', 'src/modules/*/domain/**/*.ts'],
    rules: {
      'no-restricted-imports': ['error', {
        patterns: [
          { group: ['vue', 'vue-router', 'pinia', 'dexie', '@vueuse/*', 'lucide-vue-next'], message: 'El dominio es TypeScript puro (ADR-0005).' },
          { group: ['**/application/**', '**/infrastructure/**', '**/ui/**', '@/app/**', '@/modules/**'], message: 'El dominio no depende de otras capas ni de otros módulos (ADR-0005).' },
          // Fix round 1, I3: mismo gap que arriba, pero esta regla reemplaza por completo a
          // 'importar-modulos-por-index' para los archivos de dominio (ESLint flat config: el
          // último bloque que configura la misma regla para un archivo gana, no se combinan),
          // así que estos patrones hay que repetirlos aquí también.
          {
            group: [
              '../../*/domain/**',
              '../../*/application/**',
              '../../*/infrastructure/**',
              '../../*/ui/**',
              '../../../*/**',
            ],
            message: 'El dominio no cruza a otro módulo ni siquiera por ruta relativa (ADR-0005).',
          },
        ],
      }],
      'no-restricted-globals': ['error',
        { name: 'window', message: 'El dominio es TypeScript puro: no usa APIs del navegador (ADR-0005).' },
        { name: 'document', message: 'El dominio es TypeScript puro: no usa APIs del navegador (ADR-0005).' },
        { name: 'localStorage', message: 'El dominio es TypeScript puro: no usa APIs del navegador (ADR-0005).' },
        { name: 'sessionStorage', message: 'El dominio es TypeScript puro: no usa APIs del navegador (ADR-0005).' },
        { name: 'navigator', message: 'El dominio es TypeScript puro: no usa APIs del navegador (ADR-0005).' },
        { name: 'indexedDB', message: 'El dominio es TypeScript puro: no usa APIs del navegador (ADR-0005).' },
        { name: 'fetch', message: 'El dominio es TypeScript puro: no usa APIs del navegador (ADR-0005).' },
        { name: 'Notification', message: 'El dominio es TypeScript puro: no usa APIs del navegador (ADR-0005).' },
        { name: 'location', message: 'El dominio es TypeScript puro: no usa APIs del navegador (ADR-0005).' },
      ],
      'no-restricted-syntax': ['error',
        { selector: 'ImportExpression', message: 'El dominio no usa import() dinámico: las dependencias se inyectan, no se cargan desde el dominio (ADR-0005).' },
      ],
    },
  },
  {
    name: 'arquitectura/aplicacion-sin-infraestructura',
    files: ['src/shared/application/**/*.ts', 'src/modules/*/application/**/*.ts'],
    rules: {
      'no-restricted-imports': ['error', {
        patterns: [
          { group: ['vue', 'vue-router', 'pinia', 'dexie', '@vueuse/*'], message: 'Los casos de uso no dependen de frameworks (ADR-0005).' },
          { group: ['**/infrastructure/**', '**/ui/**', '@/app/**', '@/modules/*/*', '@/modules/*/*/**'], message: 'Los casos de uso solo usan dominio y puertos (ADR-0005).' },
          // Fix round 1, I3: mismo gap que en 'importar-modulos-por-index' (ver ese comentario);
          // se repite aquí porque este bloque reemplaza por completo esa regla para estos archivos.
          {
            group: [
              '../../*/domain/**',
              '../../*/application/**',
              '../../*/infrastructure/**',
              '../../*/ui/**',
              '../../../*/**',
            ],
            message: 'Los casos de uso no cruzan a otro módulo ni siquiera por ruta relativa: usa @/modules/<modulo> (ADR-0005).',
          },
        ],
      }],
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
