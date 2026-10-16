import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

/**
 * Las pruebas del build de producción (tests/build/): leen dist/, así que corren DESPUÉS de
 * `npm run build-only` y aparte de la suite de unidad (`npm run test:build`), de a una.
 */
export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/build/**/*.spec.ts'],
    fileParallelism: false,
    root: fileURLToPath(new URL('./', import.meta.url)),
  },
})
