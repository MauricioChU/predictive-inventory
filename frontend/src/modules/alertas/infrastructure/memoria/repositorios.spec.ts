import { describe, expect, it } from 'vitest'
import { AlmacenEnMemoria } from '@/shared/infrastructure/memoria/almacen-en-memoria'
import { NotificadorEnMemoria, RepositorioDeAvisosEnMemoria } from './repositorios'

describe('RepositorioDeAvisosEnMemoria', () => {
  it('no tiene avisos al principio', async () => {
    const repo = new RepositorioDeAvisosEnMemoria(new AlmacenEnMemoria())
    expect(await repo.todos()).toEqual([])
  })

  it('guarda y devuelve un registro', async () => {
    const repo = new RepositorioDeAvisosEnMemoria(new AlmacenEnMemoria())
    await repo.guardar({ productoId: 'p1', ultimoEstadoAvisado: 'POR_ACABARSE' })
    expect(await repo.todos()).toEqual([{ productoId: 'p1', ultimoEstadoAvisado: 'POR_ACABARSE' }])
  })

  it('guardar de nuevo el mismo producto reemplaza el registro', async () => {
    const repo = new RepositorioDeAvisosEnMemoria(new AlmacenEnMemoria())
    await repo.guardar({ productoId: 'p1', ultimoEstadoAvisado: 'POR_ACABARSE' })
    await repo.guardar({ productoId: 'p1', ultimoEstadoAvisado: 'AGOTADO' })
    expect(await repo.todos()).toEqual([{ productoId: 'p1', ultimoEstadoAvisado: 'AGOTADO' }])
  })

  it('RN-AL-01: eliminar quita el registro del producto archivado', async () => {
    const repo = new RepositorioDeAvisosEnMemoria(new AlmacenEnMemoria())
    await repo.guardar({ productoId: 'p1', ultimoEstadoAvisado: 'AGOTADO' })
    await repo.guardar({ productoId: 'p2', ultimoEstadoAvisado: 'NORMAL' })
    await repo.eliminar('p1')
    expect(await repo.todos()).toEqual([{ productoId: 'p2', ultimoEstadoAvisado: 'NORMAL' }])
  })

  it('eliminar un producto sin registro no falla', async () => {
    const repo = new RepositorioDeAvisosEnMemoria(new AlmacenEnMemoria())
    await expect(repo.eliminar('inexistente')).resolves.toBeUndefined()
  })
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
