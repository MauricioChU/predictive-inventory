import { beforeEach, describe, expect, it } from 'vitest'
import { aplicarTamanoDeLetra, leerTamanoDeLetraGuardado } from '../preferencias/tamano-de-letra'

describe('RN-UX-01: tamaño de letra', () => {
  beforeEach(() => localStorage.clear())
  it('por defecto es Grande', () => {
    expect(leerTamanoDeLetraGuardado()).toBe('GRANDE')
  })
  it('aplica el tamaño al documento y lo recuerda', () => {
    aplicarTamanoDeLetra('MUY_GRANDE')
    expect(document.documentElement.dataset.letra).toBe('MUY_GRANDE')
    expect(leerTamanoDeLetraGuardado()).toBe('MUY_GRANDE')
  })
  it('ignora valores guardados inválidos', () => {
    localStorage.setItem('pi.letra', 'ENORME')
    expect(leerTamanoDeLetraGuardado()).toBe('GRANDE')
  })
})
