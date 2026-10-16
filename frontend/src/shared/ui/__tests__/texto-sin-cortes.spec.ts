import { describe, expect, it } from 'vitest'
import { largoSinCorte, pegarCifras } from '../texto-sin-cortes'

const NBSP = '\u00A0'

describe('pegarCifras: un monto o una cantidad nunca se parte entre dos líneas', () => {
  it('pega "S/" a su número y los grupos de miles entre sí', () => {
    expect(pegarCifras('S/ 12 345.67')).toBe(`S/${NBSP}12${NBSP}345.67`)
    expect(pegarCifras('S/ 1 234 567.00')).toBe(`S/${NBSP}1${NBSP}234${NBSP}567.00`)
    expect(pegarCifras('-S/ 3.50')).toBe(`-S/${NBSP}3.50`)
    expect(pegarCifras('Hoy ganaste S/ 48.20')).toBe(`Hoy ganaste S/${NBSP}48.20`)
  })

  it('pega el número a su unidad (unid., kg, L) y a "días"', () => {
    expect(pegarCifras('Sí, compra ~12 unid.')).toBe(`Sí, compra ~12${NBSP}unid.`)
    expect(pegarCifras('Quedan 2.5 kg')).toBe(`Quedan 2.5${NBSP}kg`)
    expect(pegarCifras('Lejía 1 L')).toBe(`Lejía 1${NBSP}L`)
    expect(pegarCifras('te alcanza para ~20 días')).toBe(`te alcanza para ~20${NBSP}días`)
    expect(pegarCifras('para 1 día')).toBe(`para 1${NBSP}día`)
  })

  it('no toca los demás espacios', () => {
    expect(pegarCifras('Llevas 1 de 3')).toBe('Llevas 1 de 3')
    expect(pegarCifras('2 Limones')).toBe('2 Limones')
    expect(pegarCifras('Vendiste 12 veces')).toBe('Vendiste 12 veces')
    expect(pegarCifras('')).toBe('')
  })
})

describe('largoSinCorte: el trozo más largo que no se puede partir (para ajustar la letra)', () => {
  it('cuenta el monto entero como un solo trozo', () => {
    expect(largoSinCorte('S/ 12 345.67')).toBe(12)
    expect(largoSinCorte('Hoy ganaste S/ 48.20')).toBe(8)
  })

  it('en una frase, el trozo más largo puede ser una palabra o una cantidad con su unidad', () => {
    expect(largoSinCorte('No hace falta: te alcanza para ~20 días')).toBe(8)
    expect(largoSinCorte('Sí, compra ~12 unid.')).toBe(9)
    expect(largoSinCorte('No compres: no se vende hace 45 días')).toBe(8)
  })

  it('cuenta letras con tilde como una sola letra y una palabra sin espacios entera', () => {
    expect(largoSinCorte('Sí')).toBe(2)
    expect(largoSinCorte('Superdesinfectante')).toBe(18)
  })

  it('un texto vacío mide 0', () => {
    expect(largoSinCorte('')).toBe(0)
    expect(largoSinCorte('   ')).toBe(0)
  })
})
