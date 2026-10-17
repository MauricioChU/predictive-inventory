/** U+00A0, el espacio de pegarCifras (escrito así para que se vea en el código). */
const ESPACIO_QUE_NO_CORTA = String.fromCharCode(0xa0)

/**
 * El texto de un elemento como se lee en voz alta: cada trozo de texto separado del siguiente
 * por un espacio (aunque estén en elementos distintos, sin espacio entre ellos en el HTML) y los
 * espacios que no cortan ("S/ 2.00", "2 unid.") como espacios normales.
 */
export function textoLeido(envoltura: { element: Node }): string {
  const nodos = document.createTreeWalker(envoltura.element, NodeFilter.SHOW_TEXT)
  const trozos: string[] = []
  for (let nodo = nodos.nextNode(); nodo; nodo = nodos.nextNode()) {
    const trozo = (nodo.textContent ?? '').replaceAll(ESPACIO_QUE_NO_CORTA, ' ').trim()
    if (trozo) trozos.push(trozo)
  }
  return trozos.join(' ').replace(/\s+/g, ' ')
}
