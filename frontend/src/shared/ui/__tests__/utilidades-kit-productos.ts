import { vi, type Mock } from 'vitest'

/**
 * jsdom no implementa `URL.createObjectURL` ni `URL.revokeObjectURL`: los reemplaza por
 * dobles que devuelven `blob:prueba-1`, `blob:prueba-2`… en orden. `restaurar` deja URL como
 * estaba.
 */
export function simularUrlsDeObjeto(): {
  crear: Mock<(objeto: Blob) => string>
  revocar: Mock<(url: string) => void>
  restaurar: () => void
} {
  const original = { crear: URL.createObjectURL, revocar: URL.revokeObjectURL }
  let siguiente = 0
  const crear = vi.fn((_objeto: Blob) => {
    siguiente += 1
    return `blob:prueba-${siguiente}`
  })
  const revocar = vi.fn((_url: string) => {})
  URL.createObjectURL = crear
  URL.revokeObjectURL = revocar
  return {
    crear,
    revocar,
    restaurar() {
      URL.createObjectURL = original.crear
      URL.revokeObjectURL = original.revocar
    },
  }
}

/** Texto (con espacios normalizados) de los elementos cuyos ids lista `atributo` de `el`
 * (aria-labelledby / aria-describedby), como lo arma un lector de pantalla. jsdom no calcula
 * nombres accesibles; la E2E lo verifica además en Chromium con getByRole. */
export function textoReferido(
  el: Element,
  atributo: 'aria-labelledby' | 'aria-describedby',
): string {
  const ids = (el.getAttribute(atributo) ?? '').split(/\s+/).filter(Boolean)
  // Sin attachTo el componente no está en el documento: se busca desde su raíz.
  let raiz: Element = el
  while (raiz.parentElement) raiz = raiz.parentElement
  return ids
    .map((id) => {
      const referido = el.ownerDocument.getElementById(id) ?? raiz.querySelector(`[id="${id}"]`)
      if (!referido) throw new Error(`${atributo} apunta a #${id}, que no existe`)
      return referido.textContent ?? ''
    })
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Crea un File con `files` asignado a un <input type="file"> (jsdom no deja escribirlo). */
export function elegirArchivo(input: HTMLInputElement, archivo: File | null): void {
  Object.defineProperty(input, 'files', {
    configurable: true,
    value: archivo ? [archivo] : [],
  })
}
