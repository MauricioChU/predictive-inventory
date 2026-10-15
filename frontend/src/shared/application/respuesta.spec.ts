import { describe, expect, it } from 'vitest'
import { confirmar, hecho, ofrecerReactivar } from './respuesta'

// No está en el enunciado de la Tarea 2 (que solo pide texto.spec.ts): completa la cobertura
// de respuesta.ts (RN-SIS-02 exige 90% en la capa de aplicación).
describe('Respuesta', () => {
  it('hecho() envuelve el valor final del caso de uso', () => {
    expect(hecho(42)).toEqual({ tipo: 'hecho', valor: 42 })
  })
  it('confirmar() pide una decisión al usuario con un mensaje', () => {
    expect(confirmar('¿Seguro?')).toEqual({ tipo: 'confirmar', mensaje: '¿Seguro?' })
  })
  it('ofrecerReactivar() identifica el producto archivado a reactivar', () => {
    expect(ofrecerReactivar('p1', 'Lejía 1 L')).toEqual({
      tipo: 'reactivar',
      productoId: 'p1',
      nombre: 'Lejía 1 L',
    })
  })
})
