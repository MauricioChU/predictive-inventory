import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'
import { rutas } from '@/router'
import EncabezadoPagina from '../componentes/EncabezadoPagina.vue'

function crearRouterDePrueba() {
  return createRouter({ history: createMemoryHistory(), routes: rutas })
}

describe('EncabezadoPagina (Q3): volver', () => {
  it('si el padre escucha @volver, solo emite y no navega', async () => {
    const router = crearRouterDePrueba()
    await router.push('/ajustes')
    const espiaBack = vi.spyOn(router, 'back')
    const espiaPush = vi.spyOn(router, 'push')
    const alVolver = vi.fn<() => void>()

    const w = mount(EncabezadoPagina, {
      props: { titulo: 'Ajustes', volver: true, onVolver: alVolver },
      global: { plugins: [router] },
    })
    await w.get('button').trigger('click')

    expect(alVolver).toHaveBeenCalledTimes(1)
    expect(espiaBack).not.toHaveBeenCalled()
    expect(espiaPush).not.toHaveBeenCalled()
  })

  it('sin listener y con historial previo, navega con router.back()', async () => {
    window.history.pushState({ back: '/' }, '', '/ajustes')
    const router = crearRouterDePrueba()
    await router.push('/ajustes')
    const espiaBack = vi.spyOn(router, 'back').mockImplementation(() => {})
    const espiaPush = vi.spyOn(router, 'push')

    const w = mount(EncabezadoPagina, {
      props: { titulo: 'Ajustes', volver: true },
      global: { plugins: [router] },
    })
    await w.get('button').trigger('click')

    expect(espiaBack).toHaveBeenCalledTimes(1)
    expect(espiaPush).not.toHaveBeenCalled()
  })

  it('sin listener y sin historial previo, va a Inicio en vez de dejar un callejón sin salida', async () => {
    window.history.replaceState(null, '', '/ajustes')
    const router = crearRouterDePrueba()
    await router.push('/ajustes')
    const espiaBack = vi.spyOn(router, 'back')
    const espiaPush = vi.spyOn(router, 'push').mockImplementation(() => Promise.resolve())

    const w = mount(EncabezadoPagina, {
      props: { titulo: 'Ajustes', volver: true },
      global: { plugins: [router] },
    })
    await w.get('button').trigger('click')

    expect(espiaBack).not.toHaveBeenCalled()
    expect(espiaPush).toHaveBeenCalledWith({ name: 'inicio' })
  })
})
