/**
 * jsdom no implementa `<dialog>.showModal()` ni `close()` (DialogoConfirmacion los usa). UN SOLO
 * doble para todas las pruebas (ronda 1 del plan 12: antes había tres): abre y cierra con el
 * atributo `open` y, como el navegador, avisa `close` al cerrarse. Se instala siempre (no solo
 * si falta): cualquier pantalla puede llevar a otra con un diálogo, y un `close` sin simular
 * deja una promesa rechazada que hace fallar Vitest aunque todas las pruebas pasen.
 */
export function simularDialogos(): void {
  const prototipo = HTMLDialogElement.prototype
  prototipo.showModal = function (this: HTMLDialogElement) {
    this.setAttribute('open', '')
  }
  prototipo.close = function (this: HTMLDialogElement) {
    if (!this.hasAttribute('open')) return
    this.removeAttribute('open')
    this.dispatchEvent(new Event('close'))
  }
}
