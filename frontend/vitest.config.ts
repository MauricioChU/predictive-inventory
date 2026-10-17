import { fileURLToPath } from 'node:url'
import { mergeConfig, defineConfig, configDefaults } from 'vitest/config'
import viteConfig from './vite.config.ts'

export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      environment: 'jsdom',
      include: [
        'src/**/*.spec.ts',
        'src/**/__tests__/*.spec.ts',
        'tests/**/*.spec.ts',
        'scripts/**/*.spec.ts',
        'eslint-rules/**/*.spec.ts',
      ],
      // tests/build/ lee el build de producción: corre aparte (npm run test:build).
      exclude: [...configDefaults.exclude, 'e2e/**', 'tests/build/**'],
      root: fileURLToPath(new URL('./', import.meta.url)),
      coverage: {
        provider: 'v8',
        include: ['src/**/*.ts'],
        exclude: [
          'src/**/*.spec.ts',
          'src/**/__pruebas__/**',
          'src/**/ui/**',
          'src/app/**',
          'src/main.ts',
          'src/router/**',
        ],
        thresholds: {
          'src/**/domain/**': { lines: 95, branches: 95, functions: 95, statements: 95 },
          'src/**/application/**': { lines: 90, branches: 90, functions: 90, statements: 90 },
        },
      },
    },
  }),
)
