import { describe, expect, it } from 'vitest'
import { esErrorDeDominio } from '@/shared/domain/errores'
import { comprimirHasta, dimensionesReducidas } from './foto'

describe('dimensionesReducidas (RN-CAT-14)', () => {
  it('reduce una foto apaisada a 512 px en el lado mayor', () => {
    expect(dimensionesReducidas(4000, 3000, 512)).toEqual({ ancho: 512, alto: 384 })
  })
  it('reduce una foto en retrato a 512 px en el lado mayor', () => {
    expect(dimensionesReducidas(3000, 4000, 512)).toEqual({ ancho: 384, alto: 512 })
  })
  it('no agranda una foto ya chica', () => {
    expect(dimensionesReducidas(300, 200, 512)).toEqual({ ancho: 300, alto: 200 })
  })
  it('el máximo por defecto es 512 px', () => {
    expect(dimensionesReducidas(4000, 3000)).toEqual({ ancho: 512, alto: 384 })
  })
})

function blobDe(bytes: number): Blob {
  return new Blob([new Uint8Array(bytes)])
}

describe('comprimirHasta (RN-CAT-14)', () => {
  it('devuelve la primera compresión que pesa como máximo el límite', async () => {
    const tamanos = [300_000, 150_000, 90_000]
    const calidadesUsadas: number[] = []
    const codificar = async (calidad: number): Promise<Blob> => {
      calidadesUsadas.push(calidad)
      return blobDe(tamanos[calidadesUsadas.length - 1]!)
    }
    const resultado = await comprimirHasta(codificar, 100_000)
    expect(resultado.size).toBe(90_000)
    expect(calidadesUsadas).toEqual([0.85, 0.75, 0.65])
  })
  it('usa 102 400 bytes (100 KB) como límite por defecto', async () => {
    const codificar = async (): Promise<Blob> => blobDe(100_000)
    const resultado = await comprimirHasta(codificar)
    expect(resultado.size).toBe(100_000)
  })
  it('lanza FOTO_PESADA si ninguna calidad llega al límite', async () => {
    const codificar = async (): Promise<Blob> => blobDe(200_000)
    let error: unknown
    try {
      await comprimirHasta(codificar, 100_000)
    } catch (e) {
      error = e
    }
    expect(esErrorDeDominio(error)).toBe(true)
    expect((error as Error).message).toBe('No pudimos achicar la foto. Prueba con otra.')
  })
  it('prueba las calidades en orden decreciente: 0.85, 0.75, 0.65, 0.55, 0.45, 0.35', async () => {
    const calidadesUsadas: number[] = []
    const codificar = async (calidad: number): Promise<Blob> => {
      calidadesUsadas.push(calidad)
      return blobDe(200_000)
    }
    await expect(comprimirHasta(codificar, 100_000)).rejects.toThrow()
    expect(calidadesUsadas).toEqual([0.85, 0.75, 0.65, 0.55, 0.45, 0.35])
  })
})
