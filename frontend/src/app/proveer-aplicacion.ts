import { inject, type InjectionKey, type Plugin } from 'vue'
import type { Aplicacion } from './composicion'

export const CLAVE_APLICACION: InjectionKey<Aplicacion> = Symbol('aplicacion')

/** Plugin de Vue: deja la aplicación (los seis módulos ya cableados) al alcance de cada pantalla. */
export function proveerAplicacion(aplicacion: Aplicacion): Plugin {
  return {
    install(app) {
      app.provide(CLAVE_APLICACION, aplicacion)
    },
  }
}

/**
 * Lo único que usan las pantallas para hablar con los casos de uso (nunca repositorios ni
 * Dexie). Se llama dentro de `setup`.
 */
export function useAplicacion(): Aplicacion {
  const aplicacion = inject(CLAVE_APLICACION, null)
  if (!aplicacion) {
    throw new Error('useAplicacion necesita que main.ts instale proveerAplicacion(aplicacion)')
  }
  return aplicacion
}
