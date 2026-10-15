/// <reference types="vite/client" />

import 'vue-router'
declare module 'vue-router' {
  interface RouteMeta {
    titulo?: string
    enNavegacion?: boolean
    icono?: string
  }
}
