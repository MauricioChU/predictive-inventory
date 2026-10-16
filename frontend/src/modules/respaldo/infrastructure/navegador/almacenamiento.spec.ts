import { afterEach, describe, expect, it, vi } from 'vitest'
import { AlmacenamientoPersistenteDelNavegador } from './almacenamiento'

describe('AlmacenamientoPersistenteDelNavegador', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('RN-RE-09: devuelve lo que responde navigator.storage.persist()', async () => {
    vi.stubGlobal('navigator', { storage: { persist: async () => true } })
    expect(await new AlmacenamientoPersistenteDelNavegador().solicitar()).toBe(true)
  })

  it('RN-RE-09: sin soporte devuelve false', async () => {
    vi.stubGlobal('navigator', {})
    expect(await new AlmacenamientoPersistenteDelNavegador().solicitar()).toBe(false)
  })

  it('RN-RE-09: si persist() falla, se toma como no concedido', async () => {
    vi.stubGlobal('navigator', {
      storage: {
        persist: async () => {
          throw new Error('no permitido')
        },
      },
    })
    expect(await new AlmacenamientoPersistenteDelNavegador().solicitar()).toBe(false)
  })
})
