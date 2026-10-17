import { describe, expect, it, vi } from 'vitest'
import { compartirTexto, type NavegadorParaCompartir } from '../compartir'

const TEXTO = 'Lista de compras – Bodega Rosita – 15/10/2026\n• Lejía 1 L: 12 unid.'

function rechazo(nombre: string) {
  return Promise.reject(new DOMException('no', nombre))
}

describe('RN-AN-08: compartir la lista como texto', () => {
  it('con Web Share API abre la hoja de compartir del celular (WhatsApp u otra app)', async () => {
    const share = vi.fn(() => Promise.resolve())
    const writeText = vi.fn(() => Promise.resolve())
    const resultado = await compartirTexto(TEXTO, { share, clipboard: { writeText } })
    expect(resultado).toBe('compartido')
    expect(share).toHaveBeenCalledWith({ text: TEXTO })
    expect(writeText).not.toHaveBeenCalled()
  })

  it('si la persona cierra la hoja de compartir, no hace nada más', async () => {
    const writeText = vi.fn(() => Promise.resolve())
    const nav: NavegadorParaCompartir = {
      share: () => rechazo('AbortError'),
      clipboard: { writeText },
    }
    expect(await compartirTexto(TEXTO, nav)).toBe('cancelado')
    expect(writeText).not.toHaveBeenCalled()
  })

  it('sin Web Share API, copia el texto al portapapeles', async () => {
    const writeText = vi.fn(() => Promise.resolve())
    expect(await compartirTexto(TEXTO, { clipboard: { writeText } })).toBe('copiado')
    expect(writeText).toHaveBeenCalledWith(TEXTO)
  })

  it('si el navegador dice que no puede compartir ese texto, también copia', async () => {
    const share = vi.fn(() => Promise.resolve())
    const writeText = vi.fn(() => Promise.resolve())
    const nav = { share, canShare: () => false, clipboard: { writeText } }
    expect(await compartirTexto(TEXTO, nav)).toBe('copiado')
    expect(share).not.toHaveBeenCalled()
  })

  it('si compartir falla por otra razón (p. ej. sin permiso), copia', async () => {
    const writeText = vi.fn(() => Promise.resolve())
    const nav = { share: () => rechazo('NotAllowedError'), clipboard: { writeText } }
    expect(await compartirTexto(TEXTO, nav)).toBe('copiado')
  })

  it('si tampoco se puede copiar, lo dice (la pantalla muestra el texto para copiarlo a mano)', async () => {
    expect(await compartirTexto(TEXTO, {})).toBe('no-se-pudo')
    const nav = { clipboard: { writeText: () => rechazo('NotAllowedError') } }
    expect(await compartirTexto(TEXTO, nav)).toBe('no-se-pudo')
  })
})
