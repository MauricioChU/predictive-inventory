import { computed, inject, ref, type ComputedRef, type InjectionKey } from 'vue'

/**
 * N4 (ronda 4): tiempo entre el primer mensaje de un anuncio y el momento en que se escribe
 * en la región. Cumple dos cosas a la vez:
 * - los mensajes que llegan dentro de esta ventana (p. ej. el aviso Deshacer y PantallaExito
 *   en el mismo flujo) se UNEN en un solo anuncio, en vez de que el último pise al anterior;
 * - entre vaciar la región y volver a escribirla pasa tiempo de verdad (no el mismo frame ni
 *   el siguiente tick): si no, algunos lectores de pantalla no ven el cambio y callan.
 */
export const ESPERA_ANUNCIO_MS = 150

export interface Anunciador {
  /** Texto actual de la región aria-live persistente que LayoutApp renderiza. */
  texto: ComputedRef<string>
  /** Anuncia `mensaje` y devuelve su identificador (para `limpiar`). Vacía la región en el
   * acto y escribe el texto `ESPERA_ANUNCIO_MS` después, junto con los demás mensajes que
   * hayan llegado en ese lapso. Un mensaje idéntico al anterior igualmente se vuelve a
   * anunciar (por el vaciado previo). */
  anunciar: (mensaje: string) => number
  /** Retira el mensaje `id`: si todavía no se escribió, sale del anuncio pendiente; si es
   * parte del anuncio visible, vacía la región (no deja texto viejo dando vueltas). Si la
   * región ya muestra un anuncio más nuevo de otra pantalla, no hace nada. */
  limpiar: (id: number) => void
}

/** LayoutApp provee un único anunciador global; cualquier pantalla puede inyectarlo para
 * anunciar resultados sin montar su propia región aria-live (RN-UX-15). */
export const CLAVE_ANUNCIADOR: InjectionKey<Anunciador> = Symbol('anunciador')

interface Entrada {
  id: number
  mensaje: string
}

const TERMINA_EN_PUNTUACION = /[.!?…:;]$/

/** Une los mensajes con ". " sin duplicar la puntuación que ya traen y sin repetir uno idéntico. */
function unir(mensajes: readonly string[]): string {
  const distintos = [...new Set(mensajes.map((m) => m.trim()).filter((m) => m !== ''))]
  return distintos.reduce((texto, mensaje) => {
    if (texto === '') return mensaje
    return TERMINA_EN_PUNTUACION.test(texto) ? `${texto} ${mensaje}` : `${texto}. ${mensaje}`
  }, '')
}

export function crearAnunciador(): Anunciador {
  const estado = ref('')
  let siguienteId = 0
  /** Mensajes que forman el texto que la región muestra ahora. */
  let visibles: Entrada[] = []
  /** Mensajes que esperan a que termine la ventana para escribirse juntos. */
  let pendientes: Entrada[] = []
  let temporizador: ReturnType<typeof setTimeout> | undefined

  function escribir() {
    temporizador = undefined
    visibles = pendientes
    pendientes = []
    estado.value = unir(visibles.map((e) => e.mensaje))
  }

  return {
    texto: computed(() => estado.value),
    anunciar(mensaje: string) {
      siguienteId += 1
      if (temporizador === undefined) {
        // Primer mensaje de un anuncio nuevo: primera mutación (vaciar) ya mismo; la segunda
        // (el texto) al cerrar la ventana.
        visibles = []
        estado.value = ''
        temporizador = setTimeout(escribir, ESPERA_ANUNCIO_MS)
      }
      pendientes.push({ id: siguienteId, mensaje })
      return siguienteId
    },
    limpiar(id: number) {
      if (pendientes.some((e) => e.id === id)) {
        pendientes = pendientes.filter((e) => e.id !== id)
        if (pendientes.length === 0 && temporizador !== undefined) {
          clearTimeout(temporizador)
          temporizador = undefined
        }
        return
      }
      if (visibles.some((e) => e.id === id)) {
        // Se vacía todo (no se reescribe "lo que queda"): con role="status" (aria-atomic) un
        // texto que cambia se volvería a leer entero; quitar texto, en cambio, no se anuncia.
        visibles = []
        estado.value = ''
      }
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
