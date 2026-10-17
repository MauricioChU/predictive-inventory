import { describe, expect, it, vi } from 'vitest'
import {
  ProcesadorDeFotosCanvas,
  type Contexto2D,
  type EntornoDeFotos,
  type Lienzo,
  type TipoDeImagen,
} from './procesador-de-fotos-canvas'

const FOTO_INVALIDA = 'No pudimos leer la foto. Prueba con otra.'

/** Un navegador simulado: anota lo que se dibuja y lo que se codifica, en orden. */
function navegador(opciones: {
  ancho?: number
  alto?: number
  /** Qué tipo devuelve el navegador al pedirle WebP (sin soporte: PNG). */
  webp?: 'image/webp' | 'image/png'
  bytes?: number
  dibujarFalla?: boolean
  codificarFalla?: boolean
}) {
  const { ancho = 1024, alto = 768, webp = 'image/webp', bytes = 50_000 } = opciones
  const bitacora: string[] = []
  const cerradas: string[] = []
  const imagen = (nombre: string, w: number, h: number) =>
    ({
      width: w,
      height: h,
      close: () => {
        cerradas.push(nombre)
      },
    }) as unknown as ImageBitmap

  const entorno: EntornoDeFotos = {
    decodificar: vi.fn(async (_blob: Blob, ajustes: ImageBitmapOptions) =>
      ajustes.resizeWidth === undefined
        ? imagen('sonda', ancho, alto)
        : imagen('reducida', ajustes.resizeWidth, ajustes.resizeHeight ?? 0),
    ),
    crearLienzo: vi.fn((w: number, h: number): Lienzo => {
      const contexto: Contexto2D = {
        imageSmoothingQuality: 'low',
        fillStyle: '#000000',
        fillRect: (x: number, y: number, fw: number, fh: number) => {
          bitacora.push(`fondo ${String(contexto.fillStyle)} ${x},${y},${fw},${fh}`)
        },
        drawImage: ((_img: ImageBitmap, x: number, y: number, dw: number, dh: number) => {
          if (opciones.dibujarFalla) throw new Error('drawImage falló')
          bitacora.push(`dibujar ${x},${y},${dw},${dh}`)
        }) as Contexto2D['drawImage'],
      }
      return {
        contexto,
        codificar: async (tipo: TipoDeImagen, calidad: number) => {
          bitacora.push(`codificar ${w}x${h} ${tipo} ${calidad}`)
          if (opciones.codificarFalla && w > 1) throw new Error('convertToBlob falló')
          const devuelto = tipo === 'image/webp' ? webp : tipo
          return new Blob([new Uint8Array(w > 1 ? bytes : 1)], { type: devuelto })
        },
      }
    }),
  }
  return { entorno, bitacora, cerradas }
}

