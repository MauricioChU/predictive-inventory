import { vi } from 'vitest'

/** Lo que la pantalla descargó (con `<a download>`): nombre y contenido. */
export interface Descarga {
  nombre: string
  contenido: Blob
}

/**
 * Plan 14: jsdom no descarga ni crea URLs de Blob. Captura cada descarga que hace
 * `entregarArchivo` (src/shared/ui/entregar-archivo.ts). Llamar en un beforeEach y deshacer con
 * `vi.restoreAllMocks()`.
 */
export function capturarDescargas(): Descarga[] {
  const descargas: Descarga[] = []
  const blobs = new Map<string, Blob>()
  let siguiente = 0
  URL.createObjectURL = vi.fn((contenido: Blob | MediaSource) => {
    siguiente += 1
    const url = `blob:prueba-${siguiente}`
    blobs.set(url, contenido as Blob)
    return url
  })
  URL.revokeObjectURL = vi.fn()
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
    this: HTMLAnchorElement,
  ) {
    const contenido = blobs.get(this.href)
    if (contenido) descargas.push({ nombre: this.download, contenido })
  })
  return descargas
}

type NavegadorConCompartir = Navigator & {
  canShare?: (datos: ShareData) => boolean
  share?: (datos: ShareData) => Promise<void>
}

/** Un celular con menú de compartir (Web Share) que hace `compartir` al abrirse. */
export function simularMenuDeCompartir(compartir: (datos: ShareData) => Promise<void>): void {
  const navegador = navigator as NavegadorConCompartir
  navegador.canShare = () => true
  navegador.share = vi.fn(compartir)
}

export function quitarMenuDeCompartir(): void {
  const navegador = navigator as NavegadorConCompartir
  Reflect.deleteProperty(navegador, 'canShare')
  Reflect.deleteProperty(navegador, 'share')
}

/** El texto de un Blob (el de jsdom no tiene `.text()`). */
export function leerTexto(contenido: Blob): Promise<string> {
  return new Promise((resolver, rechazar) => {
    const lector = new FileReader()
    lector.onload = () => resolver(String(lector.result))
    lector.onerror = () => rechazar(lector.error)
    lector.readAsText(contenido)
  })
}

/** Elige `archivo` en el `<input type="file">` de la pantalla (jsdom no deja escribir `files`). */
export async function elegirArchivo(input: HTMLInputElement, archivo: File): Promise<void> {
  Object.defineProperty(input, 'files', { value: [archivo], configurable: true })
  input.dispatchEvent(new Event('change'))
}
