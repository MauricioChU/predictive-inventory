import { describe, expect, it } from 'vitest'
import { NotificadorDelSistema, soportaNotificaciones } from './notificador-del-sistema'

// jsdom no implementa la Notification API ni navigator.serviceWorker: solo se prueba la
// detección de soporte y que el adaptador no falla cuando no hay soporte (03-alertas, comun.md).
describe('soportaNotificaciones', () => {
  it('es false en jsdom (sin Notification API)', () => {
    expect(soportaNotificaciones()).toBe(false)
  })
})

describe('NotificadorDelSistema sin soporte del navegador', () => {
  it('permitido() resuelve false', async () => {
    const notificador = new NotificadorDelSistema()
    expect(await notificador.permitido()).toBe(false)
  })

  it('solicitarPermiso() resuelve false sin lanzar', async () => {
    const notificador = new NotificadorDelSistema()
    await expect(notificador.solicitarPermiso()).resolves.toBe(false)
  })

  it('mostrar() no falla aunque no haya soporte', async () => {
    const notificador = new NotificadorDelSistema()
    await expect(
      notificador.mostrar({ texto: 'Se acabó: Lejía 1 L', url: '/productos/p1' }),
    ).resolves.toBeUndefined()
  })
})