describe('ProcesadorDeFotosCanvas', () => {
  it('RN-CAT-14: reduce a 512 px y, si el navegador codifica WebP, la guarda en WebP', async () => {
    const { entorno, bitacora, cerradas } = navegador({})
    const foto = await new ProcesadorDeFotosCanvas(entorno).reducir(new Blob(['x']))
    expect(foto.type).toBe('image/webp')
    expect(bitacora).toEqual([
      'codificar 1x1 image/webp 0.85',
      'dibujar 0,0,512,384',
      'codificar 512x384 image/webp 0.85',
    ])
    expect(cerradas).toEqual(['sonda', 'reducida'])
  })

  // Ola 3 (revisión de la Ola 2): JPEG no tiene transparencia; sin fondo, una foto con zonas
  // transparentes (p. ej. un PNG) saldría con negro.
  it('RN-CAT-14: sin WebP la codifica en JPEG y pinta el fondo blanco antes de dibujar', async () => {
    const { entorno, bitacora } = navegador({ webp: 'image/png', ancho: 300, alto: 200 })
    const foto = await new ProcesadorDeFotosCanvas(entorno).reducir(new Blob(['x']))
    expect(foto.type).toBe('image/jpeg')
    expect(bitacora).toEqual([
      'codificar 1x1 image/webp 0.85',
      'fondo #ffffff 0,0,300,200',
      'dibujar 0,0,300,200',
      'codificar 300x200 image/jpeg 0.85',
    ])
  })

  it('RN-CAT-14: el soporte de WebP se averigua una sola vez por sesión', async () => {
    const { entorno, bitacora } = navegador({ webp: 'image/png' })
    const procesador = new ProcesadorDeFotosCanvas(entorno)
    await Promise.all([procesador.reducir(new Blob(['a'])), procesador.reducir(new Blob(['b']))])
    await new ProcesadorDeFotosCanvas(entorno).reducir(new Blob(['c']))
    expect(bitacora.filter((linea) => linea.startsWith('codificar 1x1'))).toHaveLength(1)
    expect(bitacora.filter((linea) => linea.startsWith('fondo'))).toHaveLength(3)
  })

  it('RN-CAT-14: si averiguar el soporte de WebP falla, usa JPEG', async () => {
    const { entorno } = navegador({})
    const crear = entorno.crearLienzo
    entorno.crearLienzo = (w, h) => {
      const lienzo = crear(w, h)
      if (w > 1) return lienzo
      return { ...lienzo, codificar: () => Promise.reject(new Error('sin soporte')) }
    }
    const foto = await new ProcesadorDeFotosCanvas(entorno).reducir(new Blob(['x']))
    expect(foto.type).toBe('image/jpeg')
  })

  it('RN-CAT-14: una imagen que no se puede decodificar: "No pudimos leer la foto"', async () => {
    const { entorno } = navegador({})
    entorno.decodificar = () => Promise.reject(new DOMException('ilegible', 'InvalidStateError'))
    await expect(new ProcesadorDeFotosCanvas(entorno).reducir(new Blob(['x']))).rejects.toThrow(
      FOTO_INVALIDA,
    )
  })

  it('RN-CAT-14: un error al dibujar también es FOTO_INVALIDA (no un error técnico)', async () => {
    const { entorno, cerradas } = navegador({ dibujarFalla: true })
    await expect(
      new ProcesadorDeFotosCanvas(entorno).reducir(new Blob(['x'])),
    ).rejects.toMatchObject({ codigo: 'FOTO_INVALIDA', message: FOTO_INVALIDA })
    expect(cerradas).toEqual(['sonda', 'reducida'])
  })

  it('RN-CAT-14: un error al codificar también es FOTO_INVALIDA', async () => {
    const { entorno } = navegador({ codificarFalla: true })
    await expect(
      new ProcesadorDeFotosCanvas(entorno).reducir(new Blob(['x'])),
    ).rejects.toMatchObject({ codigo: 'FOTO_INVALIDA', message: FOTO_INVALIDA })
  })

  it('RN-CAT-14: sin contexto 2D, FOTO_INVALIDA', async () => {
    const { entorno } = navegador({})
    const crear = entorno.crearLienzo
    entorno.crearLienzo = (w, h) => ({ ...crear(w, h), contexto: null })
    await expect(new ProcesadorDeFotosCanvas(entorno).reducir(new Blob(['x']))).rejects.toThrow(
      FOTO_INVALIDA,
    )
  })

  it('RN-CAT-14: si ninguna calidad baja de 100 KB, sigue siendo FOTO_PESADA', async () => {
    const { entorno } = navegador({ bytes: 200_000 })
    await expect(
      new ProcesadorDeFotosCanvas(entorno).reducir(new Blob(['x'])),
    ).rejects.toMatchObject({ codigo: 'FOTO_PESADA' })
  })

  it('RN-CAT-14: en un navegador sin las APIs de imagen (jsdom), FOTO_INVALIDA', async () => {
    await expect(new ProcesadorDeFotosCanvas().reducir(new Blob(['x']))).rejects.toThrow(
      FOTO_INVALIDA,
    )
  })
})
