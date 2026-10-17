import { describe, expect, it, vi } from 'vitest'
import { aPantalla } from '../enlaces'

describe('aPantalla (contrato de rutas por nombre entre ramas)', () => {
  it('si la ruta existe, la nombra con sus parámetros', () => {
    const router = { hasRoute: (nombre: string | symbol) => nombre === 'merma' }
    expect(aPantalla(router, 'merma', { id: 'p-1' })).toEqual({
      name: 'merma',
      params: { id: 'p-1' },
    })
  })

  it('también con query (p. ej. Primera vez en el paso de contar)', () => {
    const router = { hasRoute: () => true }
    expect(aPantalla(router, 'primera-vez', {}, { paso: 'contar' })).toEqual({
      name: 'primera-vez',
      params: {},
      query: { paso: 'contar' },
    })
  })

  it('si la rama que la crea todavía no llegó, lleva a Inicio (y en desarrollo lo avisa)', () => {
    const aviso = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const router = { hasRoute: () => false }
    expect(aPantalla(router, 'contar-stock', { id: 'p-1' })).toEqual({ path: '/' })
    // Un nombre mal escrito no debe pasar en silencio mientras se desarrolla.
    expect(aviso).toHaveBeenCalledWith(expect.stringContaining('"contar-stock"'))
    aviso.mockRestore()
  })
})
