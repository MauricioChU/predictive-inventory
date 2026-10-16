import { describe, expect, it } from 'vitest'
import { prediccionCon } from './__pruebas__/historial'
import { cant } from './__pruebas__/productos'
import { estadoDeStock } from './estado'
import { diasDeCobertura } from './prediccion'

describe('RN-AL-01: estado de stock', () => {
  it.each([
    ['0', 'AGOTADO'],
    ['1', 'POR_ACABARSE'],
    ['3', 'POR_ACABARSE'],
    ['4', 'NORMAL'],
  ] as const)('RN-AL-01: sin predicción, stock %s con mínimo 3 → %s', (stock, estado) => {
    expect(
      estadoDeStock({
        stock: cant(stock),
        stockMinimo: cant('3'),
        diasDeCobertura: null,
        diasAnticipacion: 3,
      }),
    ).toBe(estado)
  })

  it('RN-AL-01: con predicción se avisa antes de llegar al mínimo', () => {
    const cobertura = diasDeCobertura(prediccionCon('2'), cant('6'))
    expect(cobertura).toBe(3)
    expect(
      estadoDeStock({
        stock: cant('6'),
        stockMinimo: cant('3'),
        diasDeCobertura: cobertura,
        diasAnticipacion: 3,
      }),
    ).toBe('POR_ACABARSE')
  })

  it('RN-AL-01: con más cobertura que días de anticipación está bien', () => {
    expect(
      estadoDeStock({
        stock: cant('7'),
        stockMinimo: cant('3'),
        diasDeCobertura: 9,
        diasAnticipacion: 3,
      }),
    ).toBe('NORMAL')
  })

  it('RN-AL-01: agotado gana aunque el mínimo sea 0', () => {
    expect(
      estadoDeStock({
        stock: cant('0'),
        stockMinimo: cant('0'),
        diasDeCobertura: null,
        diasAnticipacion: 3,
      }),
    ).toBe('AGOTADO')
  })
})
