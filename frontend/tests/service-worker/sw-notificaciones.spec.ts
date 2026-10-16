// @vitest-environment node
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { runInNewContext } from 'node:vm'
import { describe, expect, it, vi } from 'vitest'

const CODIGO = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'public', 'sw-notificaciones.js'),
  'utf8',
)
const ALCANCE = 'https://tienda.example/predictive-inventory/'

interface VentanaFalsa {
  url: string
  focus: ReturnType<typeof vi.fn>
  postMessage: ReturnType<typeof vi.fn>
}

function ventana(url: string, focus = vi.fn()): VentanaFalsa {
  const v: VentanaFalsa = { url, focus, postMessage: vi.fn() }
  if (focus.getMockImplementation() === undefined) focus.mockResolvedValue(v)
  return v
}

/** Carga el script en un "Service Worker" falso y toca una notificación con `datos`. */
async function tocarNotificacion(datos: unknown, ventanas: VentanaFalsa[] = []) {
  const manejadores = new Map<string, (evento: unknown) => void>()
  const clients = {
    matchAll: vi.fn(async () => ventanas),
    openWindow: vi.fn(async () => null),
  }
  runInNewContext(CODIGO, {
    URL,
    self: {
      registration: { scope: ALCANCE },
      clients,
      addEventListener: (tipo: string, manejador: (evento: unknown) => void) => {
        manejadores.set(tipo, manejador)
      },
    },
  })
  const cerrar = vi.fn()
  let espera: Promise<unknown> = Promise.resolve()
  manejadores.get('notificationclick')?.({
    notification: { data: datos, close: cerrar },
    waitUntil: (promesa: Promise<unknown>) => {
      espera = promesa
    },
  })
  await espera
  return { clients, cerrar }
}

describe('Service Worker: tocar una notificación (ruling 5)', () => {
  it('RN-AL-07: sin ventana abierta, abre la pantalla resuelta contra el alcance de la app', async () => {
    const { clients, cerrar } = await tocarNotificacion({ url: '/control/para-comprar' })

    expect(cerrar).toHaveBeenCalledOnce()
    expect(clients.matchAll).toHaveBeenCalledWith({ type: 'window' })
    expect(clients.openWindow).toHaveBeenCalledWith(
      'https://tienda.example/predictive-inventory/control/para-comprar',
    )
  })

  it('con una ventana de la app abierta, la enfoca y le pide navegar (sin abrir otra)', async () => {
    const abierta = ventana('https://tienda.example/predictive-inventory/vender')

    const { clients } = await tocarNotificacion({ url: '/productos/p-1' }, [abierta])

    expect(abierta.focus).toHaveBeenCalledOnce()
    expect(abierta.postMessage).toHaveBeenCalledWith({
      tipo: 'abrir-ruta',
      url: 'https://tienda.example/predictive-inventory/productos/p-1',
    })
    expect(clients.openWindow).not.toHaveBeenCalled()
  })

  it('si no puede enfocar la ventana, abre una nueva', async () => {
    const sinFoco = ventana(
      'https://tienda.example/predictive-inventory/',
      vi.fn().mockRejectedValue(new Error('sin permiso')),
    )

    const { clients } = await tocarNotificacion({ url: '/productos/p-1' }, [sinFoco])

    expect(clients.openWindow).toHaveBeenCalledWith(
      'https://tienda.example/predictive-inventory/productos/p-1',
    )
  })

  it('una ventana de otra parte del sitio no cuenta como la app', async () => {
    const otra = ventana('https://tienda.example/otra-cosa/')

    const { clients } = await tocarNotificacion({ url: '/control/para-comprar' }, [otra])

    expect(otra.focus).not.toHaveBeenCalled()
    expect(clients.openWindow).toHaveBeenCalledOnce()
  })

  it.each([
    ['sin datos', undefined],
    ['sin url', {}],
    ['una URL de otro sitio', { url: 'https://malo.example/robar' }],
    ['una ruta que sale del alcance', { url: '/../../afuera' }],
  ])('con %s, abre el inicio de la app', async (_caso, datos) => {
    const { clients } = await tocarNotificacion(datos)

    expect(clients.openWindow).toHaveBeenCalledWith(ALCANCE)
  })
})
