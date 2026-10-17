import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, describe, expect, it } from 'vitest'
import { defineComponent, h, ref } from 'vue'
import Tarjeta from '../componentes/Tarjeta.vue'

/** Contenido de bloque, como el de una tarjeta de verdad (título y descripción). */
const CONTENIDO = () => [h('h3', 'Lejía 1 L'), h('p', 'Quedan 3 unid.')]

/** Lo que un <button> NO puede llevar adentro (solo admite contenido de frase). */
const DE_BLOQUE = 'div, p, h1, h2, h3, h4, h5, h6, ul, ol, li, section, article, header, footer'

afterEach(() => {
  document.body.innerHTML = ''
})

describe('Tarjeta', () => {
  it('normal: un bloque con su contenido, sin botón', () => {
    const w = mount(Tarjeta, { slots: { default: CONTENIDO } })
    expect(w.element.tagName).toBe('DIV')
    expect(w.find('button').exists()).toBe(false)
    expect(w.get('h3').text()).toBe('Lejía 1 L')
  })

  describe('plan 17: comoBoton', () => {
    it('ningún contenido de bloque queda dentro del <button>', () => {
      const w = mount(Tarjeta, { props: { comoBoton: true }, slots: { default: CONTENIDO } })
      const boton = w.get('button')
      expect(boton.element.querySelectorAll(DE_BLOQUE)).toHaveLength(0)
      // El contenido igual se ve, entero, en la tarjeta.
      expect(w.get('h3').text()).toBe('Lejía 1 L')
      expect(w.get('p').text()).toBe('Quedan 3 unid.')
    })

    it('el botón se llama como lo que dice la tarjeta (con espacios) y emite click al tocarlo', async () => {
      const w = mount(Tarjeta, {
        props: { comoBoton: true },
        slots: { default: CONTENIDO },
        attachTo: document.body,
      })
      const boton = w.get('button')
      expect(boton.attributes('type')).toBe('button')
      await flushPromises()
      expect(boton.attributes('aria-label')).toBe('Lejía 1 L Quedan 3 unid.')
      await boton.trigger('click')
      expect(w.emitted('click')).toHaveLength(1)
    })

    it('ronda 1: el contenido no se lee dos veces (aria-hidden) y el nombre sigue sus cambios', async () => {
      const texto = ref('Quedan 3 unid.')
      const w = mount(
        defineComponent({
          setup: () => () =>
            h(Tarjeta, { comoBoton: true }, () => [h('h3', 'Lejía 1 L'), h('p', texto.value)]),
        }),
        { attachTo: document.body },
      )
      await flushPromises()
      expect(w.get('.contenido').attributes('aria-hidden')).toBe('true')
      texto.value = 'Se acabó'
      await flushPromises()
      expect(w.get('button').attributes('aria-label')).toBe('Lejía 1 L Se acabó')
    })
  })
})
