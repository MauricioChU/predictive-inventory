import { describe, expect, it } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'
import { rutaDeProducto } from '@/modules/alertas'
import { rutas } from '@/router'

/** Plan 11: las rutas de Productos del contrato de rutas de la Ola 4. */
describe('rutas de Productos (plan 11)', () => {
  const router = createRouter({ history: createMemoryHistory(), routes: rutas })

  it.each([
    ['/productos', 'productos', {}],
    ['/productos/nuevo', 'producto-nuevo', {}],
    ['/productos/categorias', 'categorias', {}],
    ['/productos/p-1', 'producto', { id: 'p-1' }],
    ['/productos/p-1/editar', 'producto-editar', { id: 'p-1' }],
  ])('%s → %s', (camino, nombre, params) => {
    const ruta = router.resolve(camino)
    expect(ruta.name).toBe(nombre)
    expect(ruta.params).toEqual(params)
  })

  it('M5: la ruta que abren las notificaciones de un producto es su detalle', () => {
    expect(router.resolve(rutaDeProducto('p-1')).name).toBe('producto')
  })

  it('de Productos, solo la lista está en la navegación', () => {
    const enNavegacion = rutas
      .filter((r) => String(r.path).startsWith('/productos') && r.meta?.enNavegacion)
      .map((r) => r.name)
    expect(enNavegacion).toEqual(['productos'])
  })
})
