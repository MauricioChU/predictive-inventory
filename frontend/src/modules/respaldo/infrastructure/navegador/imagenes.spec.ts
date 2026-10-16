import { describe, expect, it } from 'vitest'
import { base64ABlob, blobABase64 } from './imagenes'

describe('blobABase64 / base64ABlob', () => {
  it('ida y vuelta conserva los bytes y el tipo', async () => {
    const bytes = new Uint8Array([0, 1, 2, 250, 251, 252, 253, 254, 255, 65, 66, 67])
    const original = new Blob([bytes], { type: 'image/jpeg' })

    const base64 = await blobABase64(original)
    expect(typeof base64).toBe('string')

    const reconstruido = await base64ABlob(base64, 'image/jpeg')
    expect(reconstruido.type).toBe('image/jpeg')

    const bytesReconstruidos = new Uint8Array(await reconstruido.arrayBuffer())
    expect([...bytesReconstruidos]).toEqual([...bytes])
  })

  it('funciona con un Blob vacío', async () => {
    const base64 = await blobABase64(new Blob([], { type: 'image/png' }))
    const reconstruido = await base64ABlob(base64, 'image/png')
    expect(reconstruido.size).toBe(0)
  })
})
