import { describe, expect, it } from 'vitest'
import { ErrorDeDominio, esErrorDeDominio } from './errores'

// No está en el enunciado de la Tarea 2 (que solo pide texto.spec.ts): completa la cobertura
// de errores.ts (RN-SIS-02 exige 95% en el dominio).
describe('ErrorDeDominio', () => {
  it('guarda el código y expone el mensaje exacto que ve el usuario', () => {
    const error = new ErrorDeDominio('ALGO_INVALIDO', 'Mensaje para el usuario')
    expect(error.codigo).toBe('ALGO_INVALIDO')
    expect(error.message).toBe('Mensaje para el usuario')
    expect(error.name).toBe('ErrorDeDominio')
  })
  it('esErrorDeDominio distingue un ErrorDeDominio de otros errores', () => {
    expect(esErrorDeDominio(new ErrorDeDominio('X', 'y'))).toBe(true)
    expect(esErrorDeDominio(new Error('otro error'))).toBe(false)
    expect(esErrorDeDominio('no es un error')).toBe(false)
  })
})
