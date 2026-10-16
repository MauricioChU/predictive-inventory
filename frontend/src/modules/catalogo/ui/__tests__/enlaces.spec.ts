import { describe, expect, it } from 'vitest'
import { aPantalla } from '../enlaces'

describe('aPantalla (contrato de rutas por nombre entre ramas)', () => {
  it('si la ruta existe, la nombra con sus parámetros', () => {
    const router = { hasRoute: (nombre: string | symbol) => nombre === 'merma' }
    expect(aPantalla(router, 'merma', { id: 'p-1' })).toEqual({
      name: 'merma',
      params: { id: 'p-1' },
    })
  })

  it('si la rama que la crea todavía no llegó, lleva a Inicio', () => {
    const router = { hasRoute: () => false }
    expect(aPantalla(router, 'contar-stock', { id: 'p-1' })).toEqual({ path: '/' })
  })
})
