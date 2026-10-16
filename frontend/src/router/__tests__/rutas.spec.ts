import { describe, expect, it } from 'vitest'
import { rutas } from '@/router'

describe('rutas de la app (una lista por rama de pantallas)', () => {
  it('no repiten nombre ni camino', () => {
    const nombres = rutas.map((r) => r.name).filter((n) => n !== undefined)
    const caminos = rutas.map((r) => r.path)
    expect(new Set(nombres).size).toBe(nombres.length)
    expect(new Set(caminos).size).toBe(caminos.length)
  })

  it('el comodín que lleva a Inicio va al final, para no tapar ninguna pantalla', () => {
    expect(rutas.at(-1)).toEqual({ path: '/:pathMatch(.*)*', redirect: '/' })
  })

  it('Historial y Ajustes existen aunque no estén en la navegación (se abren desde Inicio)', () => {
    const fuera = rutas.filter((r) => r.name && !r.meta?.enNavegacion).map((r) => r.name)
    expect(fuera).toEqual(expect.arrayContaining(['historial', 'ajustes']))
  })
})
