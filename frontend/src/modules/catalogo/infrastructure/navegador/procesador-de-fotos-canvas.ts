import { ErrorDeDominio, esErrorDeDominio } from '@/shared/domain/errores'
import type { ProcesadorDeFotos } from '../../application/puertos'
import { comprimirHasta, dimensionesReducidas } from '../../domain/foto'

export type TipoDeImagen = 'image/webp' | 'image/jpeg'

/** Lo que se usa del contexto 2D (lo tienen OffscreenCanvas y <canvas>). */
export type Contexto2D = Pick<
  CanvasRenderingContext2D,
  'imageSmoothingQuality' | 'fillStyle' | 'fillRect' | 'drawImage'
>

export interface Lienzo {
  contexto: Contexto2D | null
  codificar(tipo: TipoDeImagen, calidad: number): Promise<Blob>
}

/** Las APIs del navegador que usa el procesador (se reemplazan en las pruebas). */
export interface EntornoDeFotos {
  decodificar(imagen: Blob, opciones: ImageBitmapOptions): Promise<ImageBitmap>
  crearLienzo(ancho: number, alto: number): Lienzo
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

const ENTORNO_DEL_NAVEGADOR: EntornoDeFotos = {
  decodificar: (imagen, opciones) => createImageBitmap(imagen, opciones),
  crearLienzo,
}

/**
 * Ola 3 (revisión de la Ola 2): el soporte de WebP se averigua UNA vez por sesión (por entorno:
 * el del navegador es uno solo), con un lienzo de 1 × 1. Algunos navegadores no codifican WebP
 * y devuelven PNG: entonces se usa JPEG. Si la prueba falla, también JPEG.
 */
const formatoPorEntorno = new WeakMap<EntornoDeFotos, Promise<TipoDeImagen>>()

function formatoDeSalida(entorno: EntornoDeFotos): Promise<TipoDeImagen> {
  let formato = formatoPorEntorno.get(entorno)
  if (!formato) {
    formato = entorno
      .crearLienzo(1, 1)
      .codificar('image/webp', 0.85)
      .then(
        (prueba): TipoDeImagen => (prueba.type === 'image/webp' ? 'image/webp' : 'image/jpeg'),
        (): TipoDeImagen => 'image/jpeg',
      )
    formatoPorEntorno.set(entorno, formato)
  }
  return formato
}

const fotoInvalida = () =>
  new ErrorDeDominio('FOTO_INVALIDA', 'No pudimos leer la foto. Prueba con otra.')

/**
 * RN-CAT-14: adaptador real sobre `createImageBitmap` + canvas. En las pruebas se le da un
 * `EntornoDeFotos` simulado (jsdom no implementa estas APIs); el real lo cubre Playwright.
 */
export class ProcesadorDeFotosCanvas implements ProcesadorDeFotos {
  constructor(private readonly entorno: EntornoDeFotos = ENTORNO_DEL_NAVEGADOR) {}

  async reducir(imagen: Blob): Promise<Blob> {
    const bitmap = await this.decodificarReducida(imagen)
    try {
      const tipo = await formatoDeSalida(this.entorno)
      const lienzo = this.entorno.crearLienzo(bitmap.width, bitmap.height)
      if (!lienzo.contexto) throw fotoInvalida()
      if (tipo === 'image/jpeg') {
        // JPEG no tiene transparencia: sin fondo, lo transparente saldría negro.
        lienzo.contexto.fillStyle = '#ffffff'
        lienzo.contexto.fillRect(0, 0, bitmap.width, bitmap.height)
      }
      lienzo.contexto.imageSmoothingQuality = 'high'
      lienzo.contexto.drawImage(bitmap, 0, 0, bitmap.width, bitmap.height)
      return await comprimirHasta((calidad) => lienzo.codificar(tipo, calidad))
    } catch (error) {
      // FOTO_PESADA (o FOTO_INVALIDA) pasan tal cual; un fallo al dibujar o codificar, también
      // es una foto que no pudimos leer, nunca un error técnico.
      if (esErrorDeDominio(error)) throw error
      throw fotoInvalida()
    } finally {
      bitmap.close()
    }
  }

  /** Lee el tamaño (ya con la orientación EXIF) y decodifica ya reducida a ≤ 512 px. */
  private async decodificarReducida(imagen: Blob): Promise<ImageBitmap> {
    const opciones = { imageOrientation: 'from-image' } as const
    try {
      const sonda = await this.entorno.decodificar(imagen, opciones)
      const { ancho, alto } = dimensionesReducidas(sonda.width, sonda.height)
      if (ancho === sonda.width && alto === sonda.height) return sonda
      sonda.close()
      return await this.entorno.decodificar(imagen, {
        ...opciones,
        resizeWidth: ancho,
        resizeHeight: alto,
        resizeQuality: 'high',
      })
    } catch {
      throw fotoInvalida()
    }
  }
}
