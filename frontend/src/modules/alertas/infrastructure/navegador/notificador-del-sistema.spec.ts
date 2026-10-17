import { afterEach, describe, expect, it, vi } from 'vitest'
import { NotificadorDelSistema, soportaNotificaciones } from './notificador-del-sistema'

const aviso = { texto: 'Se acabó: Lejía 1 L', url: '/productos/p1' }

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('soportaNotificaciones', () => {
  it('RN-AL-06: es false en jsdom (sin Notification API)', () => {
    expect(soportaNotificaciones()).toBe(false)
  })
})

describe('NotificadorDelSistema sin soporte del navegador', () => {
  it('RN-AL-06: permitido() resuelve false', async () => {
    expect(await new NotificadorDelSistema().permitido()).toBe(false)
  })
  it('RN-AL-08: solicitarPermiso() resuelve false sin lanzar', async () => {
    await expect(new NotificadorDelSistema().solicitarPermiso()).resolves.toBe(false)
  })
  it('RN-AL-06: mostrar() no falla aunque no haya soporte', async () => {
    await expect(new NotificadorDelSistema().mostrar(aviso)).resolves.toBeUndefined()
  })
})

describe('NotificadorDelSistema con navegador simulado', () => {
  it('RN-AL-06: permitido() y solicitarPermiso() reflejan Notification', async () => {
    vi.stubGlobal(
      'Notification',
      class {
        static permission = 'granted'
        static requestPermission = vi.fn().mockResolvedValue('denied')
      },
    )
    const notificador = new NotificadorDelSistema()
    expect(await notificador.permitido()).toBe(true)
    expect(await notificador.solicitarPermiso()).toBe(false)
  })

  it('RN-AL-06: con un Service Worker registrado usa showNotification con tag y renotify', async () => {
    const showNotification = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal('Notification', class {})
    vi.stubGlobal('navigator', {
      serviceWorker: { getRegistration: vi.fn().mockResolvedValue({ showNotification }) },
    })

    await new NotificadorDelSistema().mostrar(aviso)

    expect(showNotification).toHaveBeenCalledWith(
      'Inventario',
      expect.objectContaining({
        body: aviso.texto,
        data: { url: aviso.url },
        tag: aviso.url,
        renotify: true,
      }),
    )
  })

  it('RN-AL-06: sin registro de Service Worker usa new Notification', async () => {
    const construida = vi.fn()
    vi.stubGlobal(
      'Notification',
      class {
        constructor(titulo: string, opciones: unknown) {
          construida(titulo, opciones)
        }
      },
    )
    vi.stubGlobal('navigator', {
      serviceWorker: { getRegistration: vi.fn().mockResolvedValue(undefined) },
    })

    await new NotificadorDelSistema().mostrar(aviso)

    expect(construida).toHaveBeenCalledWith(
      'Inventario',
      expect.objectContaining({ tag: aviso.url, renotify: true }),
    )
  })

  it('RN-AL-06: sin navigator.serviceWorker tampoco cuelga: cae a new Notification', async () => {
    const construida = vi.fn()
    vi.stubGlobal(
      'Notification',
      class {
        constructor() {
          construida()
        }
      },
    )
    vi.stubGlobal('navigator', {})

    await new NotificadorDelSistema().mostrar(aviso)

    expect(construida).toHaveBeenCalledOnce()
  })

  it('RN-AL-06: si new Notification lanza (Illegal constructor), mostrar() no lanza', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.stubGlobal(
      'Notification',
      class {
        constructor() {
          throw new TypeError('Illegal constructor')
        }
      },
    )
    vi.stubGlobal('navigator', {})

    await expect(new NotificadorDelSistema().mostrar(aviso)).resolves.toBeUndefined()
    expect(error).toHaveBeenCalled()
  })

  // Plan 17: un registro que existe pero no puede mostrar (p. ej. el Service Worker todavía no
  // está activo) no deja a la persona sin aviso: se intenta con la API básica.
  it('RN-AL-06: si showNotification rechaza, respalda con new Notification', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    const construida = vi.fn()
    vi.stubGlobal(
      'Notification',
      class {
        constructor(titulo: string, opciones: unknown) {
          construida(titulo, opciones)
        }
      },
    )
    const showNotification = vi.fn().mockRejectedValue(new TypeError('No active registration'))
    vi.stubGlobal('navigator', {
      serviceWorker: { getRegistration: vi.fn().mockResolvedValue({ showNotification }) },
    })

    await expect(new NotificadorDelSistema().mostrar(aviso)).resolves.toBeUndefined()

    expect(showNotification).toHaveBeenCalledOnce()
    expect(construida).toHaveBeenCalledWith(
      'Inventario',
      expect.objectContaining({ body: aviso.texto, tag: aviso.url, renotify: true }),
    )
    expect(error).toHaveBeenCalled()
  })

  it('RN-AL-06: si showNotification rechaza y new Notification también falla, mostrar() no lanza', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.stubGlobal(
      'Notification',
      class {
        constructor() {
          throw new TypeError('Illegal constructor')
        }
      },
    )
    vi.stubGlobal('navigator', {
      serviceWorker: {
        getRegistration: vi.fn().mockResolvedValue({
          showNotification: vi.fn().mockRejectedValue(new Error('falló')),
        }),
      },
    })

    await expect(new NotificadorDelSistema().mostrar(aviso)).resolves.toBeUndefined()
    expect(error).toHaveBeenCalledTimes(2)
  })

  it('RN-AL-06: si getRegistration rechaza, mostrar() no lanza', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.stubGlobal('Notification', class {})
    vi.stubGlobal('navigator', {
      serviceWorker: { getRegistration: vi.fn().mockRejectedValue(new Error('falló')) },
    })

    await expect(new NotificadorDelSistema().mostrar(aviso)).resolves.toBeUndefined()
  })
})
