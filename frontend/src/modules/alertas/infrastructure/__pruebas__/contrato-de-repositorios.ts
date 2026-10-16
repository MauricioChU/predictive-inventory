import { expect, it } from 'vitest'
import type { RepositorioDeAvisos } from '../../application/puertos'

/**
 * Casos de prueba de `RepositorioDeAvisos`: los mismos para la implementación en memoria y
 * la de Dexie (los resultados deben ser idénticos). `crear` devuelve un repositorio vacío.
 */
export function probarRepositorioDeAvisos(crear: () => RepositorioDeAvisos): void {
  it('no tiene avisos al principio', async () => {
    expect(await crear().todos()).toEqual([])
  })

  it('guarda y devuelve un registro', async () => {
    const repo = crear()
    await repo.guardar({ productoId: 'p1', ultimoEstadoAvisado: 'POR_ACABARSE' })
    expect(await repo.todos()).toEqual([{ productoId: 'p1', ultimoEstadoAvisado: 'POR_ACABARSE' }])
  })

  it('guardar de nuevo el mismo producto reemplaza el registro', async () => {
    const repo = crear()
    await repo.guardar({ productoId: 'p1', ultimoEstadoAvisado: 'POR_ACABARSE' })
    await repo.guardar({ productoId: 'p1', ultimoEstadoAvisado: 'AGOTADO' })
    expect(await repo.todos()).toEqual([{ productoId: 'p1', ultimoEstadoAvisado: 'AGOTADO' }])
  })

  it('todos devuelve un registro por producto', async () => {
    const repo = crear()
    await repo.guardar({ productoId: 'p2', ultimoEstadoAvisado: 'NORMAL' })
    await repo.guardar({ productoId: 'p1', ultimoEstadoAvisado: 'AGOTADO' })
    const todos = await repo.todos()
    expect([...todos].sort((a, b) => a.productoId.localeCompare(b.productoId))).toEqual([
      { productoId: 'p1', ultimoEstadoAvisado: 'AGOTADO' },
      { productoId: 'p2', ultimoEstadoAvisado: 'NORMAL' },
    ])
  })

  it('RN-AL-01: eliminar quita el registro del producto archivado', async () => {
    const repo = crear()
    await repo.guardar({ productoId: 'p1', ultimoEstadoAvisado: 'AGOTADO' })
    await repo.guardar({ productoId: 'p2', ultimoEstadoAvisado: 'NORMAL' })
    await repo.eliminar('p1')
    expect(await repo.todos()).toEqual([{ productoId: 'p2', ultimoEstadoAvisado: 'NORMAL' }])
  })

  it('eliminar un producto sin registro no falla', async () => {
    await expect(crear().eliminar('inexistente')).resolves.toBeUndefined()
  })
}
