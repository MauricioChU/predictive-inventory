import { describe, expect, it } from 'vitest'
import type { OperacionRegistro } from '@/shared/contratos/registros'
import { compararNormalizados, enOrdenDeRegistro } from './orden'

describe('compararNormalizados', () => {
  it('ordena sin importar tildes, mayúsculas ni espacios repetidos', () => {
    expect(compararNormalizados('Carbón', 'carbon')).toBe(0)
    expect(compararNormalizados('Lejía  1 L', 'lejia 1 l')).toBe(0)
    expect(compararNormalizados('Carbón', 'Lejía 1 L')).toBe(-1)
    expect(compararNormalizados('Lejía 1 L', 'Carbón')).toBe(1)
    expect(['Lejía', 'agua', 'Bolsa'].sort(compararNormalizados)).toEqual([
      'agua',
      'Bolsa',
      'Lejía',
    ])
  })
})

describe('enOrdenDeRegistro', () => {
  const registro = (id: string, registradaEn: string): OperacionRegistro => ({
    id,
    tipo: 'VENTA',
    movimientos: [{ productoId: 'p', cantidad: -1000, costoUnitario: 1, precioUnitario: 2 }],
    productoIds: ['p'],
    ocurridaEn: '2026-10-15T15:00:00.000Z',
    registradaEn,
    motivo: null,
    nota: null,
    anulaA: null,
    dispositivoId: 'd',
  })

  it('ordena el libro por registradaEn; a igual momento conserva el orden recibido', () => {
    const lista = [
      registro('c', '2026-10-15T15:00:02.000Z'),
      registro('a1', '2026-10-15T15:00:00.000Z'),
      registro('b', '2026-10-15T15:00:01.000Z'),
      registro('a2', '2026-10-15T15:00:00.000Z'),
    ]
    expect(enOrdenDeRegistro(lista).map((r) => r.id)).toEqual(['a1', 'a2', 'b', 'c'])
    expect(lista.map((r) => r.id)).toEqual(['c', 'a1', 'b', 'a2'])
  })
})
