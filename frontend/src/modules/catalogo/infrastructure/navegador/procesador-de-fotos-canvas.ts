import { comprimirHasta, dimensionesReducidas } from '../../domain/foto'
import type { ProcesadorDeFotos } from '../../application/puertos'

/**
 * RN-CAT-14: adaptador real sobre `createImageBitmap` + `OffscreenCanvas`. No se prueba en
 * jsdom (no implementa estas APIs de forma fiable); lo cubre Playwright (Ola 4/5).
 */
export class ProcesadorDeFotosCanvas implements ProcesadorDeFotos {
  async reducir(imagen: Blob): Promise<Blob> {
    const bitmap = await createImageBitmap(imagen)
    try {
      const { ancho, alto } = dimensionesReducidas(bitmap.width, bitmap.height)
      const lienzo = new OffscreenCanvas(ancho, alto)
      const contexto = lienzo.getContext('2d')
      if (!contexto) {
        throw new Error('No se pudo obtener el contexto 2D del lienzo para procesar la foto')
      }
      contexto.drawImage(bitmap, 0, 0, ancho, alto)
      return await comprimirHasta((calidad) =>
        lienzo.convertToBlob({ type: 'image/webp', quality: calidad }),
      )
    } finally {
      bitmap.close()
    }
  }
}
