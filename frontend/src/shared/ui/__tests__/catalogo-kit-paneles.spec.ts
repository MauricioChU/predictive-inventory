import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createApp, defineComponent, h, useId } from 'vue'
import { crearContextoAvisoDeshacer } from '@/app/aviso-deshacer'
import { exponerGanchosDePrueba, type KitDeCatalogo } from '@/app/ganchos-de-prueba'
import { crearAnunciador, ESPERA_ANUNCIO_MS } from '../anunciador'
import CatalogoKitPaneles from '../__catalogo__/CatalogoKitPaneles.vue'

const COMPONENTES = [
  'SelectorSegmentado',
  'BotonesDeOpcion',
  'TarjetaDeCifra',
  'AvisoEnPagina',
  'ListaAgrupadaPorDia',
  'BarraDeProgreso',
  'MensajeDeError',
  'FilaDeDato',
  'RespuestaGrande',
  'Casos límite',
]

const VENTAS = [{ etiqueta: 'Lejía', valor: 1, textoValor: 'S/ 1.00' }]

describe('Catálogo del kit B (solo pruebas)', () => {
  let retirar: (() => void) | undefined

  function exponer(): void {
    retirar = exponerGanchosDePrueba(crearContextoAvisoDeshacer(crearAnunciador()))
  }
  function ganchos() {
    if (!window.__pruebas) throw new Error('El gancho no se expuso')
    return window.__pruebas
  }

  afterEach(() => {
    vi.useRealTimers()
    retirar?.()
    retirar = undefined
    document.body.innerHTML = ''
  })

  it('muestra una sección (h2) por cada componente del kit y una de casos límite', () => {
    const w = mount(CatalogoKitPaneles)
    expect(w.findAll('h2').map((h2) => h2.text())).toEqual(COMPONENTES)
  })

  it('RespuestaGrande se anuncia en la región viva del catálogo al aparecer y al cambiar de respuesta', async () => {
    vi.useFakeTimers()
    const w = mount(CatalogoKitPaneles, { attachTo: document.body })
    const region = w.get('[data-prueba="anuncios-del-catalogo"]')
    expect(region.attributes('role')).toBe('status')
    await vi.advanceTimersByTimeAsync(ESPERA_ANUNCIO_MS)
    // Las dos respuestas del catálogo (la de ejemplo y la del caso límite) aparecen juntas:
    // el anunciador las une en un solo anuncio.
    expect(region.text()).toBe('Sí, compra ~12 unid. No hace falta: te alcanza para ~12 días')

    const alcanza = w.findAll('[role="radio"]').find((r) => r.text() === 'Alcanza')!
    await alcanza.trigger('click')
    await vi.advanceTimersByTimeAsync(ESPERA_ANUNCIO_MS)
    expect(region.text()).toBe('No hace falta: te alcanza para ~20 días')
    w.unmount()
  })

  it('el gancho de pruebas lo monta al final de #contenido con mostrarCatalogo("paneles")', async () => {
    document.body.innerHTML = '<main id="contenido"><p>Pantalla</p></main>'
    exponer()
    await ganchos().mostrarCatalogo('paneles')
    await flushPromises()
    const contenido = document.getElementById('contenido')!
    expect(contenido.firstElementChild?.textContent).toBe('Pantalla')
    expect(contenido.querySelector('.catalogo-kit-paneles h2')?.textContent).toBe(
      'SelectorSegmentado',
    )
  })

  it.each(['inexistente', 'toString'])(
    'el gancho rechaza un kit sin catálogo ("%s"), aunque el nombre exista en Object.prototype',
    async (kit) => {
      document.body.innerHTML = '<main id="contenido"></main>'
      exponer()
      await expect(ganchos().mostrarCatalogo(kit as KitDeCatalogo)).rejects.toThrow(
        `No hay catálogo para el kit "${kit}"`,
      )
      expect(document.getElementById('contenido')!.children).toHaveLength(0)
    },
  )

  it('I1: los ids de lo que monta el gancho llevan su propio prefijo y no repiten los de la página', async () => {
    document.body.innerHTML = '<div id="app"></div><main id="contenido"></main>'
    // La app de verdad usa useId (prefijo "v"): sus ids son v-0, v-1, …
    const Pagina = defineComponent({
      setup() {
        const ids = [useId(), useId(), useId(), useId()]
        return () =>
          h(
            'div',
            ids.map((id) => h('p', { id }, id)),
          )
      },
    })
    const pagina = createApp(Pagina)
    pagina.mount('#app')
    exponer()
    await ganchos().mostrarCatalogo('paneles')
    await ganchos().mostrarGrafico('Ventas', VENTAS)
    await flushPromises()

    const ids = [...document.querySelectorAll('[id]')].map((e) => e.id)
    expect(ids.filter((id, i) => ids.indexOf(id) !== i)).toEqual([])
    const mostrar = document.querySelector('.catalogo-kit-paneles [role="radiogroup"]')!
    expect(mostrar.getAttribute('aria-labelledby')).toMatch(/^catalogo-paneles-/)
    const figura = document.querySelector('#contenido figure.grafico-barras')!
    expect(figura.getAttribute('aria-labelledby')).toMatch(/^grafico-/)
    pagina.unmount()
  })

  it('I1: dos gráficos montados por el gancho tampoco repiten ids entre sí', async () => {
    document.body.innerHTML = '<main id="contenido"></main>'
    exponer()
    await ganchos().mostrarGrafico('Ventas', VENTAS)
    await ganchos().mostrarGrafico('Compras', VENTAS)
    const figuras = [...document.querySelectorAll('figure.grafico-barras')]
    const titulos = figuras.map((f) => f.getAttribute('aria-labelledby'))
    expect(new Set(titulos).size).toBe(2)
    expect(
      figuras.map((f) => document.getElementById(f.getAttribute('aria-labelledby')!)?.textContent),
    ).toEqual(['Ventas', 'Compras'])
  })

  it('M11: la limpieza del gancho desmonta lo que montó (catálogo y gráfico) y retira sus lugares', async () => {
    document.body.innerHTML = '<main id="contenido"><p>Pantalla</p></main>'
    exponer()
    await ganchos().mostrarCatalogo('paneles')
    await ganchos().mostrarGrafico('Ventas', VENTAS)
    await flushPromises()
    expect(document.querySelector('.catalogo-kit-paneles')).not.toBeNull()
    expect(document.querySelector('.grafico-barras')).not.toBeNull()

    retirar?.()
    retirar = undefined
    expect(document.querySelector('.catalogo-kit-paneles')).toBeNull()
    expect(document.querySelector('.grafico-barras')).toBeNull()
    const contenido = document.getElementById('contenido')!
    expect([...contenido.children].map((e) => e.textContent)).toEqual(['Pantalla'])
    expect(window.__pruebas).toBeUndefined()
  })
})
