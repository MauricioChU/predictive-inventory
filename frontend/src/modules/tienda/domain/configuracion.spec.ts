import { describe, expect, it } from 'vitest'
import { validarCambios } from './configuracion'

describe('validarCambios', () => {
  it('nombre recortado vacío', () => {
    expect(validarCambios({ nombreTienda: '   ' })).toBe('Escribe el nombre de tu tienda')
  })

  it('nombre de más de 40 letras', () => {
    expect(validarCambios({ nombreTienda: 'a'.repeat(41) })).toBe(
      'El nombre de la tienda puede tener hasta 40 letras',
    )
  })

  it('nombre válido no da error', () => {
    expect(validarCambios({ nombreTienda: 'Bodega Rosita' })).toBeNull()
  })

  it('nombre de exactamente 40 letras es válido', () => {
    expect(validarCambios({ nombreTienda: 'a'.repeat(40) })).toBeNull()
  })

  it('diasEntreCompras fuera de 1-60', () => {
    expect(validarCambios({ diasEntreCompras: 0 })).toBe('Elige un número entre 1 y 60')
    expect(validarCambios({ diasEntreCompras: 61 })).toBe('Elige un número entre 1 y 60')
  })

  it('diasEntreCompras no entero', () => {
    expect(validarCambios({ diasEntreCompras: 3.5 })).toBe('Elige un número entre 1 y 60')
  })

  it('diasEntreCompras en el límite es válido', () => {
    expect(validarCambios({ diasEntreCompras: 1 })).toBeNull()
    expect(validarCambios({ diasEntreCompras: 60 })).toBeNull()
  })

  it('diasAnticipacion fuera de 1-14', () => {
    expect(validarCambios({ diasAnticipacion: 0 })).toBe('Elige un número entre 1 y 14')
    expect(validarCambios({ diasAnticipacion: 15 })).toBe('Elige un número entre 1 y 14')
  })

  it('diasMaximosDeCompra fuera de 7-180', () => {
    expect(validarCambios({ diasMaximosDeCompra: 6 })).toBe('Elige un número entre 7 y 180')
    expect(validarCambios({ diasMaximosDeCompra: 181 })).toBe('Elige un número entre 7 y 180')
  })

  it('no valida campos que no vienen en el cambio', () => {
    expect(validarCambios({ tamanoDeLetra: 'GRANDE' })).toBeNull()
    expect(validarCambios({})).toBeNull()
  })

  it('revisa los campos en orden: nombre antes que los días', () => {
    expect(validarCambios({ nombreTienda: '', diasEntreCompras: 999 })).toBe(
      'Escribe el nombre de tu tienda',
    )
  })
})
