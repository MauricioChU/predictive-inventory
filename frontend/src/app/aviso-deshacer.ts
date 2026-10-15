import { computed, inject, ref, type ComputedRef, type InjectionKey } from 'vue'

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
  /** Texto para la región aria-live persistente de LayoutApp (Q2): solo el mensaje, sin el
   * número que cambia cada segundo, para que no se vuelva a anunciar en cada tick. */
  anuncio: ComputedRef<string>
  mostrar: (opciones: OpcionesAvisoDeshacer) => void
  cerrar: () => void
}

/** LayoutApp provee este contexto para que cualquier pantalla pueda pedir un aviso Deshacer global (RN-OP-18). */
export const CLAVE_AVISO_DESHACER: InjectionKey<ContextoAvisoDeshacer> = Symbol('aviso-deshacer')

let contadorId = 0

function textoAnuncio(segundos: number): string {
  const resto = segundos === 1 ? '1 segundo' : `${segundos} segundos`
  return `. Puedes deshacer durante ${resto}.`
}

export function crearContextoAvisoDeshacer(): ContextoAvisoDeshacer {
  const estado = ref<AvisoDeshacerActivo>()
  const anuncio = ref('')

  return {
    activo: computed(() => estado.value),
    anuncio: computed(() => anuncio.value),
    mostrar(opciones: OpcionesAvisoDeshacer) {
      contadorId += 1
      // Cada llamada obtiene un id distinto: LayoutApp lo usa como :key para montar una
      // instancia de <AvisoDeshacer> completamente nueva (con su propio temporizador de 10 s),
      // en vez de reutilizar la anterior (que cerraría el aviso nuevo a mitad de camino).
      estado.value = { ...opciones, id: contadorId }
      anuncio.value = `${opciones.mensaje}${textoAnuncio(opciones.segundos ?? 10)}`
    },
    cerrar() {
      estado.value = undefined
    },
  }
}

export function useAvisoDeshacer(): ContextoAvisoDeshacer {
  const contexto = inject(CLAVE_AVISO_DESHACER)
  if (!contexto) throw new Error('useAvisoDeshacer debe usarse dentro de LayoutApp')
  return contexto
}
