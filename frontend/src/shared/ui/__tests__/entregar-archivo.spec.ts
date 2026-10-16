import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { entregarArchivo, sePuedeCompartir } from '../entregar-archivo'

const COPIA = {
  nombre: 'respaldo-bodega-rosita-2026-10-15-2030.json',
  tipo: 'application/json',
  contenido: new Blob(['{}'], { type: 'application/json' }),
}

type NavegadorConCompartir = Navigator & {
  canShare?: (datos: ShareData) => boolean
  share?: (datos: ShareData) => Promise<void>
}

function simularCompartir(compartir: (datos: ShareData) => Promise<void>, puede = true) {
  const navegador = navigator as NavegadorConCompartir
  navegador.canShare = vi.fn(() => puede)
  navegador.share = vi.fn(compartir)
  return navegador
}

describe('entregarArchivo (RN-RE-01/02: compartir o descargar)', () => {
  let descargas: { nombre: string; href: string }[]

  beforeEach(() => {
    descargas = []
    URL.createObjectURL = vi.fn(() => 'blob:copia')
    URL.revokeObjectURL = vi.fn()
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
      this: HTMLAnchorElement,
    ) {
      descargas.push({ nombre: this.download, href: this.href })
    })
  })

  afterEach(() => {
    const navegador = navigator as NavegadorConCompartir
    delete navegador.canShare
    delete navegador.share
    vi.restoreAllMocks()
  })

  it('sin Web Share descarga el archivo con su nombre', async () => {
    expect(sePuedeCompartir(COPIA)).toBe(false)

    expect(await entregarArchivo(COPIA)).toBe('descargado')
    expect(descargas).toEqual([{ nombre: COPIA.nombre, href: 'blob:copia' }])
  })

  it('con Web Share lo comparte (WhatsApp, Drive, correo) como archivo', async () => {
    const navegador = simularCompartir(async () => undefined)

    expect(await entregarArchivo(COPIA)).toBe('compartido')
    const datos = vi.mocked(navegador.share!).mock.calls[0]![0]
    expect(datos.files?.[0]?.name).toBe(COPIA.nombre)
    expect(descargas).toEqual([])
  })

  it('si la persona cierra el menú de compartir, no se entregó nada', async () => {
    simularCompartir(async () => {
      throw new DOMException('Cancelado', 'AbortError')
    })

    expect(await entregarArchivo(COPIA)).toBe('cancelado')
    expect(descargas).toEqual([])
  })

  it('si compartir falla por otra cosa, lo descarga', async () => {
    simularCompartir(async () => {
      throw new DOMException('Sin permiso', 'NotAllowedError')
    })

    expect(await entregarArchivo(COPIA)).toBe('descargado')
    expect(descargas).toHaveLength(1)
  })

  it('el navegador no comparte ese tipo de archivo: lo descarga', async () => {
    simularCompartir(async () => undefined, false)

    expect(sePuedeCompartir(COPIA)).toBe(false)
    expect(await entregarArchivo(COPIA)).toBe('descargado')
  })

  it('"descargar" descarga aunque se pueda compartir', async () => {
    const navegador = simularCompartir(async () => undefined)

    expect(await entregarArchivo(COPIA, 'descargar')).toBe('descargado')
    expect(navegador.share).not.toHaveBeenCalled()
  })
})
