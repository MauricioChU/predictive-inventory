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
        patterns: [{
          group: ['@/modules/*/*', '@/modules/*/*/**'],
          message: 'Importa otros módulos solo por su index (@/modules/<modulo>). Dentro del módulo usa rutas relativas (ADR-0005).',
        }],
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
        ],
      }],
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
