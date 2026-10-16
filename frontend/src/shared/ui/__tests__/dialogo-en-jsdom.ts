/**
 * jsdom no implementa `<dialog>.showModal()` ni `close()` (DialogoConfirmacion los usa): lo
 * mínimo para que un diálogo se abra y se cierre en las pruebas. Idempotente.
 */
export function prepararDialogos(): void {
  HTMLDialogElement.prototype.showModal ??= function (this: HTMLDialogElement) {
    this.setAttribute('open', '')
  }
  HTMLDialogElement.prototype.close ??= function (this: HTMLDialogElement) {
    this.removeAttribute('open')
  }
}
