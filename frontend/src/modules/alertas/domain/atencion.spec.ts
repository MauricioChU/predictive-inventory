import { describe, expect, it } from 'vitest'
import { Dinero } from '@/shared/domain/dinero'
import { lineasDelResumenDelDia, textoDeAtencion } from './atencion'

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

describe('lineasDelResumenDelDia (RN-AL-09)', () => {
  it('RN-AL-09: 1 agotado, 1 por acabarse y ayer ganaste', () => {
    const lineas = lineasDelResumenDelDia(1, 1, {
      ventas: Dinero.deCentimos(10000),
      gananciaNeta: Dinero.deCentimos(4820),
    })
    expect(lineas).toEqual(['1 agotado', '1 por acabarse', 'Ayer ganaste S/ 48.20'])
  })
  it('RN-AL-09: nada agotado, nada por acabarse y sin ventas ni ganancia ni pérdida ayer', () => {
    const lineas = lineasDelResumenDelDia(0, 0, {
      ventas: Dinero.cero(),
      gananciaNeta: Dinero.cero(),
    })
    expect(lineas).toEqual(['Nada agotado', 'Nada por acabarse', 'Ayer no hubo ventas'])
  })
  it('RN-AL-09: varios agotados y por acabarse (plural) y ayer perdiste (con ventas)', () => {
    const lineas = lineasDelResumenDelDia(3, 2, {
      ventas: Dinero.deCentimos(500),
      gananciaNeta: Dinero.deCentimos(-1500),
    })
    expect(lineas).toEqual(['3 agotados', '2 por acabarse', 'Ayer perdiste S/ 15.00'])
  })
  it('RN-AL-09: una pérdida sin ventas (p. ej. solo una merma) no se esconde como "no hubo ventas"', () => {
    const lineas = lineasDelResumenDelDia(0, 0, {
      ventas: Dinero.cero(),
      gananciaNeta: Dinero.deCentimos(-1200),
    })
    expect(lineas).toEqual(['Nada agotado', 'Nada por acabarse', 'Ayer perdiste S/ 12.00'])
  })
})
