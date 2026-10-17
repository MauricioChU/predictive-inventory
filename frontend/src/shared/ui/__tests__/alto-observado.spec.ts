import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, ref } from 'vue'
import { usarAltoObservado } from '../alto-observado'

/** Un ResizeObserver de mentira: guarda el callback para "redimensionar" a mano. */
class ObservadorDePrueba {
  static ultimo: ObservadorDePrueba | null = null
  observados: Element[] = []
  constructor(readonly avisar: ResizeObserverCallback) {
    ObservadorDePrueba.ultimo = this
  }
  observe(el: Element) {
    this.observados.push(el)
  }
  unobserve(el: Element) {
    this.observados = this.observados.filter((o) => o !== el)
  }
  disconnect() {
    this.observados = []
  }
}

describe('usarAltoObservado (alto real de la acción pegada abajo)', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('sin ResizeObserver (jsdom) vale 0', () => {
    let alto = -1
    mount(
      defineComponent({
        setup() {
          const el = ref<HTMLElement>()
          alto = usarAltoObservado(el).value
          return () => h('div', { ref: el })
        },
      }),
    )
    expect(alto).toBe(0)
  })

  it('sigue el alto del elemento (redondeado hacia arriba) y deja de observar al desmontar', async () => {
    vi.stubGlobal('ResizeObserver', ObservadorDePrueba)
    const alto = ref(0)
    const w = mount(
      defineComponent({
        setup() {
          const el = ref<HTMLElement>()
          const observado = usarAltoObservado(el)
          return () => h('div', { ref: el }, String((alto.value = observado.value)))
        },
      }),
    )
    await w.vm.$nextTick()
    const observador = ObservadorDePrueba.ultimo!
    expect(observador.observados).toEqual([w.element])
    vi.spyOn(w.element, 'getBoundingClientRect').mockReturnValue({ height: 96.2 } as DOMRect)
    observador.avisar(
      [{ target: w.element } as unknown as ResizeObserverEntry],
      observador as unknown as ResizeObserver,
    )
    await w.vm.$nextTick()
    expect(w.text()).toBe('97')
    w.unmount()
    expect(observador.observados).toEqual([])
  })
})
