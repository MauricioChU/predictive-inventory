import { computed, inject, ref, type ComputedRef, type InjectionKey } from 'vue'
import type { Anunciador } from './anunciador'

export interface OpcionesAvisoDeshacer {
  mensaje: string
  segundos?: number
  alDeshacer: () => void
}

/** Instancia activa de un aviso: incluye un `id` único por llamada a `mostrar()`, usado como
 * `:key` del `<AvisoDeshacer>` para forzar una instancia (y un temporizador) nuevos (Q1). */
export interface AvisoDeshacerActivo extends OpcionesAvisoDeshacer {
  id: number
}

export interface ContextoAvisoDeshacer {
  /** Solo lectura: nadie fuera de este módulo puede mutar el aviso activo (Q1). */
  activo: ComputedRef<AvisoDeshacerActivo | undefined>
  mostrar: (opciones: OpcionesAvisoDeshacer) => void
  cerrar: () => void
}

/** LayoutApp provee este contexto para que cualquier pantalla pueda pedir un aviso Deshacer global (RN-OP-18). */
export const CLAVE_AVISO_DESHACER: InjectionKey<ContextoAvisoDeshacer> = Symbol('aviso-deshacer')

let contadorId = 0

function textoAnuncio(mensaje: string, segundos: number): string {
  const resto = segundos === 1 ? '1 segundo' : `${segundos} segundos`
  return `${mensaje}. Puedes deshacer durante ${resto}.`
}

/** Hallazgo 3: el anuncio ahora lo hace el anunciador compartido (ver app/anunciador.ts), que
 * ya resuelve "mismo mensaje dos veces" y "limpiar al cerrar" de forma genérica — este módulo
 * ya no mantiene su propio texto de anuncio. */
export function crearContextoAvisoDeshacer(anunciador: Anunciador): ContextoAvisoDeshacer {
  const estado = ref<AvisoDeshacerActivo>()

  return {
    activo: computed(() => estado.value),
    mostrar(opciones: OpcionesAvisoDeshacer) {
      contadorId += 1
      // Cada llamada obtiene un id distinto: LayoutApp lo usa como :key para montar una
      // instancia de <AvisoDeshacer> completamente nueva (con su propio temporizador de 10 s),
      // en vez de reutilizar la anterior (que cerraría el aviso nuevo a mitad de camino).
      estado.value = { ...opciones, id: contadorId }
      anunciador.anunciar(textoAnuncio(opciones.mensaje, opciones.segundos ?? 10))
    },
    cerrar() {
      estado.value = undefined
      anunciador.limpiar()
    },
  }
}

export function useAvisoDeshacer(): ContextoAvisoDeshacer {
  const contexto = inject(CLAVE_AVISO_DESHACER)
  if (!contexto) throw new Error('useAvisoDeshacer debe usarse dentro de LayoutApp')
  return contexto
}
