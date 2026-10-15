import { describe, expect, it } from 'vitest'
import { escalaComun } from '../escala-barras'

describe('N2: escala común del gráfico de barras', () => {
  it('cada barra es un porcentaje del valor mayor (la misma escala para todas)', () => {
    expect(escalaComun([100, 200, 50]).map((b) => b.porcentaje)).toEqual([50, 100, 25])
  })

  it('el valor mayor siempre llena la pista y los demás quedan proporcionales aunque sus textos midan distinto', () => {
    const [ene, feb, mar] = escalaComun([12345.67, 9.5, 12000])
    expect(ene?.porcentaje).toBe(100)
    expect(mar?.porcentaje).toBeCloseTo(97.2, 1)
    expect(feb?.porcentaje).toBeCloseTo(0.08, 2)
  })

  it('todo valor mayor que 0 lleva barra visible, aunque su porcentaje sea casi 0', () => {
    expect(escalaComun([1_000_000, 0.001]).map((b) => b.visible)).toEqual([true, true])
  })

  it('cero, negativos y valores no numéricos no llevan barra', () => {
    expect(escalaComun([0, -5, Number.NaN, Number.POSITIVE_INFINITY, 10])).toEqual([
      { porcentaje: 0, visible: false },
      { porcentaje: 0, visible: false },
      { porcentaje: 0, visible: false },
      { porcentaje: 0, visible: false },
      { porcentaje: 100, visible: true },
    ])
  })

  it('si todos son 0 (o no hay datos) no divide por cero', () => {
    expect(escalaComun([0, 0])).toEqual([
      { porcentaje: 0, visible: false },
      { porcentaje: 0, visible: false },
    ])
    expect(escalaComun([])).toEqual([])
  })
})
