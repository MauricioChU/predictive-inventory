/**
 * Cierra una hoja con su animación de salida (`hoja-sale` de base.css) y avisa al terminar,
 * para quitarla recién entonces. Con "reducir movimiento" la animación dura casi 0 y se cierra
 * al instante. Sin animaciones (p. ej. jsdom) o si el evento no llega, cierra igual a tiempo.
 */
export function animarSalidaDeHoja(hoja: HTMLElement | undefined, alTerminar: () => void): void {
  if (!hoja || typeof hoja.getAnimations !== 'function') {
    alTerminar()
    return
  }
  let terminado = false
  const terminar = (): void => {
    if (terminado) return
    terminado = true
    hoja.classList.remove('hoja-sale')
    alTerminar()
  }
  hoja.classList.remove('hoja-entra')
  hoja.classList.add('hoja-sale')
  const animaciones = hoja.getAnimations()
  if (animaciones.length === 0) {
    terminar()
    return
  }
  void Promise.all(animaciones.map((a) => a.finished)).then(terminar, terminar)
  // Respaldo: nunca queda a medio cerrar.
  setTimeout(terminar, 1000)
}
