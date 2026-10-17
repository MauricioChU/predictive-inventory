import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it } from 'vitest'
import { h } from 'vue'
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

    it('el botón se llama como lo que dice la tarjeta y emite click al tocarlo', async () => {
      const w = mount(Tarjeta, {
        props: { comoBoton: true },
        slots: { default: CONTENIDO },
        attachTo: document.body,
      })
      const boton = w.get('button')
      expect(boton.attributes('type')).toBe('button')
      const etiquetadoPor = document.getElementById(boton.attributes('aria-labelledby')!)
      expect(etiquetadoPor?.textContent).toBe('Lejía 1 LQuedan 3 unid.')
      await boton.trigger('click')
      expect(w.emitted('click')).toHaveLength(1)
    })
  })
})
