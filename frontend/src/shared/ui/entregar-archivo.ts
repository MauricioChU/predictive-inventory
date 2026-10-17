/** Un archivo que la app generó (la copia, el Excel, la plantilla) para dárselo a la persona. */
export interface ArchivoParaEntregar {
  nombre: string
  tipo: string
  contenido: Blob
}

/** `cancelado`: cerró el menú de compartir sin elegir nada (no salió ningún archivo). */
export type Entrega = 'compartido' | 'descargado' | 'cancelado'

/**
 * El menú de compartir del celular (Web Share) acepta ESTE archivo. Chrome para Android solo
 * comparte algunos tipos de archivo; si no está entre ellos, la app lo descarga.
 */
export function sePuedeCompartir(archivo: Pick<ArchivoParaEntregar, 'nombre' | 'tipo'>): boolean {
  if (typeof navigator.share !== 'function' || typeof navigator.canShare !== 'function') {
    return false
  }
  try {
    return navigator.canShare({ files: [new File([], archivo.nombre, { type: archivo.tipo })] })
  } catch {
    return false
  }
}

function descargar(archivo: ArchivoParaEntregar): void {
  const url = URL.createObjectURL(archivo.contenido)
  const enlace = document.createElement('a')
  enlace.href = url
  enlace.download = archivo.nombre
  enlace.hidden = true
  document.body.append(enlace)
  enlace.click()
  enlace.remove()
  // Un momento después: algunos navegadores todavía leen el archivo al empezar la descarga.
  setTimeout(() => URL.revokeObjectURL(url), 60_000)
}

/**
 * RN-RE-01/02: entrega un archivo. Con `compartir` (por defecto) abre el menú de compartir del
 * celular (WhatsApp, Drive, correo) si acepta el archivo; si no, o si compartir falla por otra
 * cosa que la persona cancelando, lo descarga. Con `descargar`, lo descarga siempre.
 */
export async function entregarArchivo(
  archivo: ArchivoParaEntregar,
  modo: 'compartir' | 'descargar' = 'compartir',
): Promise<Entrega> {
  if (modo === 'compartir' && sePuedeCompartir(archivo)) {
    const fichero = new File([archivo.contenido], archivo.nombre, { type: archivo.tipo })
    try {
      await navigator.share({ files: [fichero], title: archivo.nombre })
      return 'compartido'
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return 'cancelado'
      console.warn('No se pudo compartir el archivo; se descarga:', error)
    }
  }
  descargar(archivo)
  return 'descargado'
}
