import type { ProcesadorDeFotosCanvas } from '@/modules/catalogo'

/** Las APIs del navegador que usa el procesador real (createImageBitmap y el lienzo). */
type EntornoDeFotos = NonNullable<ConstructorParameters<typeof ProcesadorDeFotosCanvas>[0]>

/**
 * Cuánto pesa una imagen codificada: bytes por píxel a calidad 1. Modelo simple (a menor
 * calidad, menos bytes), suficiente para que la compresión de RN-CAT-14 tenga que bajar la
 * calidad varias veces antes de llegar a 100 KB con una foto de 512 × 384.
 */
const BYTES_POR_PIXEL_A_CALIDAD_1 = 1
/** Una foto de cámara sin comprimir mucho (≈ 3 MB a 4000 × 3000). */
const BYTES_POR_PIXEL_DE_CAMARA = 0.25

interface Medidas {
  ancho: number
  alto: number
}

/**
 * Una imagen simulada: una primera línea con sus medidas en JSON y relleno hasta `bytes`. Así
 * las medidas sobreviven a cualquier copia del Blob (memoria o IndexedDB) y `size` es real.
 */
function imagenSimulada({ ancho, alto }: Medidas, bytes: number, tipo: string): Blob {
  const cabecera = `${JSON.stringify({ ancho, alto })}\n`
  return new Blob([cabecera, new Uint8Array(Math.max(0, bytes - cabecera.length))], { type: tipo })
}

/** Lo que entrega la cámara del celular: una foto grande. */
export function fotoDeCamara(ancho: number, alto: number): Blob {
  const bytes = Math.round(ancho * alto * BYTES_POR_PIXEL_DE_CAMARA)
  return imagenSimulada({ ancho, alto }, bytes, 'image/jpeg')
}

/** Las medidas en píxeles de una imagen simulada. */
export async function medidasDeFoto(imagen: Blob): Promise<Medidas> {
  const [cabecera = ''] = (await imagen.slice(0, 64).text()).split('\n')
  const medidas = JSON.parse(cabecera) as Partial<Medidas>
  if (typeof medidas.ancho !== 'number' || typeof medidas.alto !== 'number') {
    throw new Error('La imagen no es una imagen simulada')
  }
  return { ancho: medidas.ancho, alto: medidas.alto }
}

/**
 * `createImageBitmap` y el lienzo simulados para `ProcesadorDeFotosCanvas` en Node: decodificar
 * respeta el `resizeWidth`/`resizeHeight` pedido (como el navegador) y codificar produce una
 * imagen de esas medidas con un peso que baja con la calidad. Todo lo demás (cuánto reducir,
 * qué calidades probar, cuándo rendirse) es el código real del procesador y del dominio.
 */
export function entornoDeFotosSimulado(): EntornoDeFotos {
  return {
    async decodificar(imagen, opciones) {
      const { ancho, alto } = await medidasDeFoto(imagen)
      const mapa = {
        width: opciones.resizeWidth ?? ancho,
        height: opciones.resizeHeight ?? alto,
        close: () => undefined,
      }
      return mapa as unknown as ImageBitmap
    },
    crearLienzo(ancho, alto) {
      return {
        contexto: {
          imageSmoothingQuality: 'low',
          fillStyle: '#000000',
          fillRect: () => undefined,
          drawImage: () => undefined,
        },
        async codificar(tipo, calidad) {
          const bytes = Math.round(ancho * alto * calidad * BYTES_POR_PIXEL_A_CALIDAD_1)
          return imagenSimulada({ ancho, alto }, bytes, tipo)
        },
      }
    },
  }
}
