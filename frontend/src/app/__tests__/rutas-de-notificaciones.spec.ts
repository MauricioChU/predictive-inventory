import { describe, expect, it, vi } from 'vitest'
import {
  escucharRutasDeNotificaciones,
  rutaDeLaApp,
  type ContenedorDeMensajes,
} from '../rutas-de-notificaciones'

const BASE = '/predictive-inventory/'
const ORIGEN = 'https://tienda.example'

function contenedorFalso() {
  const manejadores = new Set<(evento: MessageEvent) => void>()
  const contenedor: ContenedorDeMensajes = {
    addEventListener: (_tipo, manejador) => manejadores.add(manejador),
    removeEventListener: (_tipo, manejador) => manejadores.delete(manejador),
  }
  return {
    contenedor,
    manejadores,
    enviar(datos: unknown) {
      for (const manejador of manejadores) manejador(new MessageEvent('message', { data: datos }))
    },
  }
}

describe('rutaDeLaApp', () => {
  it('convierte la URL absoluta de la app en la ruta del router', () => {
    expect(
      rutaDeLaApp(
        { tipo: 'abrir-ruta', url: `${ORIGEN}/predictive-inventory/control/para-comprar` },
        BASE,
        ORIGEN,
      ),
    ).toBe('/control/para-comprar')
    expect(
      rutaDeLaApp({ tipo: 'abrir-ruta', url: `${ORIGEN}/predictive-inventory/` }, BASE, ORIGEN),
    ).toBe('/')
  })

  it.each([
    ['otro mensaje', { tipo: 'otra-cosa', url: `${ORIGEN}/predictive-inventory/` }],
    ['sin url', { tipo: 'abrir-ruta' }],
    ['otro origen', { tipo: 'abrir-ruta', url: 'https://malo.example/predictive-inventory/' }],
    ['fuera de la base', { tipo: 'abrir-ruta', url: `${ORIGEN}/otra-app/` }],
    ['una URL ilegible', { tipo: 'abrir-ruta', url: 'http://' }],
    ['nada', null],
  ])('ignora %s', (_caso, datos) => {
    expect(rutaDeLaApp(datos, BASE, ORIGEN)).toBeNull()
  })
})

describe('escucharRutasDeNotificaciones', () => {
  it('ruling 5: navega con el router a la pantalla que pide el Service Worker', () => {
    const push = vi.fn().mockResolvedValue(undefined)
    const falso = contenedorFalso()
    escucharRutasDeNotificaciones({ push }, falso.contenedor, BASE, ORIGEN)

    falso.enviar({ tipo: 'abrir-ruta', url: `${ORIGEN}/predictive-inventory/productos/p-1` })
    falso.enviar({ tipo: 'otra-cosa' })

    expect(push).toHaveBeenCalledExactlyOnceWith('/productos/p-1')
  })

  it('un fallo de navegación se registra sin romper nada', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const push = vi.fn().mockRejectedValue(new Error('guarda'))
    const falso = contenedorFalso()
    escucharRutasDeNotificaciones({ push }, falso.contenedor, BASE, ORIGEN)

    falso.enviar({ tipo: 'abrir-ruta', url: `${ORIGEN}/predictive-inventory/` })

    await vi.waitFor(() => expect(error).toHaveBeenCalledOnce())
    error.mockRestore()
  })

  it('devuelve la función para dejar de escuchar; sin Service Worker no hace nada', () => {
    const falso = contenedorFalso()
    const dejar = escucharRutasDeNotificaciones({ push: vi.fn() }, falso.contenedor, BASE, ORIGEN)
    dejar()
    expect(falso.manejadores.size).toBe(0)

    expect(() => escucharRutasDeNotificaciones({ push: vi.fn() }, undefined)()).not.toThrow()
  })
})
