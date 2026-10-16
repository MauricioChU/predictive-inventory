import { describe, expect, it } from 'vitest'
import { createMemoryHistory, createRouter, type RouteRecordRaw } from 'vue-router'
import { haciaPantalla } from './pantallas-de-otras-ramas'

const Vacia = { render: () => null }

function router(rutas: RouteRecordRaw[]) {
  return createRouter({ history: createMemoryHistory(), routes: rutas })
}

describe('haciaPantalla (contrato de rutas de la Ola 4)', () => {
  it('con la pantalla registrada, va por nombre y lleva su query', () => {
    const conRuta = router([{ path: '/productos/nuevo', name: 'producto-nuevo', component: Vacia }])

    expect(haciaPantalla(conRuta, 'producto-nuevo', { desde: 'primera-vez' })).toEqual({
      name: 'producto-nuevo',
      query: { desde: 'primera-vez' },
    })
  })

  it('sin la pantalla todavía, va por el camino del contrato con la misma query', () => {
    const sinRuta = router([{ path: '/', component: Vacia }])

    expect(haciaPantalla(sinRuta, 'producto-nuevo', { desde: 'primera-vez' })).toEqual({
      path: '/productos/nuevo',
      query: { desde: 'primera-vez' },
    })
    expect(sinRuta.resolve(haciaPantalla(sinRuta, 'producto-nuevo', { desde: 'primera-vez' })).fullPath).toBe(
      '/productos/nuevo?desde=primera-vez',
    )
  })

  it('sin query, igual que antes', () => {
    const sinRuta = router([{ path: '/', component: Vacia }])

    expect(haciaPantalla(sinRuta, 'vender')).toEqual({ path: '/vender' })
  })
})
