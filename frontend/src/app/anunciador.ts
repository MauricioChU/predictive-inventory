import { computed, inject, nextTick, ref, type ComputedRef, type InjectionKey } from 'vue'

export interface Anunciador {
  /** Texto actual de la región aria-live persistente que LayoutApp renderiza. */
  texto: ComputedRef<string>
  /** Anuncia `mensaje`. Si es idéntico al anuncio anterior, igualmente se vuelve a anunciar:
   * primero se vacía la región (una mutación real del DOM) y en el siguiente tick se pone el
   * texto (otra mutación) — si no se vaciara primero, un lector de pantalla no vería ningún
   * cambio de texto y no anunciaría nada la segunda vez. */
  anunciar: (mensaje: string) => void
  /** Deja la región vacía (p. ej. al cerrar un aviso), para no dejar texto viejo dando vueltas. */
  limpiar: () => void
}

/** LayoutApp provee un único anunciador global; cualquier pantalla puede inyectarlo para
 * anunciar resultados sin montar su propia región aria-live (RN-UX-15). */
export const CLAVE_ANUNCIADOR: InjectionKey<Anunciador> = Symbol('anunciador')

export function crearAnunciador(): Anunciador {
  const estado = ref('')
  return {
    texto: computed(() => estado.value),
    anunciar(mensaje: string) {
      estado.value = ''
      void nextTick(() => {
        estado.value = mensaje
      })
    },
    limpiar() {
      estado.value = ''
    },
  }
}

/** Para pantallas que sí requieren el anunciador (lanza si no hay uno provisto). Para
 * componentes reutilizables donde el anunciador es opcional, usar
 * `inject(CLAVE_ANUNCIADOR, undefined)` directamente (ver PantallaExito). */
export function useAnunciador(): Anunciador {
  const contexto = inject(CLAVE_ANUNCIADOR)
  if (!contexto) throw new Error('useAnunciador debe usarse dentro de LayoutApp')
  return contexto
}
