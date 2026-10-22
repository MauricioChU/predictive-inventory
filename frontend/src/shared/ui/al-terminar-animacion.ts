/**
 * Espera a que termine la animación de un elemento (p. ej. la hoja con `hoja-sale` de
 * base.css, ya puesta por el componente) y avisa, para quitarla recién entonces. La clase la
 * pone el propio componente con su `:class`: si se agregara a mano, Vue la borraría al volver a
 * pintar. Con "reducir movimiento" la animación dura casi 0. Sin animaciones (p. ej. jsdom) o si
 * no terminan a tiempo, avisa igual.
 */
export function alTerminarAnimacion(
  elemento: HTMLElement | undefined,
  alTerminar: () => void,
): void {
  const animaciones =
    elemento && typeof elemento.getAnimations === 'function' ? elemento.getAnimations() : []
  if (animaciones.length === 0) {
    alTerminar()
    return
  }
  let terminado = false
  const terminar = (): void => {
    if (terminado) return
    terminado = true
    clearTimeout(respaldo)
    alTerminar()
  }
  // Respaldo: nunca queda a medio cerrar (se limpia si las animaciones terminan antes).
  const respaldo = setTimeout(terminar, 1000)
  void Promise.allSettled(animaciones.map((a) => a.finished)).then(terminar)
}
