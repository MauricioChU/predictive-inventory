import { ErrorDeDominio } from '@/shared/domain/errores'
import type { ProcesadorDeFotos } from '../../application/puertos'
import { comprimirHasta, dimensionesReducidas } from '../../domain/foto'

type TipoDeImagen = 'image/webp' | 'image/jpeg'

interface Lienzo {
  contexto: OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D | null
  codificar(tipo: TipoDeImagen, calidad: number): Promise<Blob>
}

function crearLienzo(ancho: number, alto: number): Lienzo {
  if (typeof OffscreenCanvas !== 'undefined') {
    const lienzo = new OffscreenCanvas(ancho, alto)
    return {
      contexto: lienzo.getContext('2d'),
      codificar: (tipo, calidad) => lienzo.convertToBlob({ type: tipo, quality: calidad }),
    }
  }
  // Respaldo para navegadores sin OffscreenCanvas.
  const lienzo = document.createElement('canvas')
  lienzo.width = ancho
  lienzo.height = alto
  return {
    contexto: lienzo.getContext('2d'),
    codificar: (tipo, calidad) =>
      new Promise((resolver, rechazar) =>
        lienzo.toBlob(
          (blob) => (blob ? resolver(blob) : rechazar(new Error('toBlob devolvió null'))),
          tipo,
          calidad,
        ),
      ),
  }
}

const fotoInvalida = () =>
  new ErrorDeDominio('FOTO_INVALIDA', 'No pudimos leer la foto. Prueba con otra.')

/**
 * RN-CAT-14: adaptador real sobre `createImageBitmap` + canvas. No se prueba en jsdom (no
 * implementa estas APIs de forma fiable); lo cubre Playwright (Ola 4/5).
 */
export class ProcesadorDeFotosCanvas implements ProcesadorDeFotos {
  async reducir(imagen: Blob): Promise<Blob> {
    const opciones = { imageOrientation: 'from-image' } as const
    let bitmap: ImageBitmap
    try {
      // Se lee el tamaño (ya con la orientación EXIF) para decodificar luego ya reducida.
      const sonda = await createImageBitmap(imagen, opciones)
      const { ancho, alto } = dimensionesReducidas(sonda.width, sonda.height)
      const cambia = ancho !== sonda.width || alto !== sonda.height
      if (cambia) {
        sonda.close()
        bitmap = await createImageBitmap(imagen, {
          ...opciones,
          resizeWidth: ancho,
          resizeHeight: alto,
          resizeQuality: 'high',
        })
      } else {
        bitmap = sonda
      }
    } catch {
      throw fotoInvalida()
    }

    try {
      const lienzo = crearLienzo(bitmap.width, bitmap.height)
      if (!lienzo.contexto) throw fotoInvalida()
      lienzo.contexto.imageSmoothingQuality = 'high'
      lienzo.contexto.drawImage(bitmap, 0, 0, bitmap.width, bitmap.height)

      // Algunos navegadores no codifican WebP y devuelven PNG: en ese caso se usa JPEG.
      const prueba = await lienzo.codificar('image/webp', 0.85)
      const tipo: TipoDeImagen = prueba.type === 'image/webp' ? 'image/webp' : 'image/jpeg'
      return await comprimirHasta((calidad) => lienzo.codificar(tipo, calidad))
    } finally {
      bitmap.close()
    }
  }
}
