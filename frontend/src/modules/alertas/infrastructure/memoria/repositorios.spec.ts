import { describe, expect, it } from 'vitest'
import { AlmacenEnMemoria } from '@/shared/infrastructure/memoria/almacen-en-memoria'
import { probarRepositorioDeAvisos } from '../__pruebas__/contrato-de-repositorios'
import { NotificadorEnMemoria, RepositorioDeAvisosEnMemoria } from './repositorios'

describe('RepositorioDeAvisosEnMemoria', () => {
  probarRepositorioDeAvisos(() => new RepositorioDeAvisosEnMemoria(new AlmacenEnMemoria()))
})

describe('NotificadorEnMemoria', () => {
  it('por defecto el permiso está concedido y no hay notificaciones mostradas', async () => {
    const notificador = new NotificadorEnMemoria()
    expect(await notificador.permitido()).toBe(true)
    expect(notificador.mostradas).toEqual([])
    expect(notificador.solicitudes).toBe(0)
  })

  it('mostrar() registra la notificación en orden', async () => {
    const notificador = new NotificadorEnMemoria()
    await notificador.mostrar({ texto: 'Se acabó: Lejía 1 L', url: '/productos/p1' })
    await notificador.mostrar({
      texto: '3 productos se están acabando',
      url: '/control/para-comprar',
    })
    expect(notificador.mostradas).toEqual([
      { texto: 'Se acabó: Lejía 1 L', url: '/productos/p1' },
      { texto: '3 productos se están acabando', url: '/control/para-comprar' },
    ])
  })

  it('solicitarPermiso() cuenta las solicitudes y devuelve el permiso configurado', async () => {
    const notificador = new NotificadorEnMemoria()
    notificador.permiso = false
    expect(await notificador.solicitarPermiso()).toBe(false)
    expect(notificador.solicitudes).toBe(1)
    notificador.permiso = true
    expect(await notificador.solicitarPermiso()).toBe(true)
    expect(notificador.solicitudes).toBe(2)
  })

  it('permitido() refleja el permiso configurable', async () => {
    const notificador = new NotificadorEnMemoria()
    notificador.permiso = false
    expect(await notificador.permitido()).toBe(false)
  })
})
