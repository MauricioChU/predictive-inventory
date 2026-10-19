import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, describe, expect, it } from 'vitest'
import { defineComponent, h, nextTick } from 'vue'
import { createMemoryHistory, createRouter } from 'vue-router'
import LayoutApp from '../LayoutApp.vue'
import { useEstadoGlobal } from '../estado-global'

const Pantalla = defineComponent({ render: () => h('h1', 'Pantalla') })

async function montarLayout() {
  const pinia = createPinia()
  setActivePinia(pinia)
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      {
        path: '/',
        name: 'inicio',
        component: Pantalla,
        meta: { titulo: 'Inicio', enNavegacion: true },
      },
    ],
  })
  await router.push('/')
  await router.isReady()
  const wrapper = mount(LayoutApp, { global: { plugins: [pinia, router] } })
  return { wrapper, estadoGlobal: useEstadoGlobal(pinia) }
}

describe('LayoutApp: navegación fija y primera vez (RN-UX-16)', () => {
  afterEach(() => document.documentElement.style.removeProperty('--alto-pie'))

  it('con la primera vez completada muestra la navegación', async () => {
    const { wrapper, estadoGlobal } = await montarLayout()
    estadoGlobal.primeraVez = false
    await nextTick()

    expect(wrapper.find('nav[aria-label="Navegación principal"]').exists()).toBe(true)
    expect(wrapper.find('.layout-app').classes()).not.toContain('sin-navegacion')
    wrapper.unmount()
  })

  it('mientras falte la primera vez no hay navegación (no hay a dónde ir)', async () => {
    const { wrapper, estadoGlobal } = await montarLayout()
    estadoGlobal.primeraVez = true
    await nextTick()

    expect(wrapper.find('nav').exists()).toBe(false)
    expect(wrapper.find('.layout-app').classes()).toContain('sin-navegacion')
    // La pantalla sigue ahí y el contenido es el mismo <main>.
    expect(wrapper.find('main#contenido h1').text()).toBe('Pantalla')
    wrapper.unmount()
  })

  it('al completarse la primera vez, la navegación aparece sin recargar', async () => {
    const { wrapper, estadoGlobal } = await montarLayout()
    estadoGlobal.primeraVez = true
    await nextTick()
    expect(wrapper.find('nav').exists()).toBe(false)

    estadoGlobal.primeraVez = false
    await nextTick()
    expect(wrapper.find('nav').exists()).toBe(true)
    wrapper.unmount()
  })
})
