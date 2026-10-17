import { mount } from '@vue/test-utils'
import { defineComponent, h, nextTick, ref } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { usarAltoObservado } from '../alto-observado'

/** ResizeObserver de mentira: jsdom no lo trae. Permite "redimensionar" a mano. */
class ObservadorFalso {
  static instancias: ObservadorFalso[] = []
  observados = new Set<Element>()
  constructor(private readonly alCambiar: ResizeObserverCallback) {
    ObservadorFalso.instancias.push(this)
  }
  observe(el: Element) {
    this.observados.add(el)
  }
  unobserve(el: Element) {
    this.observados.delete(el)
  }
  disconnect() {
    this.observados.clear()
  }
  disparar() {
    const entradas = [...this.observados].map((target) => ({ target }) as ResizeObserverEntry)
    this.alCambiar(entradas, this as unknown as ResizeObserver)
  }
}

let alto = 0
const variable = () => document.documentElement.style.getPropertyValue('--alto-prueba')

function montar() {
  const visible = ref(true)
  const Componente = defineComponent({
    setup() {
      const el = ref<HTMLElement>()
      usarAltoObservado(el, { variable: '--alto-prueba' })
      return () => (visible.value ? h('div', { ref: el }) : null)
    },
  })
  return { w: mount(Componente, { attachTo: document.body }), visible }
}

describe('usarAltoObservado con variable (m5: el alto del pie en una variable CSS, sin adivinar)', () => {
  beforeEach(() => {
    ObservadorFalso.instancias = []
    vi.stubGlobal('ResizeObserver', ObservadorFalso)
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(
      () => ({ height: alto }) as DOMRect,
    )
  })
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
    document.documentElement.style.removeProperty('--alto-prueba')
  })

  it('publica el alto (redondeado hacia arriba) apenas el elemento existe', async () => {
    alto = 120.2
    const { w } = montar()
    await nextTick()
    expect(variable()).toBe('121px')
    w.unmount()
  })

  it('lo actualiza cuando el elemento cambia de tamaño (p. ej. aparece el aviso Deshacer)', async () => {
    alto = 90
    const { w } = montar()
    await nextTick()
    alto = 300
    ObservadorFalso.instancias[0]?.disparar()
    expect(variable()).toBe('300px')
    w.unmount()
  })

  it('vale 0px si el elemento deja de existir, y se quita al desmontar', async () => {
    alto = 90
    const { w, visible } = montar()
    await nextTick()
    visible.value = false
    await nextTick()
    expect(variable()).toBe('0px')
    w.unmount()
    expect(variable()).toBe('')
  })
})
