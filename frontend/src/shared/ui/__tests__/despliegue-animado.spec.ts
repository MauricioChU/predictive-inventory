import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import DespliegueAnimado from '../componentes/DespliegueAnimado.vue'

describe('DespliegueAnimado', () => {
  it('cerrado no pone nada en el DOM; abierto muestra su contenido', async () => {
    const despliegue = mount(DespliegueAnimado, {
      props: { abierto: false },
      slots: { default: '<p class="dentro">Formulario</p>' },
    })
    expect(despliegue.find('.dentro').exists()).toBe(false)
    await despliegue.setProps({ abierto: true })
    expect(despliegue.get('.dentro').text()).toBe('Formulario')
    await despliegue.setProps({ abierto: false })
    expect(despliegue.find('.dentro').exists()).toBe(false)
  })
})
