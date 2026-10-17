/// <reference types="vite/client" />

import 'vue-router'
declare module 'vue-router' {
  interface RouteMeta {
    titulo?: string
    enNavegacion?: boolean
    icono?: string
  }
}

declare global {
  /** Plan 14: la versión de package.json (vite.config.ts → define), para "Acerca de". */
  const __VERSION_DE_LA_APP__: string
}
