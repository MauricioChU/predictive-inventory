/** Foco al título (h1) de la vista en pantalla, o a `#contenido` si no tiene (RN-UX-15). */
export function enfocarTituloDeVista(): void {
  const destino =
    document.querySelector<HTMLElement>('#contenido .cambio-de-vista h1') ??
    document.getElementById('contenido')
  if (!destino) return
  if (!destino.hasAttribute('tabindex')) destino.setAttribute('tabindex', '-1')
  destino.focus({ preventScroll: true })
}
