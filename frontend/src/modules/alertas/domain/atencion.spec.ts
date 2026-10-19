import { describe, expect, it } from 'vitest'
import { textoDeAtencion } from './atencion'

describe('textoDeAtencion (RN-AL-06)', () => {
  it('RN-AL-06: sin nada: Todo bien', () => {
    expect(textoDeAtencion(0, 0)).toBe('Todo bien: no falta nada')
  })
  it('RN-AL-06: 1 agotado y 1 por acabarse', () => {
    expect(textoDeAtencion(1, 1)).toBe('1 agotado y 1 por acabarse')
  })
  it('RN-AL-06: 2 agotados y 3 por acabarse (plural)', () => {
    expect(textoDeAtencion(2, 3)).toBe('2 agotados y 3 por acabarse')
  })
  it('RN-AL-06: solo 1 por acabarse', () => {
    expect(textoDeAtencion(0, 1)).toBe('1 por acabarse')
  })
  it('RN-AL-06: solo 2 agotados', () => {
    expect(textoDeAtencion(2, 0)).toBe('2 agotados')
  })
})
