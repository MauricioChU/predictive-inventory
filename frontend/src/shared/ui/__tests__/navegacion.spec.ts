import { mount, flushPromises } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'
import { rutas } from '@/router'
import BarraNavegacion from '../componentes/BarraNavegacion.vue'

describe('RN-UX-12: navegación fija con 5 destinos', () => {
  it('muestra Inicio, Vender, Recibir, Productos y Control con texto', async () => {
    const router = createRouter({ history: createMemoryHistory(), routes: rutas })
    await router.push('/')
    const w = mount(BarraNavegacion, { global: { plugins: [router] } })
    await flushPromises()
    expect(w.findAll('a').map((a) => a.text().trim())).toEqual([
      'Inicio',
      'Vender',
      'Recibir',
      'Productos',
      'Control',
    ])
    expect(w.get('a[aria-current="page"]').text()).toContain('Inicio')
  })
  it('muestra el contador de atención en Control', async () => {
    const router = createRouter({ history: createMemoryHistory(), routes: rutas })
    const w = mount(BarraNavegacion, {
      props: { contadorControl: 2 },
      global: { plugins: [router] },
    })
    expect(w.text()).toContain('2')
    expect(w.text()).toContain('2 productos necesitan atención')
  })
})
