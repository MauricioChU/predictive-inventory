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
  let terminado = false
  const terminar = (): void => {
    if (terminado) return
    terminado = true
    alTerminar()
  }
  const animaciones =
    elemento && typeof elemento.getAnimations === 'function' ? elemento.getAnimations() : []
  if (animaciones.length === 0) {
    terminar()
    return
  }
  void Promise.all(animaciones.map((a) => a.finished)).then(terminar, terminar)
  // Respaldo: nunca queda a medio cerrar.
  setTimeout(terminar, 1000)
}
