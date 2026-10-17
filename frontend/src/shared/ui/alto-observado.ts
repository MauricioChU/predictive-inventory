import { onBeforeUnmount, ref, watch, type Ref } from 'vue'

export interface OpcionesDeAltoObservado {
  /**
   * Además, publica el alto en <html> como esta variable CSS (p. ej. "--alto-pie"): 0px mientras
   * el elemento no existe y se quita al desmontar. Así LayoutApp lo usa en
   * `scroll-padding-bottom` sin que cada pantalla lo cablee.
   */
  variable?: `--${string}`
}

/**
 * El alto REAL de `elemento` (px, redondeado hacia arriba), al día con ResizeObserver: cambia
 * con la letra elegida, con el aviso Deshacer que aparece y desaparece, con la zona segura del
 * celular o si el texto de un botón pasa a dos líneas. Para lo que queda pegado abajo: que lo que
 * recibe el foco por teclado quede por encima (WCAG 2.4.11), sin adivinar alturas.
 *
 * UN SOLO ayudante (ronda 1 del plan 12): unifica `usarAltoComoVariable` (el pie de LayoutApp y
 * la BarraDeTotal, que publican su alto como variable CSS) con el `usarAltoObservado` del plan 11
 * (las pantallas de Productos, que usan el alto como `ref`). Devuelve siempre el `ref`; con
 * `variable`, además lo publica.
 *
 * Sin ResizeObserver (p. ej. jsdom) no hay nada que medir: vale 0 y no publica nada (el CSS usa
 * su valor por defecto).
 */
export function usarAltoObservado(
  elemento: Readonly<Ref<HTMLElement | null | undefined>>,
  opciones: OpcionesDeAltoObservado = {},
): Ref<number> {
  const alto = ref(0)
  if (typeof ResizeObserver === 'undefined') return alto

  const raiz = document.documentElement
  const { variable } = opciones
  function medir(el: Element | null | undefined): void {
    alto.value = el ? Math.ceil(el.getBoundingClientRect().height) : 0
    if (variable) raiz.style.setProperty(variable, `${alto.value}px`)
  }

  const observador = new ResizeObserver((entradas) => {
    for (const entrada of entradas) medir(entrada.target)
  })
  const detener = watch(
    elemento,
    (nuevo, anterior) => {
      if (anterior) observador.unobserve(anterior)
      if (nuevo) observador.observe(nuevo)
      medir(nuevo)
    },
    { immediate: true, flush: 'post' },
  )

  onBeforeUnmount(() => {
    detener()
    observador.disconnect()
    if (variable) raiz.style.removeProperty(variable)
  })
  return alto
}
