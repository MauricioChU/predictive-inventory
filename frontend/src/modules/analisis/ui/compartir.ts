/** Lo que se usa del navegador para compartir (para probarlo sin uno). */
export interface NavegadorParaCompartir {
  share?: (datos: ShareData) => Promise<void>
  canShare?: (datos: ShareData) => boolean
  clipboard?: { writeText: (texto: string) => Promise<void> }
}

/**
 * - compartido: se abrió la hoja de compartir del celular y la persona eligió una app.
 * - cancelado: cerró la hoja sin elegir: no se hace nada más.
 * - copiado: no se pudo abrir la hoja (PC, navegador sin Web Share API) y el texto quedó en el
 *   portapapeles para pegarlo en WhatsApp u otra app.
 * - no-se-pudo: ni compartir ni copiar; la pantalla muestra el texto para copiarlo a mano.
 */
export type ResultadoDeCompartir = 'compartido' | 'cancelado' | 'copiado' | 'no-se-pudo'

function esCancelacion(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError'
}

/** RN-AN-08: la lista como texto, con Web Share API y, si no hay, copiándola al portapapeles. */
export async function compartirTexto(
  texto: string,
  navegador: NavegadorParaCompartir = navigator,
): Promise<ResultadoDeCompartir> {
  const datos: ShareData = { text: texto }
  if (navegador.share && (navegador.canShare?.(datos) ?? true)) {
    try {
      await navegador.share(datos)
      return 'compartido'
    } catch (error) {
      if (esCancelacion(error)) return 'cancelado'
      // Otro motivo (sin permiso, sin gesto del usuario…): se intenta copiar.
    }
  }
  if (!navegador.clipboard) return 'no-se-pudo'
  try {
    await navegador.clipboard.writeText(texto)
    return 'copiado'
  } catch {
    return 'no-se-pudo'
  }
}
