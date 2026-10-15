import { onBeforeUnmount, watch, type Ref } from 'vue'

/**
 * m5 (ronda 4): publica en <html> (variable CSS `variable`) el alto REAL de `elemento`, medido
 * con ResizeObserver, y lo mantiene al día: cambia con el tamaño de letra, con el aviso
 * Deshacer que aparece y desaparece, con la zona segura del celular… Así LayoutApp puede usarlo
 * en `scroll-padding-bottom` y el foco por teclado nunca queda tapado por la barra pegada abajo
 * (WCAG 2.4.11), sin adivinar alturas. Vale 0px mientras el elemento no exista y se quita al
 * desmontar.
 */
export function usarAltoComoVariable(
  elemento: Readonly<Ref<HTMLElement | null | undefined>>,
  variable: `--${string}`,
): void {
  const raiz = document.documentElement
  const publicar = (el: Element | null | undefined) => {
    const alto = el ? Math.ceil(el.getBoundingClientRect().height) : 0
    raiz.style.setProperty(variable, `${alto}px`)
  }

  // Sin ResizeObserver (p. ej. jsdom) no hay nada que medir: el CSS usa su valor por defecto.
  if (typeof ResizeObserver === 'undefined') return

  const observador = new ResizeObserver((entradas) => {
    for (const entrada of entradas) publicar(entrada.target)
  })
  const detener = watch(
    elemento,
    (nuevo, anterior) => {
      if (anterior) observador.unobserve(anterior)
      if (nuevo) observador.observe(nuevo)
      publicar(nuevo)
    },
    { immediate: true, flush: 'post' },
  )

  onBeforeUnmount(() => {
    detener()
    observador.disconnect()
    raiz.style.removeProperty(variable)
  })
}
