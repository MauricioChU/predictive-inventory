import { describe, expect, it } from 'vitest'
import { RegistroDePasos } from './registro-de-pasos'

describe('RegistroDePasos', () => {
  it('encuentra pasos con parámetros {string} y texto opcional', () => {
    const pasos = new RegistroDePasos<object>().paso('(que )vendo {string} de {string}', () => {})
    expect(pasos.buscar('vendo "2" de "Lejía 1 L"')?.argumentos).toEqual(['2', 'Lejía 1 L'])
    expect(pasos.buscar('que vendo "2" de "Lejía 1 L"')?.argumentos).toEqual(['2', 'Lejía 1 L'])
    expect(pasos.buscar('compro "2"')).toBeNull()
  })
  it('falla si un texto coincide con dos pasos', () => {
    const pasos = new RegistroDePasos<object>()
      .paso('vendo {string}', () => {})
      .paso('vendo {string}', () => {})
    expect(() => pasos.buscar('vendo "2"')).toThrow('ambiguo')
  })
  it('une registros de varios archivos de pasos', () => {
    const a = new RegistroDePasos<object>().paso('paso a', () => {})
    const b = new RegistroDePasos<object>().paso('paso b', () => {})
    const todos = a.unir(b)
    expect(todos.buscar('paso a')).not.toBeNull()
    expect(todos.buscar('paso b')).not.toBeNull()
  })
})
