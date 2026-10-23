import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { nextTick } from 'vue'
import HojaInferior from '../componentes/HojaInferior.vue'

function montar() {
  return mount(HojaInferior, {
    props: { titulo: 'Movimientos' },
    slots: { default: '<p class="dentro">Contenido</p>' },
    attachTo: document.body,
  })
}

describe('HojaInferior', () => {
  it('muestra el título, el contenido y la flecha con nombre "Cerrar"', () => {
    const hoja = montar()
    expect(hoja.get('h2').text()).toBe('Movimientos')
    expect(hoja.find('.dentro').exists()).toBe(true)
    expect(hoja.get('button').attributes('aria-label')).toBe('Cerrar')
    hoja.unmount()
  })

  it('al abrir lleva el foco al título', () => {
    const hoja = montar()
    expect(document.activeElement).toBe(hoja.get('h2').element)
    hoja.unmount()
  })

  it('la flecha, la asa, el velo y Escape piden cerrar (sin animaciones en jsdom, al instante)', async () => {
    for (const abrir of [
      (h: ReturnType<typeof montar>) => h.get('button').trigger('click'),
      (h: ReturnType<typeof montar>) => h.get('.asa').trigger('click'),
      (h: ReturnType<typeof montar>) => h.get('.velo').trigger('click'),
      (h: ReturnType<typeof montar>) => h.get('section').trigger('keydown', { key: 'Escape' }),
    ]) {
      const hoja = montar()
      await abrir(hoja)
      await nextTick()
      await nextTick()
      expect(hoja.emitted('cerrar')).toHaveLength(1)
      hoja.unmount()
    }
  })

  it('al sacarla, el foco vuelve al botón que la abrió', async () => {
    const boton = document.createElement('button')
    document.body.append(boton)
    const hoja = mount(HojaInferior, {
      props: { titulo: 'Movimientos', volverA: boton },
      attachTo: document.body,
    })
    hoja.unmount()
    await nextTick()
    expect(document.activeElement).toBe(boton)
    boton.remove()
  })

  it('el pie queda fuera del cuerpo y su `cerrar` baja la hoja', async () => {
    const hoja = mount(HojaInferior, {
      props: { titulo: 'Filtros' },
      slots: {
        default: '<p class="dentro">Contenido</p>',
        pie: '<template #pie="{ cerrar }"><button class="del-pie" @click="cerrar()">Listo</button></template>',
      },
      attachTo: document.body,
    })
    expect(hoja.find('.cuerpo .del-pie').exists()).toBe(false)
    await hoja.get('.pie .del-pie').trigger('click')
    await nextTick()
    await nextTick()
    expect(hoja.emitted('cerrar')).toHaveLength(1)
    hoja.unmount()
  })
})
